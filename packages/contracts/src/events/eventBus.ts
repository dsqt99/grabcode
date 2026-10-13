import { GrabCodeEvent, GrabCodeEventType } from '../types/events';

type EventHandler<T extends GrabCodeEvent = GrabCodeEvent> = (event: T) => void;

const CHANNEL_NAME = 'grabcode_event_bus';
const STORAGE_EVENT_KEY = 'grabcode_latest_event';

class CrossAppEventBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<EventHandler> = new Set();
  private isBrowser: boolean = typeof window !== 'undefined';

  constructor() {
    if (this.isBrowser) {
      this.initChannel();
      this.initStorageFallback();
    }
  }

  private initChannel() {
    if ('BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (messageEvent) => {
          const event = messageEvent.data as GrabCodeEvent;
          if (event && event.type) {
            this.notifyListeners(event);
          }
        };
      } catch (err) {
        console.warn('[EventBus] BroadcastChannel error, using storage fallback', err);
      }
    }
  }

  private initStorageFallback() {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_EVENT_KEY && e.newValue) {
        try {
          const event = JSON.parse(e.newValue) as GrabCodeEvent;
          if (event && event.type) {
            this.notifyListeners(event);
          }
        } catch {
          // ignore parse errors
        }
      }
    });
  }

  private notifyListeners(event: GrabCodeEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[EventBus] Error in listener', err);
      }
    });
  }

  public publish(event: GrabCodeEvent): void {
    if (!this.isBrowser) return;

    // 1. Notify internal listeners in the same window/tab
    this.notifyListeners(event);

    // 2. Broadcast to other tabs/windows via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(event);
      } catch (err) {
        console.warn('[EventBus] Failed to postMessage on BroadcastChannel', err);
      }
    }

    // 3. Update localStorage for cross-tab storage event triggers
    try {
      localStorage.setItem(STORAGE_EVENT_KEY, JSON.stringify(event));
    } catch {
      // ignore quota errors
    }
  }

  public subscribe(handler: EventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public subscribeTo<T extends GrabCodeEventType>(
    eventType: T,
    handler: (event: Extract<GrabCodeEvent, { type: T }>) => void
  ): () => void {
    const filterHandler: EventHandler = (event) => {
      if (event.type === eventType) {
        handler(event as Extract<GrabCodeEvent, { type: T }>);
      }
    };
    return this.subscribe(filterHandler);
  }
}

// Singleton instance
export const eventBus = new CrossAppEventBus();
