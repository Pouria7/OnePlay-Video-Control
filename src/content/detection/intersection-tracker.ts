/**
 * Viewport Intersection Tracker using a shared IntersectionObserver
 */

import { calculateViewportIntersectionRatio } from '../../utils/geometry';

export type IntersectionChangeCallback = (ratio: number, entry: IntersectionObserverEntry | null) => void;

export class IntersectionTracker {
  private observer: IntersectionObserver | null = null;
  private callbacks = new Map<HTMLVideoElement, IntersectionChangeCallback>();

  constructor() {
    if (typeof IntersectionObserver !== 'undefined') {
      const thresholds = [0, 0.1, 0.25, 0.5, 0.7, 0.8, 0.9, 1.0];
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const video = entry.target as HTMLVideoElement;
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
      callback(ratio, null);
    }
  }

  /**
   * Stops tracking intersection for a video element
   */
  unobserve(video: HTMLVideoElement): void {
    this.callbacks.delete(video);
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
  }
}

export const intersectionTracker = new IntersectionTracker();
