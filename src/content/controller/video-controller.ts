/**
 * Video Controller Instance
 *
 * Coordinates UI interactions, video playback synchronization,
 * drag-to-seek, auto-hide timer, and theme styling for a single target video.
 */

import { createShadowUI, ShadowUIElements } from './shadow-ui';
import { PositionManager } from './position-manager';
import { ResolvedConfig } from '../../storage/types';
import { themeEngine } from '../../themes/theme-engine';
import { formatTime } from '../../utils/dom';

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

    // Append host directly to document.documentElement (never inside host-site player DOM)
    (document.documentElement || document.body).appendChild(this.ui.host);

    this.positionManager = new PositionManager(video, this.ui.host, this.ui.container, this.config);

    this.bindVideoEvents();
    this.bindUIEvents();
    this.syncInitialState();
    this.resetAutoHideTimer();
  }

  /**
   * Applies or updates theme variables on host
   */
  applyTheme(themeId: string): void {
    this.config.theme = themeId;
    themeEngine.applyTheme(this.ui.container, themeId);
  }

  /**
   * Updates configuration settings
   */
  updateConfig(newConfig: ResolvedConfig): void {
    this.config = newConfig;
    this.applyTheme(newConfig.theme);
    this.ui.container.classList.toggle('minimal-mode', newConfig.controlsLayout === 'minimal');
    this.positionManager.updateConfig(newConfig);
  }

  /**
   * Forces position recalculation (e.g. on scroll/resize)
   */
  reposition(): void {
    this.positionManager.updatePosition();
  }

  private syncInitialState(): void {
    this.ui.container.classList.toggle('minimal-mode', this.config.controlsLayout === 'minimal');
    this.updatePlayState();
    this.updateTimeDisplay();
    this.updateVolumeUI();
    this.updateSpeedUI();
  }

  private bindVideoEvents(): void {
    const onPlayPause = () => this.updatePlayState();
    const onTimeUpdate = () => {
      if (!this.isDraggingScrub) {
        this.updateTimeDisplay();
      }
    };
    const onVolumeChange = () => this.updateVolumeUI();
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

  private bindUIEvents(): void {
    // 1. Play / Pause button
    const handlePlayPauseClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.video.paused) {
        this.video.play().catch(() => {});
      } else {
        this.video.pause();
      }
    };
    this.ui.playPauseBtn.addEventListener('click', handlePlayPauseClick);
    this.cleanupFns.push(() => this.ui.playPauseBtn.removeEventListener('click', handlePlayPauseClick));

    // Seek -5s button
    const handleSeekBackClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const interval = this.config.seekInterval || 5;
      this.video.currentTime = Math.max(0, this.video.currentTime - interval);
      this.updateTimeDisplay();
      this.resetAutoHideTimer();
    };
    this.ui.seekBackBtn.addEventListener('click', handleSeekBackClick);
    this.cleanupFns.push(() => this.ui.seekBackBtn.removeEventListener('click', handleSeekBackClick));

    // Seek +5s button
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
    this.cleanupFns.push(() => this.ui.seekForwardBtn.removeEventListener('click', handleSeekForwardClick));

    // 2. Volume button (Mute toggle)
    const handleVolumeBtnClick = (e: MouseEvent) => {
      e.stopPropagation();
      this.video.muted = !this.video.muted;
      if (!this.video.muted && this.video.volume === 0) {
        this.video.volume = 0.5;
      }
    };
    this.ui.volumeBtn.addEventListener('click', handleVolumeBtnClick);
    this.cleanupFns.push(() => this.ui.volumeBtn.removeEventListener('click', handleVolumeBtnClick));

    // Volume slider input
    const handleVolumeInput = (e: Event) => {
      e.stopPropagation();
      const val = parseFloat(this.ui.volumeSlider.value);
      this.video.volume = val;
      this.video.muted = val === 0;
    };
    this.ui.volumeSlider.addEventListener('input', handleVolumeInput);
    this.cleanupFns.push(() => this.ui.volumeSlider.removeEventListener('input', handleVolumeInput));

    // 3. Scrub Progress Bar & Drag-to-Seek
    const getProgressRatioFromEvent = (e: MouseEvent): number => {
      const rect = this.ui.progressContainer.getBoundingClientRect();
      const clientX = e.clientX;
      const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
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
      this.isDraggingScrub = true;
      this.ui.progressContainer.classList.add('dragging');
      this.resetAutoHideTimer();

      const ratio = getProgressRatioFromEvent(e);
      const duration = isFinite(this.video.duration) ? this.video.duration : 0;
      this.video.currentTime = ratio * duration;
      this.updateTimeDisplay();

      const onWindowMouseMove = (moveEvent: MouseEvent) => {
        handleProgressMouseMove(moveEvent);
      };

      const onWindowMouseUp = (upEvent: MouseEvent) => {
        this.isDraggingScrub = false;
        this.ui.progressContainer.classList.remove('dragging');
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

    // 4. Playback Speed Selector
    const handleSpeedBtnClick = (e: MouseEvent) => {
      e.stopPropagation();
      this.ui.speedMenu.classList.toggle('open');
    };
    this.ui.speedBtn.addEventListener('click', handleSpeedBtnClick);
    this.cleanupFns.push(() => this.ui.speedBtn.removeEventListener('click', handleSpeedBtnClick));

    const speedItems = this.ui.speedMenu.querySelectorAll<HTMLButtonElement>('.ufvc-speed-item');
    speedItems.forEach((item) => {
      const handleSpeedItemClick = (e: MouseEvent) => {
        e.stopPropagation();
        const speed = parseFloat(item.getAttribute('data-speed') || '1');
        this.video.playbackRate = speed;
        this.ui.speedMenu.classList.remove('open');
      };
      item.addEventListener('click', handleSpeedItemClick);
      this.cleanupFns.push(() => item.removeEventListener('click', handleSpeedItemClick));
    });

    // Close menus on outside click
    const handleDocumentClick = () => {
      this.ui.speedMenu.classList.remove('open');
    };
    document.addEventListener('click', handleDocumentClick);
    this.cleanupFns.push(() => document.removeEventListener('click', handleDocumentClick));

    // 5. Fullscreen Toggle
    const handleFullscreenClick = (e: MouseEvent) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        // Prefer requesting fullscreen on video element or its parent
        if (this.video.requestFullscreen) {
          this.video.requestFullscreen().catch(() => {});
        } else if ((this.video as any).webkitRequestFullscreen) {
          (this.video as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    this.ui.fullscreenBtn.addEventListener('click', handleFullscreenClick);
    this.cleanupFns.push(() => this.ui.fullscreenBtn.removeEventListener('click', handleFullscreenClick));

    // 6. Hover Auto-Hide & Adapter Bridge
    const handleMouseEnter = () => {
      this.resetAutoHideTimer();
      if (this.onHoverCallback) {
        this.onHoverCallback(this.video, true, this.ui.host);
      }
    };

    const handleMouseLeave = () => {
      this.resetAutoHideTimer();
      if (this.onHoverCallback) {
        this.onHoverCallback(this.video, false, this.ui.host);
      }
    };

    const handleActivity = () => {
      this.resetAutoHideTimer();
    };

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

  private updatePlayState(): void {
    if (this.video.paused || this.video.ended) {
      this.ui.playIcon.style.display = 'inline-block';
      this.ui.pauseIcon.style.display = 'none';
      // Keep controller visible while paused
      this.ui.container.classList.remove('idle');
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
    if (this.ui.miniProgressBar) {
      this.ui.miniProgressBar.style.width = percent;
    }
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

    if (isMuted) {
      this.ui.volumeMuteIcon.style.display = 'inline-block';
    } else if (this.video.volume < 0.5) {
      this.ui.volumeLowIcon.style.display = 'inline-block';
    } else {
      this.ui.volumeHighIcon.style.display = 'inline-block';
    }
  }

  private updateSpeedUI(): void {
    const rate = this.video.playbackRate || 1;
    this.ui.speedBtn.textContent = `${rate}x`;

    const items = this.ui.speedMenu.querySelectorAll<HTMLButtonElement>('.ufvc-speed-item');
    items.forEach((item) => {
      const speed = parseFloat(item.getAttribute('data-speed') || '1');
      if (speed === rate) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  private resetAutoHideTimer(): void {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }

    this.ui.container.classList.remove('idle');

    // Do not hide if video is paused, dragging scrub, or speed menu is open
    if (
      this.video.paused ||
      this.video.ended ||
      this.isDraggingScrub ||
      this.ui.speedMenu.classList.contains('open')
    ) {
      return;
    }

    this.autoHideTimeout = setTimeout(() => {
      if (!this.video.paused && !this.isDraggingScrub && !this.isDestroyed) {
        this.ui.container.classList.add('idle');
      }
    }, this.config.autoHideDelay);
  }

  /**
   * Destroys the controller, removing host from DOM and unbinding all events
   */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

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

  /**
   * Toggles mute on the controlled video
   */
  toggleMute(): void {
    this.video.muted = !this.video.muted;
    if (!this.video.muted && this.video.volume === 0) {
      this.video.volume = 0.5;
    }
  }
}
