/**
 * Video Controller Instance
 *
 * Coordinates UI interactions, video playback synchronization,
 * drag-to-seek, auto-hide timer, and theme styling for a single target video.
 */

import { createShadowUI, ShadowUIElements, ICONS } from './shadow-ui';
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

  private mediaRecorder: MediaRecorder | null = null;
  private isRecordingStream = false;
  private recordedChunks: BlobPart[] = [];
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  private recordingSeconds = 0;

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

    // Close menus on outside click or escape
    const handleDocumentClick = () => {
      this.ui.speedMenu.classList.remove('open');
      this.ui.contextMenu.classList.remove('open');
    };
    document.addEventListener('click', handleDocumentClick);
    this.cleanupFns.push(() => document.removeEventListener('click', handleDocumentClick));

    // Close context menu on click inside shadow container
    const handleContainerClick = () => {
      this.ui.contextMenu.classList.remove('open');
    };
    this.ui.container.addEventListener('click', handleContainerClick);
    this.cleanupFns.push(() => this.ui.container.removeEventListener('click', handleContainerClick));

    // Context menu event (Right click on floating controller)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e);
    };
    this.ui.container.addEventListener('contextmenu', handleContextMenu);
    this.cleanupFns.push(() => this.ui.container.removeEventListener('contextmenu', handleContextMenu));

    // Download button click in context menu
    const handleDownloadClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      this.ui.contextMenu.classList.remove('open');
      this.downloadVideo();
    };
    this.ui.contextDownloadBtn.addEventListener('click', handleDownloadClick);
    this.cleanupFns.push(() => this.ui.contextDownloadBtn.removeEventListener('click', handleDownloadClick));

    // Close context menu on window contextmenu if clicked outside
    const handleWindowContextMenu = (e: MouseEvent) => {
      if (!this.ui.host.contains(e.target as Node)) {
        this.ui.contextMenu.classList.remove('open');
      }
    };
    window.addEventListener('contextmenu', handleWindowContextMenu);
    this.cleanupFns.push(() => window.removeEventListener('contextmenu', handleWindowContextMenu));

    // Close menus on Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.ui.speedMenu.classList.remove('open');
        this.ui.contextMenu.classList.remove('open');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    this.cleanupFns.push(() => window.removeEventListener('keydown', handleKeyDown));

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

    // Do not hide if video is paused, dragging scrub, speed menu is open, or context menu is open
    if (
      this.video.paused ||
      this.video.ended ||
      this.isDraggingScrub ||
      this.ui.speedMenu.classList.contains('open') ||
      this.ui.contextMenu.classList.contains('open')
    ) {
      return;
    }

    this.autoHideTimeout = setTimeout(() => {
      if (!this.video.paused && !this.isDraggingScrub && !this.isDestroyed) {
        this.ui.container.classList.add('idle');
      }
    }, this.config.autoHideDelay);
  }

  private showContextMenu(e: MouseEvent): void {
    this.ui.speedMenu.classList.remove('open');
    this.resetAutoHideTimer();

    const barRect = this.ui.container.getBoundingClientRect();
    const relX = e.clientX - barRect.left;
    const relY = e.clientY - barRect.top;

    // Approximate context menu dimensions
    const menuWidth = 145;

    // Position horizontally, clamping within controller or reasonable bounds
    const maxLeft = Math.max(0, barRect.width - menuWidth);
    const clampedLeft = Math.max(0, Math.min(relX - 10, maxLeft));
    this.ui.contextMenu.style.left = `${clampedLeft}px`;

    // Position vertically: open upwards if near bottom of viewport, downwards if near top
    if (barRect.top < 65) {
      this.ui.contextMenu.style.top = `${relY + 4}px`;
      this.ui.contextMenu.style.bottom = 'auto';
    } else {
      this.ui.contextMenu.style.bottom = `${barRect.height - relY + 4}px`;
      this.ui.contextMenu.style.top = 'auto';
    }

    this.ui.contextMenu.classList.add('open');
  }

  private getBestVideoSource(): string {
    // 1. Direct currentSrc (if not blob)
    if (this.video.currentSrc && !this.video.currentSrc.startsWith('blob:')) {
      return this.video.currentSrc;
    }
    // 2. Direct src (if not blob)
    if (this.video.src && !this.video.src.startsWith('blob:')) {
      return this.video.src;
    }
    // 3. Child <source> elements
    const sources = this.video.querySelectorAll('source');
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i].getAttribute('src') || sources[i].src;
      if (s && !s.startsWith('blob:')) {
        return s;
      }
    }
    // 4. Data attributes on video (often used for lazy video loading)
    const dataSrc =
      this.video.getAttribute('data-src') ||
      this.video.getAttribute('data-orig-src') ||
      this.video.getAttribute('data-video-src');
    if (dataSrc && !dataSrc.startsWith('blob:')) {
      return dataSrc;
    }
    // 5. OpenGraph / Twitter meta tags
    const ogVideo =
      document.querySelector('meta[property="og:video:secure_url"]')?.getAttribute('content') ||
      document.querySelector('meta[property="og:video"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:player:stream"]')?.getAttribute('content');
    if (ogVideo && !ogVideo.startsWith('blob:')) {
      return ogVideo;
    }

    return this.video.currentSrc || this.video.src || (sources[0] ? (sources[0].getAttribute('src') || sources[0].src) : '');
  }

  private async downloadVideo(): Promise<void> {
    // If currently recording, user clicked "Stop & Save"
    if (this.isRecordingStream) {
      this.stopStreamRecording(true);
      return;
    }

    const src = this.getBestVideoSource();

    if (!src) {
      console.warn('[UFVC] No video source found to download.');
      this.showDownloadFeedback('⚠️ Video source not found');
      return;
    }

    let filename = 'video.mp4';
    try {
      const urlObj = new URL(src, window.location.href);
      const pathname = urlObj.pathname;
      const baseName = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (
        baseName &&
        (baseName.endsWith('.mp4') ||
          baseName.endsWith('.webm') ||
          baseName.endsWith('.mkv') ||
          baseName.endsWith('.mov'))
      ) {
        filename = baseName.split('?')[0];
      } else {
        const pageTitle = document.title.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'video';
        filename = `${pageTitle.slice(0, 50)}.mp4`;
      }
    } catch {
      filename = `video_${Date.now()}.mp4`;
    }

    // Check if it's a blob: URL
    if (src.startsWith('blob:')) {
      // Step A: Attempt same-origin fetch of blob URL (works for in-memory static blobs)
      try {
        const res = await fetch(src);
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 0) {
            const localBlobUrl = URL.createObjectURL(blob);
            this.triggerDirectDownload(localBlobUrl, filename);
            setTimeout(() => URL.revokeObjectURL(localBlobUrl), 15000);
            return;
          }
        }
      } catch {
        // fetch on blob URL failed -> this is a MediaSource / MSE live stream (YouTube, etc.)
      }

      // Step B: Use MediaStreamRecorder for streaming MediaSource video
      this.startStreamRecording(filename);
      return;
    }

    // Direct HTTP/HTTPS URL: Send message to background service worker (chrome.downloads API)
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          {
            type: 'DOWNLOAD_VIDEO',
            url: src,
            filename
          },
          (response) => {
            if (chrome.runtime.lastError || !response?.success) {
              this.triggerDirectDownload(src, filename);
            }
          }
        );
      } else {
        this.triggerDirectDownload(src, filename);
      }
    } catch {
      this.triggerDirectDownload(src, filename);
    }
  }

  private startStreamRecording(defaultFilename: string): void {
    const stream =
      (this.video as any).captureStream ? (this.video as any).captureStream() : (this.video as any).mozCaptureStream?.();

    if (!stream || typeof MediaRecorder === 'undefined') {
      console.warn('[UFVC] Media captureStream is not supported on this video.');
      this.showDownloadFeedback('⚠️ Direct stream unavailable');
      return;
    }

    let mimeType = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
      mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      mimeType = 'video/webm;codecs=vp9,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    }

    try {
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      console.warn('[UFVC] Failed to initialize MediaRecorder on stream:', err);
      this.showDownloadFeedback('⚠️ Stream protected (CORS)');
      return;
    }

    this.isRecordingStream = true;
    this.recordingSeconds = 0;

    // Show indicator on floating bar
    this.ui.recIndicator.style.display = 'inline-flex';
    this.ui.recTime.textContent = '0:00';

    // Update context download button
    this.updateDownloadBtnRecording(true);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      if (this.recordedChunks.length > 0) {
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const recFilename = `${defaultFilename.replace(/\.[^/.]+$/, '')}.${ext}`;
        const url = URL.createObjectURL(blob);
        this.triggerDirectDownload(url, recFilename);
        setTimeout(() => URL.revokeObjectURL(url), 20000);
        this.showDownloadFeedback('✅ Video Saved!');
      }
      this.cleanupRecording();
    };

    // Listen for video ended event to automatically stop and save
    const onEnded = () => {
      if (this.isRecordingStream) {
        this.stopStreamRecording(true);
      }
    };
    this.video.addEventListener('ended', onEnded, { once: true });

    // Ensure video is playing so frames are generated
    if (this.video.paused) {
      try {
        const playPromise = this.video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch {}
    }

    // Start recorder with chunk slicing
    this.mediaRecorder.start(250);

    // Update timer
    this.recordingTimer = setInterval(() => {
      this.recordingSeconds++;
      const timeStr = formatTime(this.recordingSeconds);
      this.ui.recTime.textContent = timeStr;
      this.updateDownloadBtnRecording(true);
    }, 1000);
  }

  private stopStreamRecording(shouldSave = true): void {
    if (!this.isRecordingStream || !this.mediaRecorder) return;
    this.isRecordingStream = false;

    if (!shouldSave) {
      this.recordedChunks = [];
    }

    try {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch (err) {
      console.error('[UFVC] Error stopping recorder:', err);
    }

    this.cleanupRecording();
  }

  private cleanupRecording(): void {
    this.isRecordingStream = false;
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
    this.ui.recIndicator.style.display = 'none';
    this.updateDownloadBtnRecording(false);
  }

  private updateDownloadBtnRecording(isRec: boolean): void {
    if (isRec) {
      this.ui.contextDownloadBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><rect x="6" y="6" width="12" height="12" rx="2" fill="#ef4444"/></svg>
        <span>Stop & Save (${formatTime(this.recordingSeconds)})</span>
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
      this.updateDownloadBtnRecording(false);
    }, 2500);
  }

  private triggerDirectDownload(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
    }, 100);
  }

  /**
   * Destroys the controller, removing host from DOM and unbinding all events
   */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.isRecordingStream) {
      this.stopStreamRecording(false);
    }

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
