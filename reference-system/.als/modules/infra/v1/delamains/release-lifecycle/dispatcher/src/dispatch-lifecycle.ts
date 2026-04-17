export interface ObservedDispatchItem {
  id: string;
  status: string;
}

export interface DelegatedDispatchHeartbeatItem {
  item_id: string;
  state: string;
  delegated_at: string;
}

export interface DispatcherHeartbeatState {
  active_dispatches: number;
  delegated_dispatches: number;
  delegated_items: DelegatedDispatchHeartbeatItem[];
}

export interface StatusChangeRelease {
  itemId: string;
  previousStatus: string;
  nextStatus: string;
  releasedActive: boolean;
  releasedDelegated: boolean;
}

export interface DispatchCompletion {
  itemId: string;
  state: string;
  success: boolean;
  delegated: boolean;
  delegatedAtMs?: number;
}

export type DispatchCompletionDisposition =
  | "released_after_failure"
  | "guarded_direct"
  | "guarded_delegated"
  | "ignored_stale";

interface DelegatedDispatchState {
  state: string;
  delegatedAtMs: number;
}

export class DispatchLifecycle {
  private readonly lastSeen = new Map<string, string>();
  private readonly active = new Map<string, string>();
  private readonly delegated = new Map<string, DelegatedDispatchState>();

  reconcile(items: ReadonlyArray<ObservedDispatchItem>): StatusChangeRelease[] {
    const releases: StatusChangeRelease[] = [];

    for (const item of items) {
      const previousStatus = this.lastSeen.get(item.id);
      if (previousStatus && previousStatus !== item.status) {
        const released = this.release(item.id);
        releases.push({
          itemId: item.id,
          previousStatus,
          nextStatus: item.status,
          ...released,
        });
      }

      this.lastSeen.set(item.id, item.status);
    }

    return releases;
  }

  isGuarded(itemId: string): boolean {
    return this.active.has(itemId) || this.delegated.has(itemId);
  }

  markDispatchStarted(itemId: string, state: string): void {
    this.active.set(itemId, state);
  }

  completeDispatch({
    itemId,
    state,
    success,
    delegated,
    delegatedAtMs = Date.now(),
  }: DispatchCompletion): DispatchCompletionDisposition {
    if (!success) {
      this.active.delete(itemId);
      return "released_after_failure";
    }

    const activeState = this.active.get(itemId);
    const currentStatus = this.lastSeen.get(itemId);

    if (!activeState || activeState !== state || (currentStatus && currentStatus !== state)) {
      this.release(itemId);
      return "ignored_stale";
    }

    if (delegated) {
      this.active.delete(itemId);
      this.delegated.set(itemId, { state, delegatedAtMs });
      return "guarded_delegated";
    }

    return "guarded_direct";
  }

  counts(): { active: number; delegated: number } {
    return {
      active: this.active.size,
      delegated: this.delegated.size,
    };
  }

  activeItemIds(): string[] {
    return [...this.active.keys()].sort();
  }

  heartbeat(): DispatcherHeartbeatState {
    const delegatedItems = [...this.delegated.entries()]
      .sort((a, b) => {
        const [itemA, stateA] = a;
        const [itemB, stateB] = b;
        if (stateA.delegatedAtMs !== stateB.delegatedAtMs) {
          return stateA.delegatedAtMs - stateB.delegatedAtMs;
        }
        return itemA.localeCompare(itemB);
      })
      .map(([itemId, state]) => ({
        item_id: itemId,
        state: state.state,
        delegated_at: new Date(state.delegatedAtMs).toISOString(),
      }));

    return {
      active_dispatches: this.active.size,
      delegated_dispatches: delegatedItems.length,
      delegated_items: delegatedItems,
    };
  }

  private release(itemId: string): { releasedActive: boolean; releasedDelegated: boolean } {
    const releasedActive = this.active.delete(itemId);
    const releasedDelegated = this.delegated.delete(itemId);

    return { releasedActive, releasedDelegated };
  }
}
