# Delamain Agent Hook Projection

## Status

Proposed

## Context

- Dispatched Delamain agents author records inside isolated git worktrees where the outer-worktree ALS validator hooks do not fire.
- The current dispatcher spawn path uses provider SDKs directly: Anthropic through `query({ options })` and OpenAI through `new Codex({ config }).startThread()` or `resumeThread()`.
- Existing ALS hook scripts already implement the desired validation policy for local authoring:
  - `als-breadcrumb.sh` records touched ALS modules during `PostToolUse`
  - `als-stop-gate.sh` performs session-scoped validation during `Stop`
- Anthropic and OpenAI expose different native hook surfaces:
  - Anthropic agent dispatch requires SDK callback hooks in `options.hooks`
  - Codex hook dispatch is configured through config-layer hooks (`hooks.json` or inline `[hooks]`) with `features.codex_hooks = true`
- Current dispatcher prompt loading is flat-scalar only. Nested YAML such as `hooks:` is not preserved at runtime, so authored hook declarations cannot yet reach either provider adapter.
- Operator direction for ALS-019 is explicit:
  - fix the gap at the authoring surface, not at mergeBack
  - keep the source of truth in agent frontmatter
  - drop merge-back validation and prompt-only guidance as the primary fix

## Decision

- Delamain agent prompt frontmatter may declare optional `hooks`.
- `hooks` is the authored source of truth for dispatched-agent hook behavior. The dispatcher projects it into the provider-native runtime surface at spawn time.
- The v1 authored hook surface is intentionally narrow:
  - supported events: `PostToolUse`, `Stop`
  - supported handler type: `command`
  - matcher groups follow the existing hook shape: each event maps to a list of groups, each group may declare `matcher`, and each group contains one or more `hooks`
- The first required use of this surface is ALS validation parity for dispatched agents that edit ALS-authored records:
  - `PostToolUse` records breadcrumbs through `als-breadcrumb.sh`
  - `Stop` performs final validation through the shared stop-gate logic
- OpenAI projection is config-layer based:
  - the dispatcher injects `features.codex_hooks = true`
  - the dispatcher injects inline hook configuration equivalent to Codex `[hooks]`
  - the dispatcher does not need to materialize per-dispatch `.codex/hooks.json`
- Anthropic projection is SDK-callback based:
  - the dispatcher translates each authored `command` hook into an `options.hooks` callback that executes the shell command in the dispatch session
  - the dispatcher does not need to switch the spawn path to the `--agent` surface
- Existing validator logic remains shared. If a provider requires different hook I/O framing than the current shell script emits, the host may add a thin provider-specific bridge around the shared ALS validation logic without changing authored hook declarations.
- Commands run in the dispatch session working directory and receive the dispatch session environment, including the hook-related ALS environment the existing scripts need.
- Example authored shape:

```yaml
---
name: als-factory-jobs--planning
description: Handle ALS factory jobs in planning.
model: gpt-5.4
sandbox-mode: workspace-write
approval-policy: never
hooks:
  PostToolUse:
    - matcher: Write|Edit
      hooks:
        - type: command
          command: bash "$CLAUDE_PLUGIN_ROOT/hooks/als-breadcrumb.sh"
          timeout: 5
  Stop:
    - hooks:
        - type: command
          command: bash "$CLAUDE_PLUGIN_ROOT/hooks/als-stop-gate.sh"
          timeout: 30
---
```

## Normative Effect

- Required: dispatched Delamain agent prompts may declare `hooks` only as YAML object data in frontmatter.
- Required: v1 hosts accept only `PostToolUse` and `Stop` in this authored hook surface.
- Required: v1 hosts accept only `type: command` handlers in this authored hook surface.
- Required: the dispatcher projects authored hooks into the provider-native runtime before the first turn begins.
- Required: OpenAI hook projection enables Codex hooks through config injection.
- Required: Anthropic hook projection uses the SDK hook surface rather than changing the authored prompt to a different spawn mode.
- Required: dispatched agents that can edit ALS-authored records carry the ALS validator hook pair so validation runs before the dispatch can finish.
- Required: hook commands execute in the isolated dispatch worktree context.
- Allowed: hosts may insert provider-specific bridge wrappers when a provider's hook wire format differs from the shared shell script's I/O contract.
- Allowed: agent prompts that do not edit ALS-authored records may omit `hooks`.
- Rejected: mergeBack-only validation as the normative enforcement point for this problem.
- Rejected: prompt-only "remember ALS markdown rules" guidance as the primary fix.
- Rejected: provider-owned side files as the authored source of truth when the agent prompt frontmatter can carry the same declaration.

## Compiler Impact

- Extend Delamain prompt validation so `hooks` is a recognized authored field on agent prompts and its narrow v1 shape is validated explicitly.
- Reject unsupported hook event names and unsupported handler types with prompt-frontmatter diagnostics.
- Keep provider-native prompt-boundary validation intact: `hooks` is shared, while existing Anthropic-only and OpenAI-only frontmatter fields remain provider-specific.
- Preserve authored nested frontmatter shape through runtime-facing projections so dispatch-time prompt loading can materialize hook configuration without lossy string parsing.
- Add coverage for:
  - valid OpenAI and Anthropic prompt assets with the shared `hooks` shape
  - unsupported event names
  - unsupported handler types
  - malformed nested hook frontmatter
  - provider dispatch paths that materialize hooks for both SDKs

## Docs and Fixture Impact

- Add this SDR as the normative record for dispatched-agent hook projection.
- Update the canonical Delamain prompt and dispatcher documentation to show the shared `hooks` authoring shape and the provider-projection rule.
- Paint the authored `hooks` syntax into the affected factory agent prompts before implementation is considered complete.
- Update examples and projected bundles so the validator hook pair appears in the same prompts that currently rely on dispatcher isolation.
- Keep hook examples aligned with the existing ALS hook scripts and their intended `PostToolUse` plus `Stop` roles.

## Alternatives Considered

- Validate only at mergeBack.
- Rejected because the invalid authoring still happens inside the agent session and the operator still inherits late cleanup or rework loops.
- Rewrite every agent prompt to restate ALS body rules and trust the model to comply.
- Rejected because prompt drift is not an enforcement mechanism.
- Switch Anthropic dispatch to the `--agent` or subagent surface solely to inherit frontmatter hooks automatically.
- Rejected because it enlarges the spawn-path blast radius and still leaves the OpenAI path needing explicit projection.
- Materialize per-dispatch `.codex/hooks.json` files for OpenAI.
- Rejected because the SDK already exposes config overrides, so writing runtime hook files is extra state without a compensating semantic benefit.
