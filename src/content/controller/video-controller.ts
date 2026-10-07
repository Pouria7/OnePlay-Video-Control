/**
 * Video Controller Instance
 *
 * Coordinates UI interactions, video playback synchronization,
 * drag-to-seek, auto-hide timer, and theme styling for a single target video.
 *
 * Heavy lifting for download/recording is delegated to RecordingManager.
 */

import { createShadowUI, ShadowUIElements, ICONS } from './shadow-ui';
import { PositionManager } from './position-manager';
import { ResolvedConfig } from '../../storage/types';
import { themeEngine } from '../../themes/theme-engine';
import { formatTime } from '../../utils/dom';
import { RecordingManager } from './recording-manager';

/** CSS state classes toggled on shadow-UI elements. */
const CLASS = {
  IDLE: 'idle',
  OPEN: 'open',
  DRAGGING: 'dragging',
  ACTIVE: 'active',
  MINIMAL_MODE: 'minimal-mode',
  SPEED_ITEM: 'ufvc-speed-item',
  POPUPS_DOWN: 'popups-down',
} as const;

/** Selectors derived from the class names above. */
const SELECTOR = {
  SPEED_ITEM: `.${CLASS.SPEED_ITEM}`,
} as const;

/** Data attributes read from shadow-UI elements. */
const ATTR = {
  SPEED: 'data-speed',
} as const;

export class VideoController {
  readonly id: string;
  readonly video: HTMLVideoElement;

  private ui: ShadowUIElements;
  private positionManager: PositionManager;
  private config: ResolvedConfig;
  private isDestroyed = false;
  private isDraggingScrub = false;
  private autoHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private cleanupFns: Array<() => void> = [];
  private recording: RecordingManager;

  private onHoverCallback?: (video: HTMLVideoElement, isHovered: boolean, host: HTMLElement) => void;

  constructor(
    id: string,
    video: HTMLVideoElement,
    config: ResolvedConfig,
    onHover?: (video: HTMLVideoElement, isHovered: boolean, host: HTMLElement) => void
  ) {
    this.id = id;
    this.video = video;
    this.config = config;
    this.onHoverCallback = onHover;

    this.ui = createShadowUI();
    this.applyTheme(config.theme);
    (document.documentElement || document.body).appendChild(this.ui.host);

    this.positionManager = new PositionManager(video, this.ui.host, this.ui.container, this.config);

    this.recording = new RecordingManager(video, {
      onRecordingStart: () => this.handleRecordingStart(),
      onRecordingTick: (s) => this.handleRecordingTick(s),
      onRecordingEnd: () => this.handleRecordingEnd(),
      onFeedback: (msg) => this.showDownloadFeedback(msg),
    });

    this.bindVideoEvents();
    this.bindUIEvents();
    this.syncInitialState();
    this.resetAutoHideTimer();
  }

  applyTheme(themeId: string): void {
    this.config.theme = themeId;
    themeEngine.applyTheme(this.ui.container, themeId);
  }

  updateConfig(newConfig: ResolvedConfig): void {
    this.config = newConfig;
    this.applyTheme(newConfig.theme);
    this.setMinimalMode(newConfig.controlsLayout === 'minimal');
    this.positionManager.updateConfig(newConfig);
  }

  reposition(): void {
    this.positionManager.updatePosition();
  }

  private syncInitialState(): void {
    this.setMinimalMode(this.config.controlsLayout === 'minimal');
    this.updatePlayState();
    this.updateTimeDisplay();
    this.updateVolumeUI();
    this.updateSpeedUI();
  }

  // ─── UI state helpers (CSS class toggles) ─────────────────────────────

  /** Show the controls bar (removes the idle state). */
  private showControls(): void {
    this.ui.container.classList.remove(CLASS.IDLE);
  }

  /** Hide the controls bar (adds the idle state). */
  private hideControls(): void {
    this.ui.container.classList.add(CLASS.IDLE);
  }

  private setMinimalMode(enabled: boolean): void {
    this.ui.container.classList.toggle(CLASS.MINIMAL_MODE, enabled);
  }

  private setScrubbing(isScrubbing: boolean): void {
    this.isDraggingScrub = isScrubbing;
    this.ui.progressContainer.classList.toggle(CLASS.DRAGGING, isScrubbing);
  }

  // Speed menu
  private isSpeedMenuOpen(): boolean {
    return this.ui.speedMenu.classList.contains(CLASS.OPEN);
  }

  private openSpeedMenu(): void {
    this.ui.speedMenu.classList.add(CLASS.OPEN);
  }

  private closeSpeedMenu(): void {
    this.ui.speedMenu.classList.remove(CLASS.OPEN);
  }

  private toggleSpeedMenu(): void {
    if (!this.isSpeedMenuOpen()) {
      const barRect = this.ui.container.getBoundingClientRect();
      this.ui.container.classList.toggle(CLASS.POPUPS_DOWN, barRect.top < 250);
    }
    this.ui.speedMenu.classList.toggle(CLASS.OPEN);
  }

  // Context menu
  private isContextMenuOpen(): boolean {
    return this.ui.contextMenu.classList.contains(CLASS.OPEN);
  }

  private openContextMenu(): void {
    this.ui.contextMenu.classList.add(CLASS.OPEN);
  }

  private closeContextMenu(): void {
    this.ui.contextMenu.classList.remove(CLASS.OPEN);
  }

  // Both menus
  private isAnyMenuOpen(): boolean {
    return this.isSpeedMenuOpen() || this.isContextMenuOpen();
  }

  private closeAllMenus(): void {
    this.closeSpeedMenu();
    this.closeContextMenu();
  }

  // Speed items
  private getSpeedItems(): NodeListOf<HTMLButtonElement> {
    return this.ui.speedMenu.querySelectorAll<HTMLButtonElement>(SELECTOR.SPEED_ITEM);
  }

  private setSpeedItemActive(item: HTMLButtonElement, isActive: boolean): void {
    item.classList.toggle(CLASS.ACTIVE, isActive);
  }

  // ─── Video events ─────────────────────────────────────────────────────

  private bindVideoEvents(): void {
    const onPlayPause = () => {
      this.updatePlayState();
      this.resetAutoHideTimer();
    }
    const onTimeUpdate = () => {
      if (!this.isDraggingScrub) this.updateTimeDisplay();
    };
    // Fires for any volume/mute change (slider, mute button, toggleMute(),
    // or the page itself), so the controls reappear and the idle timer restarts.
    const onVolumeChange = () => {
      this.updateVolumeUI();
      this.resetAutoHideTimer();
    };
    const onProgress = () => this.updateBufferProgress();
    const onRateChange = () => this.updateSpeedUI();

    this.video.addEventListener('play', onPlayPause);
    this.video.addEventListener('pause', onPlayPause);
    this.video.addEventListener('timeupdate', onTimeUpdate);
    this.video.addEventListener('volumechange', onVolumeChange);
    this.video.addEventListener('progress', onProgress);
    this.video.addEventListener('ratechange', onRateChange);

    this.cleanupFns.push(() => {
      this.video.removeEventListener('play', onPlayPause);
      this.video.removeEventListener('pause', onPlayPause);
      this.video.removeEventListener('timeupdate', onTimeUpdate);
      this.video.removeEventListener('volumechange', onVolumeChange);
      this.video.removeEventListener('progress', onProgress);
      this.video.removeEventListener('ratechange', onRateChange);
    });
  }

  // ─── UI events ────────────────────────────────────────────────────────

  private bindUIEvents(): void {
    // 1. Play / Pause
    const handlePlayPauseClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.video.paused) this.video.play().catch(() => {});
      else this.video.pause();
    };
    this.ui.playPauseBtn.addEventListener('click', handlePlayPauseClick);
    this.cleanupFns.push(() =>
      this.ui.playPauseBtn.removeEventListener('click', handlePlayPauseClick)
    );

    // Seek back
    const handleSeekBackClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const interval = this.config.seekInterval || 5;
      this.video.currentTime = Math.max(0, this.video.currentTime - interval);
      this.updateTimeDisplay();
      this.resetAutoHideTimer();
    };
    this.ui.seekBackBtn.addEventListener('click', handleSeekBackClick);
    this.cleanupFns.push(() =>
      this.ui.seekBackBtn.removeEventListener('click', handleSeekBackClick)
    );

    // Seek forward
    const handleSeekForwardClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const interval = this.config.seekInterval || 5;
      const dur = isFinite(this.video.duration) ? this.video.duration : Infinity;
      this.video.currentTime = Math.min(dur, this.video.currentTime + interval);
      this.updateTimeDisplay();
      this.resetAutoHideTimer();
    };
    this.ui.seekForwardBtn.addEventListener('click', handleSeekForwardClick);
    this.cleanupFns.push(() =>
      this.ui.seekForwardBtn.removeEventListener('click', handleSeekForwardClick)
    );

    // 2. Volume
    const handleVolumeMouseEnter = () => {
      const barRect = this.ui.container.getBoundingClientRect();
      this.ui.container.classList.toggle(CLASS.POPUPS_DOWN, barRect.top < 250);
    };
    this.ui.volumeBtn.addEventListener('mouseenter', handleVolumeMouseEnter);
    this.ui.volumeSliderContainer.addEventListener('mouseenter', handleVolumeMouseEnter);
    this.cleanupFns.push(() => {
      this.ui.volumeBtn.removeEventListener('mouseenter', handleVolumeMouseEnter);
      this.ui.volumeSliderContainer.removeEventListener('mouseenter', handleVolumeMouseEnter);
    });

    const handleVolumeBtnClick = (e: MouseEvent) => {
      e.stopPropagation();
      const barRect = this.ui.container.getBoundingClientRect();
      this.ui.container.classList.toggle(CLASS.POPUPS_DOWN, barRect.top < 250);
      this.toggleMute();
    };
    this.ui.volumeBtn.addEventListener('click', handleVolumeBtnClick);
    this.cleanupFns.push(() =>
      this.ui.volumeBtn.removeEventListener('click', handleVolumeBtnClick)
    );

    const handleVolumeInput = (e: Event) => {
      e.stopPropagation();
      const val = parseFloat(this.ui.volumeSlider.value);
      this.video.volume = val;
      this.video.muted = val === 0;
    };
    this.ui.volumeSlider.addEventListener('input', handleVolumeInput);
    this.cleanupFns.push(() =>
      this.ui.volumeSlider.removeEventListener('input', handleVolumeInput)
    );

    // 3. Scrub + drag
    const getProgressRatioFromEvent = (e: MouseEvent): number => {
      const rect = this.ui.progressContainer.getBoundingClientRect();
      const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      return rect.width > 0 ? offsetX / rect.width : 0;
    };

    const handleProgressMouseMove = (e: MouseEvent) => {
      const ratio = getProgressRatioFromEvent(e);
      const duration = isFinite(this.video.duration) ? this.video.duration : 0;
      const hoverTime = ratio * duration;
      this.ui.timeTooltip.textContent = formatTime(hoverTime);
      this.ui.timeTooltip.style.left = `${Math.round(ratio * 100)}%`;

      if (this.isDraggingScrub) {
        this.ui.progressBar.style.width = `${ratio * 100}%`;
        this.ui.scrubThumb.style.left = `${ratio * 100}%`;
        this.ui.currentTimeSpan.textContent = formatTime(hoverTime);
      }
    };

    const handleProgressMouseDown = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      this.setScrubbing(true);
      this.resetAutoHideTimer();

      const ratio = getProgressRatioFromEvent(e);
      const duration = isFinite(this.video.duration) ? this.video.duration : 0;
      this.video.currentTime = ratio * duration;
      this.updateTimeDisplay();

      const onWindowMouseMove = (moveEvent: MouseEvent) =>
        handleProgressMouseMove(moveEvent);

      const onWindowMouseUp = (upEvent: MouseEvent) => {
        this.setScrubbing(false);
        const endRatio = getProgressRatioFromEvent(upEvent);
        const finalDuration = isFinite(this.video.duration) ? this.video.duration : 0;
        this.video.currentTime = endRatio * finalDuration;
        this.updateTimeDisplay();
        this.resetAutoHideTimer();

        window.removeEventListener('mousemove', onWindowMouseMove);
        window.removeEventListener('mouseup', onWindowMouseUp);
      };

      window.addEventListener('mousemove', onWindowMouseMove);
      window.addEventListener('mouseup', onWindowMouseUp);
    };

    this.ui.progressContainer.addEventListener('mousemove', handleProgressMouseMove);
    this.ui.progressContainer.addEventListener('mousedown', handleProgressMouseDown);
    this.cleanupFns.push(() => {
      this.ui.progressContainer.removeEventListener('mousemove', handleProgressMouseMove);
      this.ui.progressContainer.removeEventListener('mousedown', handleProgressMouseDown);
    });

    // 4. Speed
    const handleSpeedBtnClick = (e: MouseEvent) => {
      e.stopPropagation();
      this.toggleSpeedMenu();
    };
    this.ui.speedBtn.addEventListener('click', handleSpeedBtnClick);
    this.cleanupFns.push(() =>
      this.ui.speedBtn.removeEventListener('click', handleSpeedBtnClick)
    );

    const speedItems = this.getSpeedItems();
    speedItems.forEach((item) => {
      const handleSpeedItemClick = (e: MouseEvent) => {
        e.stopPropagation();
        const speed = parseFloat(item.getAttribute(ATTR.SPEED) || '1');
        this.video.playbackRate = speed;
        this.closeSpeedMenu();
      };
      item.addEventListener('click', handleSpeedItemClick);
      this.cleanupFns.push(() => item.removeEventListener('click', handleSpeedItemClick));
    });

    // Global close handlers
    const handleDocumentClick = () => {
      this.closeAllMenus();
    };
    document.addEventListener('click', handleDocumentClick);
    this.cleanupFns.push(() => document.removeEventListener('click', handleDocumentClick));

    const handleContainerClick = () => {
      this.closeContextMenu();
    };
    this.ui.container.addEventListener('click', handleContainerClick);
    this.cleanupFns.push(() => this.ui.container.removeEventListener('click', handleContainerClick));

    // Context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e);
    };
    this.ui.container.addEventListener('contextmenu', handleContextMenu);
    this.cleanupFns.push(() => this.ui.container.removeEventListener('contextmenu', handleContextMenu));

    // Download button
    const handleDownloadClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      this.closeContextMenu();
      void this.recording.download();
    };
    this.ui.contextDownloadBtn.addEventListener('click', handleDownloadClick);
    this.cleanupFns.push(() =>
      this.ui.contextDownloadBtn.removeEventListener('click', handleDownloadClick)
    );

    const handleWindowContextMenu = (e: MouseEvent) => {
      if (!this.ui.host.contains(e.target as Node)) {
        this.closeContextMenu();
      }
    };
    window.addEventListener('contextmenu', handleWindowContextMenu);
    this.cleanupFns.push(() =>
      window.removeEventListener('contextmenu', handleWindowContextMenu)
    );

    // Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeAllMenus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    this.cleanupFns.push(() => window.removeEventListener('keydown', handleKeyDown));

    // 5. Fullscreen
    const handleFullscreenClick = (e: MouseEvent) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        if (this.video.requestFullscreen) this.video.requestFullscreen().catch(() => {});
        else if ((this.video as any).webkitRequestFullscreen) {
          (this.video as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      }
    };
    this.ui.fullscreenBtn.addEventListener('click', handleFullscreenClick);
    this.cleanupFns.push(() =>
      this.ui.fullscreenBtn.removeEventListener('click', handleFullscreenClick)
    );

    // 6. Hover / auto-hide
    const handleMouseEnter = () => {
      this.resetAutoHideTimer();
      this.onHoverCallback?.(this.video, true, this.ui.host);
    };
    const handleMouseLeave = () => {
      this.resetAutoHideTimer();
      this.onHoverCallback?.(this.video, false, this.ui.host);
    };
    const handleActivity = () => this.resetAutoHideTimer();

    this.ui.container.addEventListener('mouseenter', handleMouseEnter);
    this.ui.container.addEventListener('mouseleave', handleMouseLeave);
    this.ui.container.addEventListener('mousemove', handleActivity);
    this.video.addEventListener('mousemove', handleActivity);

    this.cleanupFns.push(() => {
      this.ui.container.removeEventListener('mouseenter', handleMouseEnter);
      this.ui.container.removeEventListener('mouseleave', handleMouseLeave);
      this.ui.container.removeEventListener('mousemove', handleActivity);
      this.video.removeEventListener('mousemove', handleActivity);
    });
  }

  // ─── UI state updates ─────────────────────────────────────────────────

  private updatePlayState(): void {
    if (this.video.paused || this.video.ended) {
      this.ui.playIcon.style.display = 'inline-block';
      this.ui.pauseIcon.style.display = 'none';
      this.showControls();
    } else {
      this.ui.playIcon.style.display = 'none';
      this.ui.pauseIcon.style.display = 'inline-block';
    }
  }

  private updateTimeDisplay(): void {
    const cur = this.video.currentTime || 0;
    const dur = isFinite(this.video.duration) ? this.video.duration : 0;

    this.ui.currentTimeSpan.textContent = formatTime(cur);
    this.ui.durationSpan.textContent = formatTime(dur);

    const ratio = dur > 0 ? Math.min(1, Math.max(0, cur / dur)) : 0;
    const percent = `${ratio * 100}%`;
    this.ui.progressBar.style.width = percent;
    this.ui.scrubThumb.style.left = percent;
    if (this.ui.miniProgressBar) this.ui.miniProgressBar.style.width = percent;
  }

  private updateBufferProgress(): void {
    const dur = isFinite(this.video.duration) ? this.video.duration : 0;
    if (dur <= 0 || !this.video.buffered.length) {
      this.ui.bufferBar.style.width = '0%';
      return;
    }
    const cur = this.video.currentTime;
    for (let i = 0; i < this.video.buffered.length; i++) {
      if (this.video.buffered.start(i) <= cur && cur <= this.video.buffered.end(i)) {
        const bufferedEnd = this.video.buffered.end(i);
        this.ui.bufferBar.style.width = `${Math.min(100, (bufferedEnd / dur) * 100)}%`;
        break;
      }
    }
  }

  private updateVolumeUI(): void {
    const isMuted = this.video.muted || this.video.volume === 0;
    this.ui.volumeSlider.value = isMuted ? '0' : String(this.video.volume);

    this.ui.volumeHighIcon.style.display = 'none';
    this.ui.volumeLowIcon.style.display = 'none';
    this.ui.volumeMuteIcon.style.display = 'none';

    if (isMuted) this.ui.volumeMuteIcon.style.display = 'inline-block';
    else if (this.video.volume < 0.5) this.ui.volumeLowIcon.style.display = 'inline-block';
    else this.ui.volumeHighIcon.style.display = 'inline-block';
  }

  private updateSpeedUI(): void {
    const rate = this.video.playbackRate || 1;
    this.ui.speedBtn.textContent = `${rate}x`;

    const items = this.getSpeedItems();
    items.forEach((item) => {
      const speed = parseFloat(item.getAttribute(ATTR.SPEED) || '1');
      this.setSpeedItemActive(item, speed === rate);
    });
  }

  private resetAutoHideTimer(): void {
    if (this.autoHideTimeout) clearTimeout(this.autoHideTimeout);
    this.showControls();

    if (
      this.video.paused ||
      this.video.ended ||
      this.isDraggingScrub ||
      this.isAnyMenuOpen()
    ) {
      return;
    }

    this.autoHideTimeout = setTimeout(() => {
      if (!this.video.paused && !this.isDraggingScrub && !this.isDestroyed) {
        this.hideControls();
      }
    }, this.config.autoHideDelay);
  }

  private showContextMenu(e: MouseEvent): void {
    this.closeSpeedMenu();
    this.resetAutoHideTimer();

    const barRect = this.ui.container.getBoundingClientRect();
    const relX = e.clientX - barRect.left;
    const relY = e.clientY - barRect.top;
    const menuWidth = 145;

    const maxLeft = Math.max(0, barRect.width - menuWidth);
    const clampedLeft = Math.max(0, Math.min(relX - 10, maxLeft));
    this.ui.contextMenu.style.left = `${clampedLeft}px`;

    if (barRect.top < 65) {
      this.ui.contextMenu.style.top = `${relY + 4}px`;
      this.ui.contextMenu.style.bottom = 'auto';
    } else {
      this.ui.contextMenu.style.bottom = `${barRect.height - relY + 4}px`;
      this.ui.contextMenu.style.top = 'auto';
    }

    this.openContextMenu();
  }

  // ─── Recording UI bridge ──────────────────────────────────────────────

  private handleRecordingStart(): void {
    this.ui.recIndicator.style.display = 'inline-flex';
    this.ui.recTime.textContent = '0:00';
    this.updateDownloadBtnRecording(true, 0);
  }

  private handleRecordingTick(seconds: number): void {
    this.ui.recTime.textContent = formatTime(seconds);
    this.updateDownloadBtnRecording(true, seconds);
  }

  private handleRecordingEnd(): void {
    this.ui.recIndicator.style.display = 'none';
    this.updateDownloadBtnRecording(false, 0);
  }

  private updateDownloadBtnRecording(isRec: boolean, seconds: number): void {
    if (isRec) {
      this.ui.contextDownloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><rect x="6" y="6" width="12" height="12" rx="2" fill="#ef4444"/></svg>
        <span>Stop & Save (${formatTime(seconds)})</span>
      `;
    } else {
      this.ui.contextDownloadBtn.innerHTML = `
        ${ICONS.download}
        <span>Download Video</span>
      `;
    }
  }

  private showDownloadFeedback(message: string): void {
    this.ui.contextDownloadBtn.innerHTML = `<span>${message}</span>`;
    setTimeout(() => {
      this.updateDownloadBtnRecording(this.recording.isRecording, this.recording.seconds);
    }, 2500);
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.recording.destroy();

    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }

    this.cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('[UFVC Controller] Cleanup error:', err);
      }
    });
    this.cleanupFns = [];

    this.positionManager.destroy();

    if (this.ui.host.parentNode) {
      this.ui.host.parentNode.removeChild(this.ui.host);
    }
  }

  toggleMute(): void {
    this.video.muted = !this.video.muted;
    if (!this.video.muted && this.video.volume === 0) {
      this.video.volume = 0.5;
    }
  }
}