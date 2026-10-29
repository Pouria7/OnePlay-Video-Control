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
  private cleanupListeners: Array<() => void> = [];

  constructor(callbacks: VideoObserverCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Starts observing the DOM for video additions, removals, and media lifecycle activity
   */
  start(): void {
    // 1. Initial scan of existing videos
    this.scanInitialVideos();

    // 2. Attach MutationObserver
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      this.observer = new MutationObserver((mutations) => {
        const addedVideos = new Set<HTMLVideoElement>();
        const removedVideos = new Set<HTMLVideoElement>();

        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            // Collect added videos
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el instanceof HTMLVideoElement) {
                  addedVideos.add(el);
                } else if (el.querySelectorAll) {
                  const videos = el.querySelectorAll<HTMLVideoElement>('video');
                  videos.forEach((v) => addedVideos.add(v));
                }
              }
            }

            // Collect removed videos
            for (let i = 0; i < mutation.removedNodes.length; i++) {
              const node = mutation.removedNodes[i];
              if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el instanceof HTMLVideoElement) {
                  removedVideos.add(el);
                } else if (el.querySelectorAll) {
                  const videos = el.querySelectorAll<HTMLVideoElement>('video');
                  videos.forEach((v) => removedVideos.add(v));
                }
              }
            }
          }
        }

        // Only report removal if the video is actually disconnected from the DOM.
        // If it is still connected, it was re-parented/moved (e.g. YouTube Shorts reel swap)
        // and must be treated as added/updated rather than removed.
        for (const video of removedVideos) {
          if (!video.isConnected) {
            this.callbacks.onVideoRemoved(video);
          } else {
            addedVideos.add(video);
          }
        }

        for (const video of addedVideos) {
          if (video.isConnected) {
            this.callbacks.onVideoAdded(video);
          }
        }
      });

      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    // 3. Capture-phase media lifecycle listeners on document:
    // Guarantees detection even when a <video> is recycled, moved across containers,
    // or activated asynchronously after DOM insertion without extra childList mutations.
    if (typeof document !== 'undefined') {
      const handleCaptureMedia = (e: Event) => {
        const target = e.target;
        if (target instanceof HTMLVideoElement && target.isConnected) {
          this.callbacks.onVideoAdded(target);
        }
      };

      const mediaEvents = ['play', 'playing', 'loadedmetadata', 'canplay'];
      for (const evt of mediaEvents) {
        document.addEventListener(evt, handleCaptureMedia, { capture: true, passive: true });
        this.cleanupListeners.push(() =>
          document.removeEventListener(evt, handleCaptureMedia, { capture: true })
        );
      }
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
   * Disconnects the MutationObserver and cleans up capture listeners
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.cleanupListeners.forEach((fn) => fn());
    this.cleanupListeners = [];
  }
}
