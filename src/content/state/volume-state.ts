/**
 * Volume State Store
 *
 * Single source of truth for a controller's volume / mute state.
 * Refactored to delegate core guard-window and echo-suppression
 * to the generic GuardedState<T> store.
 */

import { ChangeSource } from '../adapters/action-types';
import { GuardedState } from './guarded-state';

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

export type VolumeChangeSource = ChangeSource;
export type VolumeListener = (snapshot: VolumeSnapshot, source: VolumeChangeSource) => void;

const EPSILON = 0.001;

export const clampVolume = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, Math.round(v * 1000) / 1000));
};

export const isSilent = (s: VolumeSnapshot): boolean => s.muted || s.volume <= EPSILON;

export const sameSnapshot = (a: VolumeSnapshot, b: VolumeSnapshot): boolean =>
  a.muted === b.muted && Math.abs(a.volume - b.volume) <= EPSILON;

export class VolumeState {
  private readonly video: HTMLVideoElement;
  private readonly defaultUnmuteVolume: number;
  private readonly guarded: GuardedState<VolumeSnapshot>;
  private lastAudibleVolume: number;

  constructor(video: HTMLVideoElement, options: VolumeStateOptions = {}) {
    this.video = video;
    this.defaultUnmuteVolume = options.defaultUnmuteVolume ?? 0.5;

    const readVideo = (): VolumeSnapshot => ({
      volume: clampVolume(this.video.volume),
      muted: this.video.muted
    });

    const applyToVideo = (state: VolumeSnapshot): void => {
      try {
        if (Math.abs(this.video.volume - state.volume) > EPSILON) {
          this.video.volume = state.volume;
        }
        if (this.video.muted !== state.muted) {
          this.video.muted = state.muted;
        }
        if (!state.muted) {
          this.video.removeAttribute('muted');
        }
      } catch (err) {
        console.warn('[UFVC VolumeState] Could not apply volume:', err);
      }
    };

    const initial = readVideo();
    this.lastAudibleVolume = initial.volume > EPSILON ? initial.volume : this.defaultUnmuteVolume;

    this.guarded = new GuardedState<VolumeSnapshot>({
      readFromDom: readVideo,
      applyToDom: applyToVideo,
      isEqual: (a, b) => sameSnapshot(a, b),
      shouldRevertExternal: (userState, domState) => !isSilent(userState) && isSilent(domState),
      guardWindowMs: options.guardWindowMs ?? 2000,
      maxReapplies: options.maxReapplies ?? 5,
      now: options.now
    });

    this.guarded.subscribe((state) => {
      if (state.volume > EPSILON) {
        this.lastAudibleVolume = state.volume;
      }
    });
  }

  // ─── Read API ─────────────────────────────────────────────────────────

  get snapshot(): VolumeSnapshot {
    return this.guarded.snapshot;
  }

  get volume(): number {
    return this.guarded.snapshot.volume;
  }

  get muted(): boolean {
    return this.guarded.snapshot.muted;
  }

  /** True when no audio is audible (muted or volume 0). */
  get isSilent(): boolean {
    return isSilent(this.guarded.snapshot);
  }

  subscribe(listener: VolumeListener): () => void {
    return this.guarded.subscribe(listener);
  }

  // ─── User intents ─────────────────────────────────────────────────────

  /** Sets the volume; 0 mutes, anything above 0 unmutes. */
  setVolume(volume: number): void {
    const v = clampVolume(volume);
    this.guarded.commitUser({ volume: v, muted: v <= EPSILON });
  }

  /** Changes the volume by a relative delta (e.g. keyboard shortcuts). */
  adjustVolume(delta: number): void {
    const base = this.guarded.snapshot.muted ? 0 : this.guarded.snapshot.volume;
    this.setVolume(Math.round((base + delta) * 100) / 100);
  }

  setMuted(muted: boolean): void {
    if (!muted && this.guarded.snapshot.volume <= EPSILON) {
      this.guarded.commitUser({ volume: this.lastAudibleVolume, muted: false });
      return;
    }
    this.guarded.commitUser({ volume: this.guarded.snapshot.volume, muted });
  }

  toggleMute(): void {
    this.setMuted(!this.isSilent);
  }

  // ─── Media synchronization ────────────────────────────────────────────

  /**
   * Must be called for every `volumechange` of the video, regardless of origin.
   */
  handleMediaVolumeChange(): void {
    this.guarded.handleDomEvent();
  }

  /** Re-applies the current state to the video (e.g. after a source swap). */
  reapply(): void {
    this.guarded.reapply();
  }
}
