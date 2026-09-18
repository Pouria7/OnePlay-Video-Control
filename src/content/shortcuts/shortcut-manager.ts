/**
 * Keyboard Shortcut Manager
 *
 * Handles global video control shortcuts (Space, Arrows, J, L) while strictly
 * guarding against interference when typing into inputs, textareas, contenteditable elements,
 * or when no active video is present.
 */

import { getDeepActiveElement, isEditableElement } from '../../utils/dom';
import { ControllerManager } from '../controller/controller-manager';

export interface ShortcutConfig {
  seekInterval: number;
}

export class ShortcutManager {
  private controllerManager: ControllerManager;
  private config: ShortcutConfig;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(controllerManager: ControllerManager, config: ShortcutConfig) {
    this.controllerManager = controllerManager;
    this.config = config;
  }

  /**
   * Updates shortcut configuration (e.g. seek interval)
   */
  updateConfig(config: Partial<ShortcutConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Starts listening for keyboard shortcuts
   */
  start(): void {
    if (this.keydownHandler) return;

    this.keydownHandler = (e: KeyboardEvent) => {
      // 1. Guard against active editable elements (input, textarea, contenteditable, etc.)
      const activeEl = getDeepActiveElement();
      if (isEditableElement(activeEl)) {
        return;
      }

      // 2. Ignore with modifier keys (Ctrl, Alt, Meta) to preserve OS/browser shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // 3. Find target active video controller
      const controllers = this.controllerManager.getAllControllers();
      if (controllers.length === 0) {
        return;
      }

      // Pick currently playing video, or first active controller
      const targetController =
        controllers.find((c) => !c.video.paused) || controllers[0];

      if (!targetController || !targetController.video.isConnected) {
        return;
      }

      const video = targetController.video;
      const seekSecs = this.config.seekInterval || 5;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          e.stopPropagation();
          if (video.paused) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
          break;

        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          e.stopPropagation();
          video.currentTime = Math.max(0, video.currentTime - seekSecs);
          break;

        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          e.stopPropagation();
          const dur = isFinite(video.duration) ? video.duration : Infinity;
          video.currentTime = Math.min(dur, video.currentTime + seekSecs);
          break;

        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          video.volume = Math.min(1, Math.round((video.volume + 0.1) * 10) / 10);
          video.muted = false;
          break;

        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          video.volume = Math.max(0, Math.round((video.volume - 0.1) * 10) / 10);
          if (video.volume === 0) {
            video.muted = true;
          }
          break;
      }
    };

    window.addEventListener('keydown', this.keydownHandler, { capture: true });
  }

  /**
   * Stops listening for keyboard shortcuts
   */
  stop(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler, { capture: true });
      this.keydownHandler = null;
    }
  }
}
