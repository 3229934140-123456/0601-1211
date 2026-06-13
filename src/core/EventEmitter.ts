import type { SurveyEventMap, SurveyEventName } from '../types';

type EventCallback<K extends SurveyEventName> = (
  payload: SurveyEventMap[K]
) => void;

type AnyCallback = (payload: unknown) => void;

export class EventEmitter {
  private listeners: Map<string, Set<AnyCallback>> = new Map();

  on<K extends SurveyEventName>(
    eventName: K,
    callback: EventCallback<K>
  ): () => void {
    const key = eventName as string;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback as AnyCallback);

    return () => {
      this.off(eventName, callback);
    };
  }

  off<K extends SurveyEventName>(
    eventName: K,
    callback: EventCallback<K>
  ): void {
    const key = eventName as string;
    const set = this.listeners.get(key);
    if (set) {
      set.delete(callback as AnyCallback);
    }
  }

  once<K extends SurveyEventName>(
    eventName: K,
    callback: EventCallback<K>
  ): () => void {
    const key = eventName as string;
    const wrapped = (payload: unknown) => {
      callback(payload as SurveyEventMap[K]);
      this.off(eventName, wrapped as EventCallback<K>);
    };
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(wrapped as AnyCallback);

    return () => {
      this.off(eventName, wrapped as EventCallback<K>);
    };
  }

  emit<K extends SurveyEventName>(
    eventName: K,
    payload: SurveyEventMap[K]
  ): void {
    const key = eventName as string;
    const set = this.listeners.get(key);
    if (set) {
      for (const cb of set) {
        try {
          cb(payload);
        } catch (e) {
          console.error(
            `[SurveySDK] Event listener error for "${eventName}":`,
            e
          );
        }
      }
    }
  }

  removeAllListeners(eventName?: SurveyEventName): void {
    if (eventName) {
      this.listeners.delete(eventName as string);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(eventName: SurveyEventName): number {
    const set = this.listeners.get(eventName as string);
    return set ? set.size : 0;
  }
}
