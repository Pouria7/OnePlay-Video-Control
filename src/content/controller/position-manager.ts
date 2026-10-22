/**
 * Position Manager
 *
 * Tracks the target video's bounding rectangle and updates the fixed-position coordinates
 * of the floating controller, throttled to requestAnimationFrame.
 *
 * Includes periodic position verification and mousemove tracking to handle
 * dynamically moved videos (e.g. YouTube moving single preview element across horizontal cards).
 *
 * Also owns the manual drag offset: the user can move the controller relative to
 * its docked position. The offset is session-only (per controller instance) and is
 * always clamped to video-relative bounds (see `calculateDragBounds`).
 */

import {
  applyDragOffset,
  calculateControllerPosition,
  DragOffset,
  PositionCoordinates
} from '../../utils/geometry';
import { rafThrottle } from '../../utils/throttle';
import { ResolvedConfig } from '../../storage/types';

const DOCK_MARGIN = 10;
const POPUPS_DOWN_THRESHOLD = 250;

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

  /** Requested manual offset relative to the dock. */
  private dragOffset: DragOffset = { dx: 0, dy: 0 };
  /** Last docked (un-dragged) and final applied coordinates. */
  private lastDock: PositionCoordinates | null = null;
  private lastApplied: PositionCoordinates | null = null;

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
    const dockChanged =
      newConfig.controllerPosition !== this.config.controllerPosition ||
      newConfig.controlsLayout !== this.config.controlsLayout;
    this.config = newConfig;
    if (dockChanged) this.dragOffset = { dx: 0, dy: 0 };
    this.updatePosition();
  }

  // ─── Drag offset API ──────────────────────────────────────────────────

  /**
   * Offset that is actually applied right now (after clamping). Use this as the
   * starting point of a new drag so stale, clamped offsets never feel "sticky".
   */
  getEffectiveOffset(): DragOffset {
    if (!this.lastDock || !this.lastApplied) return { ...this.dragOffset };
    return {
      dx: this.lastApplied.left - this.lastDock.left,
      dy: this.lastApplied.top - this.lastDock.top
    };
  }

  setDragOffset(offset: DragOffset): void {
    this.dragOffset = { dx: offset.dx, dy: offset.dy };
    this.applyPosition();
  }

  resetDragOffset(): void {
    this.setDragOffset({ dx: 0, dy: 0 });
  }

  hasDragOffset(): boolean {
    return this.dragOffset.dx !== 0 || this.dragOffset.dy !== 0;
  }

  // ─── Positioning ──────────────────────────────────────────────────────

  /**
   * Recalculates and applies fixed position coordinates (rAF-throttled).
   */
  updatePosition = rafThrottle((): void => {
    this.applyPosition();
  });

  private applyPosition(): void {
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
      controllerWidth = 118;
      controllerHeight = 34;
    } else {
      const isNarrow = videoRect.width < 340;
      this.containerElement.classList.toggle('two-row', isNarrow);
      controllerWidth = 404;
      controllerHeight = isNarrow ? 62 : 44;
    }

    const dock: PositionCoordinates = calculateControllerPosition(
      videoRect,
      controllerWidth,
      controllerHeight,
      DOCK_MARGIN,
      this.config.controllerPosition
    );

    if (!dock.visible) {
      this.lastDock = this.lastApplied = null;
      this.hostElement.style.opacity = '0';
      this.hostElement.style.pointerEvents = 'none';
      return;
    }

    const pos = applyDragOffset(videoRect, dock, this.dragOffset, this.config.controllerPosition);
    this.lastDock = dock;
    this.lastApplied = pos;

    this.hostElement.style.left = `${pos.left}px`;
    this.hostElement.style.top = `${pos.top}px`;
    this.hostElement.style.width = `${pos.width}px`;
    this.hostElement.style.height = `${pos.height}px`;
    this.hostElement.style.opacity = '1';
    this.hostElement.style.pointerEvents = 'none';

    // Show volume slider & speed menu downward when near top of viewport
    this.containerElement.classList.toggle('popups-down', pos.top < POPUPS_DOWN_THRESHOLD);
  }

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
