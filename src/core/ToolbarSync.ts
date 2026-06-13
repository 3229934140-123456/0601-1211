import type {
  ToolbarSyncState,
  ToolbarSyncEventType,
  ToolbarSyncSubscription,
  ToolbarState,
  SubmitResult,
  RichResultSummary,
  SyncContainerConfig,
  SyncBroadcastMessage,
  CrossContainerSyncResult,
} from '../types';

let subIdCounter = 0;

export class ToolbarSync {
  private subscriptions: Map<string, ToolbarSyncSubscription> = new Map();
  private containers: Map<string, SyncContainerConfig> = new Map();
  private broadcastHistory: SyncBroadcastMessage[] = [];
  private currentState: ToolbarSyncState | null = null;
  private lastBroadcastAt: number = 0;
  private totalBroadcastCount: number = 0;

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

  registerContainer(config: SyncContainerConfig): () => void {
    this.containers.set(config.containerId, config);

    const unsub = this.subscribe(
      (state, event) => {
        if (config.actionHandlers && config.actionHandlers[event]) {
          try {
            config.actionHandlers[event]!(state);
          } catch (e) {
            console.error(`[ToolbarSync] Container action handler error (${config.containerId}, ${event}):`, e);
          }
        }

        if (config.render && typeof document !== 'undefined') {
          const el = document.getElementById(config.containerId);
          if (el) {
            try {
              config.render(state, el);
            } catch (e) {
              console.error(`[ToolbarSync] Container render error (${config.containerId}):`, e);
            }
          }
        }
      },
      config.subscribeEvents
    );

    if (this.currentState && config.render && typeof document !== 'undefined') {
      const el = document.getElementById(config.containerId);
      if (el) {
        try {
          config.render(this.currentState, el);
        } catch (_) {}
      }
    }

    return () => {
      this.containers.delete(config.containerId);
      unsub();
    };
  }

  unregisterContainer(containerId: string): void {
    this.containers.delete(containerId);
  }

  getRegisteredContainers(): string[] {
    return Array.from(this.containers.keys());
  }

  broadcast(
    sourceContainerId: string,
    event: ToolbarSyncEventType,
    overrides?: Partial<ToolbarState>
  ): boolean {
    if (!this.currentState) return false;

    if (overrides) {
      this.currentState = {
        ...this.currentState,
        ...overrides,
        lastEvent: event,
        lastEventAt: Date.now(),
      };
    }

    const message: SyncBroadcastMessage = {
      sourceContainerId,
      event,
      state: this.currentState,
      timestamp: Date.now(),
    };
    this.broadcastHistory.push(message);
    if (this.broadcastHistory.length > 100) {
      this.broadcastHistory.shift();
    }
    this.totalBroadcastCount++;
    this.lastBroadcastAt = message.timestamp;

    this.notifySubscribers(event, sourceContainerId);
    return true;
  }

  getBroadcastHistory(limit: number = 20): SyncBroadcastMessage[] {
    return this.broadcastHistory.slice(-limit);
  }

  getCrossContainerSyncResult(): CrossContainerSyncResult {
    return {
      registeredContainers: Array.from(this.containers.keys()),
      broadcastCount: this.totalBroadcastCount,
      lastSyncAt: this.lastBroadcastAt,
    };
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

    this.totalBroadcastCount++;
    this.lastBroadcastAt = Date.now();
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
    this.containers.clear();
    this.broadcastHistory = [];
    this.currentState = null;
    this.totalBroadcastCount = 0;
  }

  private notifySubscribers(
    event: ToolbarSyncEventType,
    excludeSource?: string
  ): void {
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
