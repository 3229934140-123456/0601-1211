import type {
  ToolbarSyncState,
  ToolbarSyncEventType,
  ToolbarSyncSubscription,
  ToolbarState,
  SubmitResult,
  RichResultSummary,
} from '../types';

let subIdCounter = 0;

export class ToolbarSync {
  private subscriptions: Map<string, ToolbarSyncSubscription> = new Map();
  private currentState: ToolbarSyncState | null = null;

  subscribe(
    callback: (state: ToolbarSyncState, event: ToolbarSyncEventType) => void,
    events?: ToolbarSyncEventType[]
  ): () => void {
    const id = `sub_${++subIdCounter}_${Date.now()}`;
    const sub: ToolbarSyncSubscription = { id, callback, events };
    this.subscriptions.set(id, sub);

    if (this.currentState) {
      try {
        callback(this.currentState, 'stateChange');
      } catch (_) {}
    }

    return () => {
      this.subscriptions.delete(id);
    };
  }

  unsubscribe(id: string): void {
    this.subscriptions.delete(id);
  }

  updateFromToolbarState(
    toolbarState: ToolbarState,
    event: ToolbarSyncEventType,
    extras?: {
      isSubmitting?: boolean;
      lastSubmitResult?: SubmitResult | null;
      lastRichSummary?: RichResultSummary | null;
    }
  ): void {
    this.currentState = {
      ...toolbarState,
      lastEvent: event,
      lastEventAt: Date.now(),
      isSubmitting: extras?.isSubmitting ?? this.currentState?.isSubmitting ?? false,
      lastSubmitResult: extras?.lastSubmitResult ?? this.currentState?.lastSubmitResult ?? null,
      lastRichSummary: extras?.lastRichSummary ?? this.currentState?.lastRichSummary ?? null,
    };

    this.notifySubscribers(event);
  }

  getCurrentState(): ToolbarSyncState | null {
    return this.currentState;
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  destroy(): void {
    this.subscriptions.clear();
    this.currentState = null;
  }

  private notifySubscribers(event: ToolbarSyncEventType): void {
    if (!this.currentState) return;

    for (const sub of this.subscriptions.values()) {
      if (sub.events && sub.events.length > 0 && !sub.events.includes(event)) {
        continue;
      }
      try {
        sub.callback(this.currentState, event);
      } catch (e) {
        console.error('[ToolbarSync] Subscriber error:', e);
      }
    }
  }
}
