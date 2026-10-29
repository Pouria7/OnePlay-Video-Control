/**
 * Playback Rate State Store
 *
 * Implements GuardedState<number> for video playback rate,
 * protecting against host sites forcefully resetting speed to 1.0.
 */

import { ChangeSource } from '../adapters/action-types';
import { GuardedState } from './guarded-state';

export interface PlaybackRateOptions {
  guardWindowMs?: number;
  maxReapplies?: number;
  now?: () => number;
}

export type PlaybackRateListener = (rate: number, source: ChangeSource) => void;

const EPSILON = 0.001;

export class PlaybackRateState {
  private readonly guarded: GuardedState<number>;

  constructor(
    private readonly video: HTMLVideoElement,
    options: PlaybackRateOptions = {}
  ) {
    this.guarded = new GuardedState<number>({
      readFromDom: () => this.video.playbackRate || 1,
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
      shouldRevertExternal: (userState, domState) =>
        Math.abs(userState - domState) > EPSILON && Math.abs(domState - 1.0) <= EPSILON,
      guardWindowMs: options.guardWindowMs ?? 2000,
      maxReapplies: options.maxReapplies ?? 5,
      now: options.now
    });
  }

  get rate(): number {
    return this.guarded.snapshot;
  }

  setRate(rate: number): void {
    this.guarded.commitUser(rate);
  }

  handleMediaRateChange(): void {
    this.guarded.handleDomEvent();
  }

  reapply(): void {
    this.guarded.reapply();
  }

  subscribe(listener: PlaybackRateListener): () => void {
    return this.guarded.subscribe(listener);
  }
}
