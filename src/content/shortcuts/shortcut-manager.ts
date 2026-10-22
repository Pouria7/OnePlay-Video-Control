/**
 * Keyboard Shortcut Manager
 *
 * Handles configurable global video control shortcuts (Space, Mute, Seek, Volume, Fullscreen)
 * with support for combination keys (Ctrl+M, Alt+Right, etc.), while strictly
 * guarding against interference when typing into inputs, textareas, contenteditable elements,
 * or when no active video is present.
 */

import { ShortcutsConfig } from '../../types';
import { DEFAULT_SHORTCUTS } from '../../storage/types';
import { getDeepActiveElement, isEditableElement } from '../../utils/dom';
import { matchesShortcut } from '../../utils/shortcuts';
import { ControllerManager } from '../controller/controller-manager';

export interface ShortcutConfig {
  seekInterval: number;
  shortcuts?: ShortcutsConfig;
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
   * Updates shortcut configuration (e.g. seek interval, custom shortcut bindings)
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

      const shortcuts = this.config.shortcuts || DEFAULT_SHORTCUTS;

      // Check if event matches any configured shortcut
      const isPlay = matchesShortcut(e, shortcuts.togglePlay);
      const isSeekBack = matchesShortcut(e, shortcuts.seekBackward) || (!shortcuts.seekBackward && (e.code === 'KeyJ' || e.code === 'ArrowLeft'));
      const isSeekFwd = matchesShortcut(e, shortcuts.seekForward) || (!shortcuts.seekForward && (e.code === 'KeyL' || e.code === 'ArrowRight'));
      const isVolUp = matchesShortcut(e, shortcuts.volumeUp);
      const isVolDown = matchesShortcut(e, shortcuts.volumeDown);
      const isMute = matchesShortcut(e, shortcuts.toggleMute);
      const isFullscreen = matchesShortcut(e, shortcuts.toggleFullscreen);

      if (!isPlay && !isSeekBack && !isSeekFwd && !isVolUp && !isVolDown && !isMute && !isFullscreen) {
        return;
      }

      // 2. Find target active video controller
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

      // Do not prevent default or stop propagation so that shortcuts work alongside
      // host site functionality (e.g. reels navigation on Instagram) instead of overriding it.

      if (isPlay) {
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      } else if (isSeekBack) {
        video.currentTime = Math.max(0, video.currentTime - seekSecs);
      } else if (isSeekFwd) {
        const dur = isFinite(video.duration) ? video.duration : Infinity;
        video.currentTime = Math.min(dur, video.currentTime + seekSecs);
      } else if (isVolUp) {
        if (targetController.getVolumeState) {
          targetController.getVolumeState().adjustVolume(0.1);
        } else {
          video.volume = Math.min(1, Math.round((video.volume + 0.1) * 10) / 10);
          video.muted = false;
        }
      } else if (isVolDown) {
        if (targetController.getVolumeState) {
          targetController.getVolumeState().adjustVolume(-0.1);
        } else {
          video.volume = Math.max(0, Math.round((video.volume - 0.1) * 10) / 10);
          if (video.volume === 0) video.muted = true;
        }
      } else if (isMute) {
        if (targetController.getVolumeState) {
          targetController.getVolumeState().toggleMute();
        } else {
          video.muted = !video.muted;
          if (!video.muted && video.volume === 0) video.volume = 0.5;
        }
      } else if (isFullscreen) {
        if (!document.fullscreenElement) {
          if (video.requestFullscreen) {
            video.requestFullscreen().catch(() => {});
          } else if ((video as any).webkitRequestFullscreen) {
            (video as any).webkitRequestFullscreen();
          }
        } else {
          document.exitFullscreen().catch(() => {});
        }
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
