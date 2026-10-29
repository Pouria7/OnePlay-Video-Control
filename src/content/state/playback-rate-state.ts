/**
 * Playback Rate State Store
 *
 * Single source of truth for a controller's playback rate (`video.playbackRate`).
 * Implements GuardedState<number> to protect against host sites forcefully resetting
 * speed to 1.0, and supports per-site Constant Speed mode (locking and persisting
 * the user's chosen speed across video transitions and external rate changes).
 */

import { ChangeSource } from '../adapters/action-types';
import { GuardedState } from './guarded-state';

export interface PlaybackRateOptions {
  /** Initial persisted speed to apply when `constantSpeed` is enabled. */
  initialRate?: number;
  /** Whether Constant Speed lock is enabled for this site. */
  constantSpeed?: boolean;
  /** Callback invoked when the user sets a new speed while Constant Speed is enabled. */
  onPersistRate?: (rate: number) => void;
  guardWindowMs?: number;
  maxReapplies?: number;
  now?: () => number;
}

export type PlaybackRateListener = (rate: number, source: ChangeSource) => void;

const EPSILON = 0.001;

export const clampPlaybackRate = (rate: number): number => {
  if (!Number.isFinite(rate) || rate <= 0) return 1.0;
  return Math.min(16, Math.max(0.1, Math.round(rate * 100) / 100));
};

export class PlaybackRateState {
  private readonly guarded: GuardedState<number>;
  private isConstantSpeed: boolean;
  private hasUserCommitted = false;
  private onPersistRate?: (rate: number) => void;

  constructor(
    private readonly video: HTMLVideoElement,
    options: PlaybackRateOptions = {}
  ) {
    this.isConstantSpeed = Boolean(options.constantSpeed);
    this.onPersistRate = options.onPersistRate;

    this.guarded = new GuardedState<number>({
      readFromDom: () => clampPlaybackRate(this.video.playbackRate || 1),
      applyToDom: (rate) => {
        try {
          if (Math.abs(this.video.playbackRate - rate) > EPSILON) {
            this.video.playbackRate = rate;
          }
        } catch (err) {
          console.warn('[UFVC PlaybackRateState] Could not apply rate:', err);
        }
      },
      isEqual: (a, b) => Math.abs(a - b) <= EPSILON,
      alwaysGuard: () => this.isConstantSpeed,
      shouldRevertExternal: (userState, domState) => {
        if (Math.abs(userState - domState) <= EPSILON) return false;
        // In Constant Speed mode, override ANY external speed change back to user's chosen speed
        if (this.isConstantSpeed) return true;
        // Otherwise, within the guard window after a user change, revert external resets to 1.0
        return Math.abs(domState - 1.0) <= EPSILON;
      },
      guardWindowMs: options.guardWindowMs ?? 2000,
      maxReapplies: options.maxReapplies ?? 8,
      now: options.now
    });

    if (this.isConstantSpeed && options.initialRate !== undefined && options.initialRate > 0) {
      this.hasUserCommitted = true;
      this.guarded.commitUser(clampPlaybackRate(options.initialRate));
    }
  }

  get rate(): number {
    return this.guarded.snapshot;
  }

  get constantSpeed(): boolean {
    return this.isConstantSpeed;
  }

  /**
   * Commits a user-initiated playback speed change, applies it to the DOM,
   * and persists it if Constant Speed mode is active.
   */
  setRate(rate: number): void {
    const clamped = clampPlaybackRate(rate);
    this.hasUserCommitted = true;
    this.guarded.commitUser(clamped);
    if (this.isConstantSpeed && this.onPersistRate) {
      this.onPersistRate(clamped);
    }
  }

  /**
   * Updates Constant Speed mode and optional persisted speed target at runtime.
   */
  setConstantSpeed(enabled: boolean, savedRate?: number): void {
    const wasEnabled = this.isConstantSpeed;
    this.isConstantSpeed = enabled;

    if (enabled) {
      const targetSaved = savedRate !== undefined && savedRate > 0 ? clampPlaybackRate(savedRate) : undefined;
      if (
        !wasEnabled &&
        this.hasUserCommitted &&
        Math.abs(this.rate - 1.0) > EPSILON &&
        (targetSaved === undefined || Math.abs(targetSaved - 1.0) <= EPSILON)
      ) {
        // User already changed speed on the active video before toggling Constant Speed on; persist current rate
        this.onPersistRate?.(this.rate);
        this.guarded.reapply();
      } else if (targetSaved !== undefined) {
        this.hasUserCommitted = true;
        if (Math.abs(this.rate - targetSaved) > EPSILON) {
          this.guarded.commitUser(targetSaved);
        } else {
          this.guarded.reapply();
        }
      }
    }
  }

  /**
   * Must be called on video `ratechange` events.
   */
  handleMediaRateChange(): void {
    this.guarded.handleDomEvent();
  }

  /**
   * Checks whether `video.playbackRate` matches the user/constant speed,
   * and re-applies it if the video or site reset it (e.g. on `play`, `loadedmetadata`, `canplay`).
   */
  reapply(): void {
    if (this.isConstantSpeed || this.hasUserCommitted) {
      this.guarded.reapply();
    }
  }

  subscribe(listener: PlaybackRateListener): () => void {
    return this.guarded.subscribe(listener);
  }
}
