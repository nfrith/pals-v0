import { buildDispatchCommitMessage } from "./dispatch-commit.js";
import { DispatchRegistry, type RegistryStatusRelease } from "./dispatch-registry.js";
import { readFrontmatterField } from "./frontmatter.js";
import {
  GitWorktreeIsolationStrategy,
  type IsolatedDispatch,
} from "./git-worktree-isolation.js";
import { OrphanSweeper, type OrphanSweepSummary } from "./orphan-sweeper.js";
import { RepoMutationLock } from "./repo-mutation-lock.js";
import type { RuntimeDispatchRecord } from "./runtime-state.js";
import type { DispatchEntry } from "./dispatcher.js";

export interface DispatcherRuntimeConfig {
  bundleRoot: string;
  systemRoot: string;
  delamainName: string;
  statusField: string;
  pollMs: number;
  worktreeRoot?: string;
}

export interface PreparedDispatch extends IsolatedDispatch {
  startedAt: string;
}

export interface FinalizeDispatchInput {
  prepared: PreparedDispatch;
  entry: DispatchEntry;
  sessionId: string | null;
  durationMs: number | null;
  numTurns: number | null;
  costUsd: number | null;
  success: boolean;
}

export interface FinalizeDispatchResult {
  success: boolean;
  blocked: boolean;
  finalState: string;
  mergeOutcome: "merged" | "blocked" | "no_changes" | "skipped";
  worktreeCommit: string | null;
  integratedCommit: string | null;
  incidentKind: string | null;
  incidentMessage: string | null;
}

export interface DispatcherRuntimeHeartbeat {
  active_dispatches: number;
  blocked_dispatches: number;
  orphaned_dispatches: number;
  guarded_dispatches: number;
  delegated_dispatches: number;
  delegated_items: Array<{
    item_id: string;
    state: string;
    delegated_at: string;
  }>;
}

export class DispatcherRuntime {
  private readonly registry: DispatchRegistry;
  private readonly isolation: GitWorktreeIsolationStrategy;
  private readonly repoMutationLock: RepoMutationLock;
  private readonly orphanSweeper: OrphanSweeper;
  private readonly statusField: string;
  private readonly delamainName: string;

  constructor(config: DispatcherRuntimeConfig) {
    this.registry = new DispatchRegistry(config.bundleRoot);
    this.isolation = new GitWorktreeIsolationStrategy({
      systemRoot: config.systemRoot,
      delamainName: config.delamainName,
      worktreeRoot: config.worktreeRoot,
    });
    this.repoMutationLock = new RepoMutationLock(config.systemRoot, {
      staleMs: Math.max(config.pollMs * 4, 60_000),
    });
    this.orphanSweeper = new OrphanSweeper(
      this.registry,
      this.isolation,
      this.repoMutationLock,
      {
        staleDispatchMs: Math.max(config.pollMs * 4, 60_000),
      },
    );
    this.statusField = config.statusField;
    this.delamainName = config.delamainName;
  }

  async prepareDispatch(
    itemId: string,
    itemFile: string,
    entry: DispatchEntry,
  ): Promise<PreparedDispatch | null> {
    const existing = await this.registry.getByItemId(itemId);
    if (existing) {
      return null;
    }

    const prepared = await this.isolation.prepareDispatch({
      dispatchId: buildDispatchId(),
      itemId,
      itemFile,
    });
    const record = buildActiveRecord(this.delamainName, prepared, entry);

    const claimed = await this.registry.create(record);
    if (!claimed) {
      await this.isolation.cleanupDispatch({
        worktreePath: prepared.worktreePath,
        branchName: prepared.branchName,
      });
      return null;
    }

    return {
      ...prepared,
      startedAt: record.started_at,
    };
  }

  async touchDispatch(dispatchId: string): Promise<void> {
    await this.registry.touchDispatch(dispatchId);
  }

  async finalizeDispatch(input: FinalizeDispatchInput): Promise<FinalizeDispatchResult> {
    const finalState = await readFrontmatterField(
      input.prepared.isolatedItemFile,
      this.statusField,
    ) ?? input.entry.state;
    const inspection = await this.isolation.inspectWorktree({
      worktreePath: input.prepared.worktreePath,
      baseCommit: input.prepared.baseCommit,
    });

    if (!input.success) {
      if (inspection.pristine) {
        await this.isolation.cleanupDispatch({
          worktreePath: input.prepared.worktreePath,
          branchName: input.prepared.branchName,
        });
        await this.registry.removeByItemId(input.prepared.itemId);
        return {
          success: false,
          blocked: false,
          finalState,
          mergeOutcome: "skipped",
          worktreeCommit: null,
          integratedCommit: null,
          incidentKind: null,
          incidentMessage: null,
        };
      }

      const incidentMessage = "Agent run failed after mutating the isolated worktree";
      await this.registry.updateByItemId(input.prepared.itemId, (record) => ({
        ...record,
        status: "blocked",
        updated_at: new Date().toISOString(),
        latest_error: incidentMessage,
        latest_session_id: input.sessionId,
        latest_duration_ms: input.durationMs,
        latest_num_turns: input.numTurns,
        latest_cost_usd: input.costUsd,
        merge_outcome: "blocked",
        incident: {
          kind: "dispatch_failed_dirty",
          message: incidentMessage,
          detected_at: new Date().toISOString(),
        },
      }));

      return {
        success: false,
        blocked: true,
        finalState,
        mergeOutcome: "blocked",
        worktreeCommit: inspection.headCommit,
        integratedCommit: null,
        incidentKind: "dispatch_failed_dirty",
        incidentMessage,
      };
    }

    if (inspection.pristine) {
      await this.isolation.cleanupDispatch({
        worktreePath: input.prepared.worktreePath,
        branchName: input.prepared.branchName,
      });
      await this.completeSuccessfulGuard(input, finalState, null, null, "no_changes");
      return {
        success: true,
        blocked: false,
        finalState,
        mergeOutcome: "no_changes",
        worktreeCommit: null,
        integratedCommit: null,
        incidentKind: null,
        incidentMessage: null,
      };
    }

    const commitMessage = buildDispatchCommitMessage({
      dispatchId: input.prepared.dispatchId,
      dispatcherName: this.delamainName,
      itemId: input.prepared.itemId,
      agentName: input.entry.agentName,
      fromState: input.entry.state,
      toState: finalState,
      durationMs: input.durationMs,
      numTurns: input.numTurns,
      costUsd: input.costUsd,
      sessionId: input.sessionId,
    });
    const worktreeCommit = await this.isolation.commitDispatch(
      input.prepared.worktreePath,
      commitMessage,
    );

    if (!worktreeCommit) {
      await this.isolation.cleanupDispatch({
        worktreePath: input.prepared.worktreePath,
        branchName: input.prepared.branchName,
      });
      await this.completeSuccessfulGuard(input, finalState, null, null, "no_changes");
      return {
        success: true,
        blocked: false,
        finalState,
        mergeOutcome: "no_changes",
        worktreeCommit: null,
        integratedCommit: null,
        incidentKind: null,
        incidentMessage: null,
      };
    }

    const mergeResult = await this.repoMutationLock.withLease(
      {
        dispatch_id: input.prepared.dispatchId,
        dispatcher_name: this.delamainName,
        item_id: input.prepared.itemId,
        worktree_path: input.prepared.worktreePath,
      },
      () => this.isolation.mergeBack(worktreeCommit),
    );

    if (mergeResult.status !== "merged") {
      const incidentDetectedAt = new Date().toISOString();
      await this.registry.updateByItemId(input.prepared.itemId, (record) => ({
        ...record,
        status: "blocked",
        updated_at: incidentDetectedAt,
        latest_error: mergeResult.error,
        latest_session_id: input.sessionId,
        latest_duration_ms: input.durationMs,
        latest_num_turns: input.numTurns,
        latest_cost_usd: input.costUsd,
        worktree_commit: worktreeCommit,
        merge_outcome: "blocked",
        merge_attempted_at: incidentDetectedAt,
        merge_message: commitMessage,
        incident: {
          kind: mergeResult.incidentKind ?? "merge_blocked",
          message: mergeResult.error ?? "Merge back blocked",
          detected_at: incidentDetectedAt,
        },
      }));

      return {
        success: false,
        blocked: true,
        finalState,
        mergeOutcome: "blocked",
        worktreeCommit,
        integratedCommit: null,
        incidentKind: mergeResult.incidentKind,
        incidentMessage: mergeResult.error,
      };
    }

    try {
      await this.isolation.cleanupDispatch({
        worktreePath: input.prepared.worktreePath,
        branchName: input.prepared.branchName,
      });
    } catch (error) {
      const incidentMessage = error instanceof Error ? error.message : String(error);
      await this.registry.updateByItemId(input.prepared.itemId, (record) => ({
        ...record,
        status: "blocked",
        updated_at: new Date().toISOString(),
        latest_error: incidentMessage,
        latest_session_id: input.sessionId,
        latest_duration_ms: input.durationMs,
        latest_num_turns: input.numTurns,
        latest_cost_usd: input.costUsd,
        worktree_commit: worktreeCommit,
        integrated_commit: mergeResult.integratedCommit,
        merge_outcome: "merged",
        merge_attempted_at: new Date().toISOString(),
        merge_message: commitMessage,
        incident: {
          kind: "cleanup_failed",
          message: incidentMessage,
          detected_at: new Date().toISOString(),
        },
      }));

      return {
        success: true,
        blocked: true,
        finalState,
        mergeOutcome: "merged",
        worktreeCommit,
        integratedCommit: mergeResult.integratedCommit,
        incidentKind: "cleanup_failed",
        incidentMessage,
      };
    }

    await this.completeSuccessfulGuard(
      input,
      finalState,
      worktreeCommit,
      mergeResult.integratedCommit,
      "merged",
    );

    return {
      success: true,
      blocked: false,
      finalState,
      mergeOutcome: "merged",
      worktreeCommit,
      integratedCommit: mergeResult.integratedCommit,
      incidentKind: null,
      incidentMessage: null,
    };
  }

  async reconcileObservedItems(
    items: ReadonlyArray<{ id: string; status: string }>,
  ): Promise<RegistryStatusRelease[]> {
    return this.registry.reconcileObservedItems(items);
  }

  async hasOpenRecord(itemId: string): Promise<boolean> {
    return (await this.registry.getByItemId(itemId)) !== null;
  }

  async heartbeat(): Promise<DispatcherRuntimeHeartbeat> {
    const summary = await this.registry.summary();
    const delegatedItems = [...summary.delegated]
      .sort((left, right) => left.started_at.localeCompare(right.started_at))
      .map((record) => ({
        item_id: record.item_id,
        state: record.state,
        delegated_at: record.started_at,
      }));

    return {
      active_dispatches: summary.activeCount,
      blocked_dispatches: summary.blockedCount,
      orphaned_dispatches: summary.orphanedCount,
      guarded_dispatches: summary.guardedCount,
      delegated_dispatches: summary.delegatedCount,
      delegated_items: delegatedItems,
    };
  }

  async sweepOrphans(): Promise<OrphanSweepSummary> {
    return this.orphanSweeper.sweep();
  }

  private async completeSuccessfulGuard(
    input: FinalizeDispatchInput,
    finalState: string,
    worktreeCommit: string | null,
    integratedCommit: string | null,
    mergeOutcome: "merged" | "no_changes",
  ): Promise<void> {
    const shouldPersistGuard = finalState === input.entry.state;

    if (!shouldPersistGuard) {
      await this.registry.removeByItemId(input.prepared.itemId);
      return;
    }

    const nextStatus = input.entry.delegated ? "delegated" : "guarded";
    await this.registry.updateByItemId(input.prepared.itemId, (record) => ({
      ...record,
      status: nextStatus,
      worktree_path: null,
      branch_name: null,
      isolated_item_file: null,
      updated_at: new Date().toISOString(),
      heartbeat_at: null,
      worktree_commit: worktreeCommit,
      integrated_commit: integratedCommit,
      merge_outcome: mergeOutcome,
      merge_attempted_at: mergeOutcome === "merged" ? new Date().toISOString() : null,
      latest_error: null,
      latest_session_id: input.sessionId,
      latest_duration_ms: input.durationMs,
      latest_num_turns: input.numTurns,
      latest_cost_usd: input.costUsd,
      incident: null,
    }));
  }
}

function buildDispatchId(): string {
  return `d-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function buildActiveRecord(
  dispatcherName: string,
  prepared: PreparedDispatch | IsolatedDispatch,
  entry: DispatchEntry,
): RuntimeDispatchRecord {
  const now = new Date().toISOString();
  return {
    dispatch_id: prepared.dispatchId,
    item_id: prepared.itemId,
    item_file: prepared.itemFile,
    isolated_item_file: prepared.isolatedItemFile,
    state: entry.state,
    agent_name: entry.agentName,
    dispatcher_name: dispatcherName,
    delegated: entry.delegated,
    resumable: entry.resumable,
    session_field: entry.sessionField ?? null,
    status: "active",
    worktree_path: prepared.worktreePath,
    branch_name: prepared.branchName,
    base_commit: prepared.baseCommit,
    worktree_commit: null,
    integrated_commit: null,
    started_at: now,
    updated_at: now,
    heartbeat_at: now,
    owner_pid: process.pid,
    transition_targets: entry.transitions.map((transition) => transition.to),
    merge_outcome: "pending",
    merge_attempted_at: null,
    merge_message: null,
    latest_error: null,
    latest_session_id: null,
    latest_duration_ms: null,
    latest_num_turns: null,
    latest_cost_usd: null,
    incident: null,
  };
}
