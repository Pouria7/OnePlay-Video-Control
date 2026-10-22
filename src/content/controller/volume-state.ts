/**
 * Volume State Store
 *
 * Single source of truth for a controller's volume / mute state.
 *
 * Why this exists:
 * Some sites (notably YouTube preview cards) forcefully reset `volume`/`muted`
 * right after the user changes them, and site adapters may swallow
 * `volumechange` events with `stopImmediatePropagation()` to fight that.
 * Relying on the media element's events alone therefore leaves the controller
 * UI out of sync and lets the page silently override the user's choice.
 *
 * How it works:
 * 1. User interactions (slider, mute button, shortcuts, context menu) write to
 *    the internal state first, notify subscribers (UI updates immediately),
 *    and then apply the values to the video element.
 * 2. Every `volumechange` is routed through `handleMediaVolumeChange()`:
 *    - echoes of our own writes are ignored;
 *    - a page attempt to silence the video shortly after an explicit user
 *      choice is reverted (bounded, no polling);
 *    - any other external change is adopted as the new state.
 */

export interface VolumeSnapshot {
  readonly volume: number;
  readonly muted: boolean;
}

export interface VolumeStateOptions {
  /** How long after a user change external "silencing" is reverted (ms). */
  guardWindowMs?: number;
  /** Max number of reverts per guard window (prevents fight loops). */
  maxReapplies?: number;
  /** Volume restored when unmuting a video whose volume is 0. */
  defaultUnmuteVolume?: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

export type VolumeChangeSource = 'user' | 'external';
export type VolumeListener = (snapshot: VolumeSnapshot, source: VolumeChangeSource) => void;

const EPSILON = 0.001;

const clampVolume = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, Math.round(v * 1000) / 1000));
};

const isSilent = (s: VolumeSnapshot): boolean => s.muted || s.volume <= EPSILON;

const sameSnapshot = (a: VolumeSnapshot, b: VolumeSnapshot): boolean =>
  a.muted === b.muted && Math.abs(a.volume - b.volume) <= EPSILON;

export class VolumeState {
  private readonly video: HTMLVideoElement;
  private readonly guardWindowMs: number;
  private readonly maxReapplies: number;
  private readonly defaultUnmuteVolume: number;
  private readonly now: () => number;

  private state: VolumeSnapshot;
  private lastAudibleVolume: number;
  private lastUserChangeAt = Number.NEGATIVE_INFINITY;
  private reapplyCount = 0;
  private listeners = new Set<VolumeListener>();

  constructor(video: HTMLVideoElement, options: VolumeStateOptions = {}) {
    this.video = video;
    this.guardWindowMs = options.guardWindowMs ?? 2000;
    this.maxReapplies = options.maxReapplies ?? 5;
    this.defaultUnmuteVolume = options.defaultUnmuteVolume ?? 0.5;
    this.now = options.now ?? (() => Date.now());

    this.state = this.readVideo();
    this.lastAudibleVolume = this.state.volume > EPSILON ? this.state.volume : this.defaultUnmuteVolume;
  }

  // ─── Read API ─────────────────────────────────────────────────────────

  get snapshot(): VolumeSnapshot {
    return this.state;
  }

  get volume(): number {
    return this.state.volume;
  }

  get muted(): boolean {
    return this.state.muted;
  }

  /** True when no audio is audible (muted or volume 0). */
  get isSilent(): boolean {
    return isSilent(this.state);
  }

  subscribe(listener: VolumeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ─── User intents ─────────────────────────────────────────────────────

  /** Sets the volume; 0 mutes, anything above 0 unmutes. */
  setVolume(volume: number): void {
    const v = clampVolume(volume);
    this.commitUser({ volume: v, muted: v <= EPSILON });
  }

  /** Changes the volume by a relative delta (e.g. keyboard shortcuts). */
  adjustVolume(delta: number): void {
    const base = this.state.muted ? 0 : this.state.volume;
    this.setVolume(Math.round((base + delta) * 100) / 100);
  }

  setMuted(muted: boolean): void {
    if (!muted && this.state.volume <= EPSILON) {
      this.commitUser({ volume: this.lastAudibleVolume, muted: false });
      return;
    }
    this.commitUser({ volume: this.state.volume, muted });
  }

  toggleMute(): void {
    this.setMuted(!this.isSilent);
  }

  // ─── Media synchronization ────────────────────────────────────────────

  /**
   * Must be called for every `volumechange` of the video, regardless of origin.
   */
  handleMediaVolumeChange(): void {
    const actual = this.readVideo();
    if (sameSnapshot(actual, this.state)) return; // echo of our own write

    const withinGuard = this.now() - this.lastUserChangeAt <= this.guardWindowMs;
    const pageSilencedUserChoice = !isSilent(this.state) && isSilent(actual);

    if (withinGuard && pageSilencedUserChoice && this.reapplyCount < this.maxReapplies) {
      this.reapplyCount++;
      this.applyToVideo();
      return;
    }

    this.setState(actual, 'external');
  }

  /** Re-applies the current state to the video (e.g. after a source swap). */
  reapply(): void {
    this.applyToVideo();
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private commitUser(next: VolumeSnapshot): void {
    this.lastUserChangeAt = this.now();
    this.reapplyCount = 0;
    this.setState(next, 'user');
    this.applyToVideo();
  }

  private setState(next: VolumeSnapshot, source: VolumeChangeSource): void {
    this.state = { volume: clampVolume(next.volume), muted: next.muted };
    if (this.state.volume > EPSILON) this.lastAudibleVolume = this.state.volume;
    this.listeners.forEach((fn) => {
      try {
        fn(this.state, source);
      } catch (err) {
        console.error('[UFVC VolumeState] Listener error:', err);
      }
    });
  }

  private applyToVideo(): void {
    try {
      if (Math.abs(this.video.volume - this.state.volume) > EPSILON) {
        this.video.volume = this.state.volume;
      }
      if (this.video.muted !== this.state.muted) {
        this.video.muted = this.state.muted;
      }
      if (!this.state.muted) this.video.removeAttribute('muted');
    } catch (err) {
      console.warn('[UFVC VolumeState] Could not apply volume:', err);
    }
  }

  private readVideo(): VolumeSnapshot {
    return { volume: clampVolume(this.video.volume), muted: this.video.muted };
  }
}
