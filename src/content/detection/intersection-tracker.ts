/**
 * Viewport Intersection Tracker using a shared IntersectionObserver
 */

import { calculateViewportIntersectionRatio } from '../../utils/geometry';

export type IntersectionChangeCallback = (ratio: number, entry: IntersectionObserverEntry | null) => void;

interface TrackedIntersectionState {
  ratio: number;
  entry: IntersectionObserverEntry | null;
}

export class IntersectionTracker {
  private observer: IntersectionObserver | null = null;
  private callbacks = new Map<HTMLVideoElement, IntersectionChangeCallback>();
  private states = new Map<HTMLVideoElement, TrackedIntersectionState>();

  constructor() {
    if (typeof IntersectionObserver !== 'undefined') {
      const thresholds = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const video = entry.target as HTMLVideoElement;
            this.states.set(video, { ratio: entry.intersectionRatio, entry });
            const cb = this.callbacks.get(video);
            if (cb) {
              cb(entry.intersectionRatio, entry);
            }
          }
        },
        { threshold: thresholds }
      );
    }
  }

  /**
   * Starts tracking intersection for a video element
   */
  observe(video: HTMLVideoElement, callback: IntersectionChangeCallback): void {
    this.callbacks.set(video, callback);
    if (this.observer) {
      this.observer.observe(video);
    } else {
      // Fallback calculation for environments without IntersectionObserver
      const rect = video.getBoundingClientRect();
      const ratio = calculateViewportIntersectionRatio(rect);
      this.states.set(video, { ratio, entry: null });
      callback(ratio, null);
    }
  }

  /**
   * Returns the most recent intersection ratio calculated by IntersectionObserver,
   * which naturally accounts for parent overflow:hidden, clip-path, and carousels.
   */
  getRatio(video: HTMLVideoElement): number | undefined {
    return this.states.get(video)?.ratio;
  }

  /**
   * Returns the most recent intersectionRect (visible box inside parent clippings/viewport)
   */
  getIntersectionRect(video: HTMLVideoElement): DOMRectReadOnly | null {
    return this.states.get(video)?.entry?.intersectionRect ?? null;
  }

  /**
   * Stops tracking intersection for a video element
   */
  unobserve(video: HTMLVideoElement): void {
    this.callbacks.delete(video);
    this.states.delete(video);
    if (this.observer) {
      this.observer.unobserve(video);
    }
  }

  /**
   * Cleans up the observer completely
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.callbacks.clear();
    this.states.clear();
  }
}

export const intersectionTracker = new IntersectionTracker();
