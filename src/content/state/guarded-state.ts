import { ChangeSource } from '../adapters/action-types';

export interface GuardedStateOptions<T> {
  readFromDom: () => T;
  applyToDom: (state: T) => void;
  isEqual: (a: T, b: T) => boolean;
  /**
   * Return true if an external DOM change shortly after a user change should be reverted
   * (e.g., site forcefully muting audio or resetting playbackRate to 1.0).
   */
  shouldRevertExternal?: (userState: T, domState: T) => boolean;
  guardWindowMs?: number;
  maxReapplies?: number;
  now?: () => number;
}

export type StateChangeListener<T> = (snapshot: T, source: ChangeSource) => void;

export class GuardedState<T> {
  private state: T;
  private lastUserChangeAt = Number.NEGATIVE_INFINITY;
  private reapplyCount = 0;
  private readonly guardWindowMs: number;
  private readonly maxReapplies: number;
  private readonly now: () => number;
  private listeners = new Set<StateChangeListener<T>>();

  constructor(private readonly options: GuardedStateOptions<T>) {
    this.guardWindowMs = options.guardWindowMs ?? 2000;
    this.maxReapplies = options.maxReapplies ?? 5;
    this.now = options.now ?? (() => Date.now());
    this.state = this.options.readFromDom();
  }

  get snapshot(): T {
    return this.state;
  }

  subscribe(listener: StateChangeListener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  commitUser(next: T): void {
    this.lastUserChangeAt = this.now();
    this.reapplyCount = 0;
    this.setState(next, 'user');
    this.options.applyToDom(this.state);
  }

  handleDomEvent(): void {
    const actual = this.options.readFromDom();
    if (this.options.isEqual(actual, this.state)) {
      return; // Ignore echo of our own write
    }

    const withinGuard = this.now() - this.lastUserChangeAt <= this.guardWindowMs;
    const shouldRevert = this.options.shouldRevertExternal?.(this.state, actual) ?? false;

    if (withinGuard && shouldRevert && this.reapplyCount < this.maxReapplies) {
      this.reapplyCount++;
      this.options.applyToDom(this.state);
      return;
    }

    this.setState(actual, 'external');
  }

  reapply(): void {
    this.options.applyToDom(this.state);
  }

  private setState(next: T, source: ChangeSource): void {
    this.state = next;
    this.listeners.forEach((fn) => {
      try {
        fn(this.state, source);
      } catch (err) {
        console.error('[UFVC GuardedState] Listener error:', err);
      }
    });
  }
}
