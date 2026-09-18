/**
 * DOM Mutation Observer for Video Elements
 *
 * Efficiently discovers initial and dynamically inserted/removed <video> elements
 * without scanning the entire DOM continuously.
 */

export interface VideoObserverCallbacks {
  onVideoAdded: (video: HTMLVideoElement) => void;
  onVideoRemoved: (video: HTMLVideoElement) => void;
}

export class VideoObserver {
  private observer: MutationObserver | null = null;
  private callbacks: VideoObserverCallbacks;
  private isScanning = false;

  constructor(callbacks: VideoObserverCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Starts observing the DOM for video additions and removals
   */
  start(): void {
    // 1. Initial scan of existing videos
    this.scanInitialVideos();

    // 2. Attach MutationObserver
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            // Process added nodes
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el instanceof HTMLVideoElement) {
                  this.callbacks.onVideoAdded(el);
                } else if (el.querySelectorAll) {
                  const videos = el.querySelectorAll<HTMLVideoElement>('video');
                  videos.forEach((v) => this.callbacks.onVideoAdded(v));
                }
              }
            }

            // Process removed nodes
            for (let i = 0; i < mutation.removedNodes.length; i++) {
              const node = mutation.removedNodes[i];
              if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el instanceof HTMLVideoElement) {
                  this.callbacks.onVideoRemoved(el);
                } else if (el.querySelectorAll) {
                  const videos = el.querySelectorAll<HTMLVideoElement>('video');
                  videos.forEach((v) => this.callbacks.onVideoRemoved(v));
                }
              }
            }
          }
        }
      });

      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  /**
   * Scans for existing video elements in document
   */
  scanInitialVideos(): void {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const existingVideos = document.querySelectorAll<HTMLVideoElement>('video');
      existingVideos.forEach((v) => {
        this.callbacks.onVideoAdded(v);
      });
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Disconnects the MutationObserver
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
