/**
 * Controller Manager: Coordinates multiple active floating controller instances
 */

import { VideoController } from './video-controller';
import { TrackedVideo } from '../detection/types';
import { ResolvedConfig } from '../../storage/types';

export class ControllerManager {
  private controllers = new Map<HTMLVideoElement, VideoController>();
  private currentConfig: ResolvedConfig;
  private onHoverCallback?: (video: HTMLVideoElement, isHovered: boolean, host: HTMLElement) => void;

  constructor(
    initialConfig: ResolvedConfig,
    onHover?: (video: HTMLVideoElement, isHovered: boolean, host: HTMLElement) => void
  ) {
    this.currentConfig = initialConfig;
    this.onHoverCallback = onHover;
  }

  /**
   * Syncs active controllers with the newly selected active candidates.
   * Creates new controllers for newly active videos, and tears down
   * controllers for videos that are no longer active.
   */
  syncActiveVideos(activeVideos: TrackedVideo[], config: ResolvedConfig): void {
    this.currentConfig = config;

    if (!config.enabled) {
      this.destroyAll();
      return;
    }

    const activeSet = new Set<HTMLVideoElement>();
    activeVideos.forEach((c) => activeSet.add(c.element));

    // 1. Remove controllers for videos that are no longer active
    for (const [video, controller] of Array.from(this.controllers.entries())) {
      if (!activeSet.has(video) || !video.isConnected) {
        controller.destroy();
        this.controllers.delete(video);
      }
    }

    // 2. Create controllers for newly active videos
    for (const candidate of activeVideos) {
      if (!this.controllers.has(candidate.element) && candidate.element.isConnected) {
        const controller = new VideoController(
          candidate.id,
          candidate.element,
          config,
          this.onHoverCallback
        );
        this.controllers.set(candidate.element, controller);
      }
    }
  }

  /**
   * Updates configuration across all active controllers
   */
  updateConfig(newConfig: ResolvedConfig): void {
    this.currentConfig = newConfig;
    if (!newConfig.enabled) {
      this.destroyAll();
      return;
    }

    for (const controller of this.controllers.values()) {
      controller.updateConfig(newConfig);
    }
  }

  /**
   * Removes and destroys a specific video controller
   */
  removeController(video: HTMLVideoElement): void {
    const controller = this.controllers.get(video);
    if (controller) {
      controller.destroy();
      this.controllers.delete(video);
    }
  }

  /**
   * Repositions all active controllers
   */
  repositionAll(): void {
    for (const controller of this.controllers.values()) {
      controller.reposition();
    }
  }

  /**
   * Returns controller for a specific video element
   */
  getController(video: HTMLVideoElement): VideoController | undefined {
    return this.controllers.get(video);
  }

  /**
   * Returns all active controllers
   */
  getAllControllers(): VideoController[] {
    return Array.from(this.controllers.values());
  }

  /**
   * Returns the count of active controllers
   */
  activeCount(): number {
    return this.controllers.size;
  }

  getCurrentConfig(): ResolvedConfig {
    return this.currentConfig;
  }

  /**
   * Destroys all active controllers immediately
   */
  destroyAll(): void {
    for (const controller of this.controllers.values()) {
      controller.destroy();
    }
    this.controllers.clear();
  }
}
