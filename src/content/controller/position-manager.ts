/**
 * Position Manager
 *
 * Tracks the target video's bounding rectangle and updates the fixed-position coordinates
 * of the floating controller, throttled to requestAnimationFrame.
 *
 * Includes periodic position verification and mousemove tracking to handle
 * dynamically moved videos (e.g. YouTube moving single preview element across horizontal cards).
 */

import { calculateControllerPosition, PositionCoordinates } from '../../utils/geometry';
import { rafThrottle } from '../../utils/throttle';
import { ResolvedConfig } from '../../storage/types';

export class PositionManager {
  private video: HTMLVideoElement;
  private hostElement: HTMLElement;
  private containerElement: HTMLElement;
  private config: ResolvedConfig;
  private cleanupListeners: Array<() => void> = [];
  private isDestroyed = false;

  private lastLeft = -1;
  private lastTop = -1;
  private lastWidth = -1;
  private lastHeight = -1;

  constructor(
    video: HTMLVideoElement,
    hostElement: HTMLElement,
    containerElement: HTMLElement,
    config: ResolvedConfig
  ) {
    this.video = video;
    this.hostElement = hostElement;
    this.containerElement = containerElement;
    this.config = config;

    this.attachListeners();
    this.updatePosition();
    this.startPeriodicPositionCheck();
  }

  /**
   * Updates configuration and recalculates position
   */
  updateConfig(newConfig: ResolvedConfig): void {
    this.config = newConfig;
    this.updatePosition();
  }

  /**
   * Recalculates and applies fixed position coordinates
   */
  updatePosition = rafThrottle((): void => {
    if (this.isDestroyed || !this.video.isConnected) return;

    const videoRect = this.video.getBoundingClientRect();
    this.lastLeft = videoRect.left;
    this.lastTop = videoRect.top;
    this.lastWidth = videoRect.width;
    this.lastHeight = videoRect.height;

    // Adapt layout mode and dimensions
    const isMinimal = this.config.controlsLayout === 'minimal';
    this.containerElement.classList.toggle('minimal-mode', isMinimal);

    let controllerWidth: number;
    let controllerHeight: number;

    if (isMinimal) {
      this.containerElement.classList.remove('two-row');
      controllerWidth = 136;
      controllerHeight = 34;
    } else {
      const isNarrow = videoRect.width < 340;
      this.containerElement.classList.toggle('two-row', isNarrow);
      controllerWidth = 390;
      controllerHeight = isNarrow ? 62 : 44;
    }

    const pos: PositionCoordinates = calculateControllerPosition(
      videoRect,
      controllerWidth,
      controllerHeight,
      10,
      this.config.controllerPosition
    );

    if (!pos.visible) {
      this.hostElement.style.opacity = '0';
      this.hostElement.style.pointerEvents = 'none';
      return;
    }

    this.hostElement.style.left = `${pos.left}px`;
    this.hostElement.style.top = `${pos.top}px`;
    this.hostElement.style.width = `${pos.width}px`;
    this.hostElement.style.height = `${pos.height}px`;
    this.hostElement.style.opacity = '1';
    this.hostElement.style.pointerEvents = 'auto';
  });

  private attachListeners(): void {
    const handleUpdate = () => {
      this.updatePosition();
    };

    window.addEventListener('scroll', handleUpdate, { passive: true, capture: true });
    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('mousemove', handleUpdate, { passive: true });
    document.addEventListener('fullscreenchange', handleUpdate, { passive: true });

    this.cleanupListeners.push(() => {
      window.removeEventListener('scroll', handleUpdate, { capture: true });
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('mousemove', handleUpdate);
      document.removeEventListener('fullscreenchange', handleUpdate);
    });
  }

  /**
   * Periodic check to detect position changes when element is moved via JavaScript/CSS transforms
   * without scrolling (e.g. YouTube moving single preview card or carousel sliding).
   */
  private startPeriodicPositionCheck(): void {
    const intervalId = setInterval(() => {
      if (this.isDestroyed || !this.video.isConnected) return;

      const r = this.video.getBoundingClientRect();
      if (
        Math.abs(r.left - this.lastLeft) > 1 ||
        Math.abs(r.top - this.lastTop) > 1 ||
        Math.abs(r.width - this.lastWidth) > 1 ||
        Math.abs(r.height - this.lastHeight) > 1
      ) {
        this.updatePosition();
      }
    }, 250);

    this.cleanupListeners.push(() => clearInterval(intervalId));
  }

  /**
   * Destroys position tracking and cleans up listeners
   */
  destroy(): void {
    this.isDestroyed = true;
    this.cleanupListeners.forEach((fn) => fn());
    this.cleanupListeners = [];
  }
}
