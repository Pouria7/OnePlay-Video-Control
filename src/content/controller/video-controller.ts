/**
 * Video Controller Instance
 *
 * Coordinates UI interactions, video playback synchronization,
 * drag-to-seek, auto-hide timer, theme styling, manual controller dragging,
 * context-menu actions, and sequential action dispatching for a single target video.
 *
 * Heavy lifting for download/recording is delegated to RecordingManager.
 * Volume state management (preventing YouTube preview muting overrides)
 * is delegated to VolumeState.
 */

import { createShadowUI, ShadowUIElements, updateControlHints } from './shadow-ui';
import { PositionManager } from './position-manager';
import { VolumeState } from './volume-state';
import { ContextMenu } from './context-menu';
import { ResolvedConfig, SiteSettings } from '../../storage/types';
import { themeEngine } from '../../themes/theme-engine';
import { formatTime } from '../../utils/dom';
import { RecordingManager } from './recording-manager';
import { SiteAdapter } from '../adapters/site-adapter';
import { GenericAdapter } from '../adapters/generic-adapter';
import { VideoAdapterContext } from '../adapters/action-types';
import { VideoActionDispatcher } from '../actions/action-dispatcher';
import { stepSpeed } from './context-menu/builtin-items';

/** CSS state classes toggled on shadow-UI elements. */
const CLASS = {
  IDLE: 'idle',
  OPEN: 'open',
  DRAGGING: 'dragging',
  ACTIVE: 'active',
  MINIMAL_MODE: 'minimal-mode',
  SPEED_ITEM: 'ufvc-speed-item',
  POPUPS_DOWN: 'popups-down',
  IS_DRAGGING: 'is-dragging',
} as const;

/** Selectors derived from the class names above. */
const SELECTOR = {
  SPEED_ITEM: `.${CLASS.SPEED_ITEM}`,
} as const;

/** Data attributes read from shadow-UI elements. */
const ATTR = {
  SPEED: 'data-speed',
} as const;

export type VideoHoverCallback = (
  ctx: VideoAdapterContext,
  isHovered: boolean
) => void;

export class VideoController {
  readonly id: string;
  readonly video: HTMLVideoElement;
  readonly ui: ShadowUIElements;
  private positionManager: PositionManager;
  private volumeState: VolumeState;
  private contextMenu: ContextMenu;
  private config: ResolvedConfig;
  private adapter: SiteAdapter;
  private dispatcher: VideoActionDispatcher;
  private isDestroyed = false;
  private isDraggingScrub = false;
  private isDraggingBar = false;
  private autoHideTimeout: ReturnType<typeof setTimeout> | null = null;
  private cleanupFns: Array<() => void> = [];
  private recording: RecordingManager;
  private savedObjectFit: string | null = null;

  private onHoverCallback?: VideoHoverCallback;

  constructor(
    id: string,
    video: HTMLVideoElement,
    config: ResolvedConfig,
    onHover?: VideoHoverCallback,
    adapter?: SiteAdapter
  ) {
    this.id = id;
    this.video = video;
    this.config = config;
    this.onHoverCallback = onHover;
    this.adapter = adapter ?? new GenericAdapter();

    this.ui = createShadowUI();
    this.applyTheme(config.theme);
    (document.documentElement || document.body).appendChild(this.ui.host);

    this.positionManager = new PositionManager(video, this.ui.host, this.ui.container, this.config);
    this.volumeState = new VolumeState(video);

    this.dispatcher = new VideoActionDispatcher(() => this.getAdapterContext(), this.adapter);

    this.recording = new RecordingManager(video, {
      onRecordingStart: () => this.handleRecordingStart(),
      onRecordingTick: (s) => this.handleRecordingTick(s),
      onRecordingEnd: () => this.handleRecordingEnd(),
      onFeedback: (msg) => this.showDownloadFeedback(msg),
    });

    this.contextMenu = new ContextMenu({
      element: this.ui.contextMenu,
      anchor: this.ui.container,
      context: {
        video: this.video,
        volume: this.volumeState,
        recording: this.recording,
        getConfig: () => this.config,
      },
      onOpenChange: (isOpen) => {
        if (isOpen) {
          this.closeSpeedMenu();
          this.resetAutoHideTimer();
        }
      },
    });

    this.bindVideoEvents();
    this.bindUIEvents();
    this.bindBarDragEvents();
    this.syncInitialState();
    this.resetAutoHideTimer();
  }

  getAdapterContext(): VideoAdapterContext {
    return {
      video: this.video,
      controllerHost: this.ui.host,
      settings: this.config,
      volumeState: this.volumeState,
      url:
        typeof window !== 'undefined' && window.location?.href
          ? new URL(window.location.href)
          : new URL('http://localhost'),
      updateSettings: (overrides: Partial<SiteSettings>) => {
        this.updateSettings(overrides);
      },
      updateConfig: (newConfig: Partial<ResolvedConfig>) => {
        this.updateConfig(newConfig);
      },
    };
  }

  getDispatcher(): VideoActionDispatcher {
    return this.dispatcher;
  }

  getAdapter(): SiteAdapter {
    return this.adapter;
  }

  applyTheme(themeId: string): void {
    this.config.theme = themeId;
    themeEngine.applyTheme(this.ui.container, themeId);
  }

  updateSettings(overrides: Partial<SiteSettings>): void {
    this.updateConfig(overrides);
  }

  updateConfig(newConfig: Partial<ResolvedConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    this.applyTheme(this.config.theme);
    this.setMinimalMode(this.config.controlsLayout === 'minimal');
    updateControlHints(this.ui, {
      shortcuts: this.config.shortcuts,
      seekInterval: this.config.seekInterval,
    });
    this.positionManager.updateConfig(this.config);
    this.contextMenu.refresh();
  }

  reposition(): void {
    this.positionManager.updatePosition();
  }

  getVolumeState(): VolumeState {
    return this.volumeState;
  }

  getContextMenu(): ContextMenu {
    return this.contextMenu;
  }

  private syncInitialState(): void {
    this.setMinimalMode(this.config.controlsLayout === 'minimal');
    updateControlHints(this.ui, {
      shortcuts: this.config.shortcuts,
      seekInterval: this.config.seekInterval,
    });
    this.updatePlayState();
    this.updateTimeDisplay();
    this.updateVolumeUI();
    this.updateSpeedUI();
  }

  // ─── UI state helpers (CSS class toggles) ─────────────────────────────

  /** Show the controls bar (removes the idle state). */
  showControls(): void {
    this.ui.container.classList.remove(CLASS.IDLE);
  }

  /** Hide the controls bar (adds the idle state). */
  hideControls(): void {
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

  private closeSpeedMenu(): void {
    this.ui.speedMenu.classList.remove(CLASS.OPEN);
  }

  private toggleSpeedMenu(): void {
    if (!this.isSpeedMenuOpen()) {
      const barRect = this.ui.container.getBoundingClientRect();
      this.ui.container.classList.toggle(CLASS.POPUPS_DOWN, barRect.top < 250);
      this.contextMenu.close();
    }
    this.ui.speedMenu.classList.toggle(CLASS.OPEN);
  }

  // Both menus
  private isAnyMenuOpen(): boolean {
    return this.isSpeedMenuOpen() || this.contextMenu.isOpen;
  }

  private closeAllMenus(): void {
    this.closeSpeedMenu();
    this.contextMenu.close();
  }

  // Speed items
  private getSpeedItems(): NodeListOf<HTMLButtonElement> {
    return this.ui.speedMenu.querySelectorAll<HTMLButtonElement>(SELECTOR.SPEED_ITEM);
  }

  private setSpeedItemActive(item: HTMLButtonElement, isActive: boolean): void {
    item.classList.toggle(CLASS.ACTIVE, isActive);
  }

  // ─── Actions Pipeline ─────────────────────────────────────────────────

  async play(): Promise<void> {
    await this.dispatcher.dispatchUserAction('play', undefined as void, async () => {
      await this.video.play().catch(() => {});
    });
  }

  async pause(): Promise<void> {
    await this.dispatcher.dispatchUserAction('pause', undefined as void, () => {
      this.video.pause();
    });
  }

  async togglePlay(): Promise<void> {
    if (this.video.paused || this.video.ended) {
      await this.play();
    } else {
      await this.pause();
    }
  }

  async seekTo(targetTime: number, delta?: number): Promise<void> {
    const dur = isFinite(this.video.duration) ? this.video.duration : Infinity;
    const bounded = Math.max(0, Math.min(dur, targetTime));
    await this.dispatcher.dispatchUserAction('seek', { targetTime: bounded, delta }, (payload) => {
      this.video.currentTime = payload.targetTime;
      this.showControls();
      this.updateTimeDisplay();
      this.resetAutoHideTimer();
    });
  }

  async seekBy(delta: number): Promise<void> {
    const cur = this.video.currentTime || 0;
    await this.seekTo(cur + delta, delta);
  }

  async setSpeed(rate: number): Promise<void> {
    await this.dispatcher.dispatchUserAction('setSpeed', { rate }, (payload) => {
      this.video.playbackRate = payload.rate;
      this.updateSpeedUI();
      this.showControls();
      this.resetAutoHideTimer();
    });
  }

  async stepSpeed(direction: 1 | -1): Promise<void> {
    const next = stepSpeed(this.video.playbackRate || 1, direction);
    await this.setSpeed(next);
  }

  async speedDown(): Promise<void> {
    await this.stepSpeed(-1);
  }

  async speedUp(): Promise<void> {
    await this.stepSpeed(1);
  }

  async setVolume(volume: number): Promise<void> {
    const v = Math.min(1, Math.max(0, volume));
    const muted = v <= 0.001;
    await this.dispatcher.dispatchUserAction('setVolume', { volume: v, muted }, (payload) => {
      this.volumeState.setVolume(payload.volume);
      if (payload.muted !== this.volumeState.muted) {
        this.volumeState.setMuted(payload.muted);
      }
    });
  }

  async setMuted(muted: boolean): Promise<void> {
    const curVol = this.volumeState.volume;
    await this.dispatcher.dispatchUserAction('setVolume', { volume: curVol, muted }, (payload) => {
      this.volumeState.setMuted(payload.muted);
    });
  }

  async toggleMute(): Promise<void> {
    await this.setMuted(!this.volumeState.isSilent);
  }

  async toggleFullscreen(): Promise<void> {
    const entering = !document.fullscreenElement;
    await this.dispatcher.dispatchUserAction(
      'toggleFullscreen',
      { entering, fillToFit: true },
      async (payload) => {
        if (payload.entering) {
          if (this.savedObjectFit === null) {
            this.savedObjectFit = this.video.style.objectFit || '';
          }
          if (!payload.fillToFit) {
            this.video.style.objectFit = 'contain';
          }
          if (this.video.requestFullscreen) {
            await this.video.requestFullscreen().catch(() => {});
          } else if ((this.video as any).webkitRequestFullscreen) {
            (this.video as any).webkitRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen().catch(() => {});
          }
          if (this.savedObjectFit !== null) {
            this.video.style.objectFit = this.savedObjectFit;
            this.savedObjectFit = null;
          }
        }
      }
    );
  }

  // ─── Video events ─────────────────────────────────────────────────────

  private bindVideoEvents(): void {
    const onPlayPause = () => {
      this.updatePlayState();
      this.resetAutoHideTimer();
      const action = this.video.paused ? 'pause' : 'play';
      this.dispatcher.notifyExternalAfter(action, undefined as void, 'external');
    };
    const onTimeUpdate = () => {
      if (!this.isDraggingScrub) this.updateTimeDisplay();
    };
    const onVolumeChange = () => {
      this.showControls();
      this.volumeState.handleMediaVolumeChange();
      this.updateVolumeUI();
      this.resetAutoHideTimer();
    };
    const onSeeking = () => {
      this.showControls();
      this.updateTimeDisplay();
      this.resetAutoHideTimer();
    };
    const onSeeked = () => {
      this.showControls();
      this.updateTimeDisplay();
      this.resetAutoHideTimer();
      this.dispatcher.notifyExternalAfter('seek', { targetTime: this.video.currentTime }, 'external');
    };
    const onProgress = () => this.updateBufferProgress();
    const onRateChange = () => {
      this.showControls();
      this.updateSpeedUI();
      this.resetAutoHideTimer();
      this.dispatcher.notifyExternalAfter('setSpeed', { rate: this.video.playbackRate }, 'external');
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && this.savedObjectFit !== null) {
        this.video.style.objectFit = this.savedObjectFit;
        this.savedObjectFit = null;
      }
    };

    this.video.addEventListener('play', onPlayPause);
    this.video.addEventListener('pause', onPlayPause);
    this.video.addEventListener('timeupdate', onTimeUpdate);
    this.video.addEventListener('volumechange', onVolumeChange, true);
    this.video.addEventListener('seeking', onSeeking);
    this.video.addEventListener('seeked', onSeeked);
    this.video.addEventListener('progress', onProgress);
    this.video.addEventListener('ratechange', onRateChange);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    const unsubscribeVolume = this.volumeState.subscribe((snapshot, source) => {
      this.showControls();
      this.updateVolumeUI();
      this.resetAutoHideTimer();
      if (source === 'external') {
        this.dispatcher.notifyExternalAfter(
          'setVolume',
          { volume: snapshot.volume, muted: snapshot.muted },
          'external'
        );
      }
    });

    this.cleanupFns.push(() => {
      this.video.removeEventListener('play', onPlayPause);
      this.video.removeEventListener('pause', onPlayPause);
      this.video.removeEventListener('timeupdate', onTimeUpdate);
      this.video.removeEventListener('volumechange', onVolumeChange, true);
      this.video.removeEventListener('seeking', onSeeking);
      this.video.removeEventListener('seeked', onSeeked);
      this.video.removeEventListener('progress', onProgress);
      this.video.removeEventListener('ratechange', onRateChange);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      unsubscribeVolume();
    });
  }

  // ─── UI events ────────────────────────────────────────────────────────

  private bindUIEvents(): void {
    // 1. Play / Pause
    const handlePlayPauseClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      this.togglePlay();
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
      this.seekBy(-interval);
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
      this.seekBy(interval);
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
      this.setVolume(val);
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
      this.seekTo(ratio * duration);

      const onWindowMouseMove = (moveEvent: MouseEvent) =>
        handleProgressMouseMove(moveEvent);

      const onWindowMouseUp = (upEvent: MouseEvent) => {
        this.setScrubbing(false);
        const endRatio = getProgressRatioFromEvent(upEvent);
        const finalDuration = isFinite(this.video.duration) ? this.video.duration : 0;
        this.seekTo(endRatio * finalDuration);

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
        this.setSpeed(speed);
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
      this.contextMenu.close();
    };
    this.ui.container.addEventListener('click', handleContainerClick);
    this.cleanupFns.push(() => this.ui.container.removeEventListener('click', handleContainerClick));

    // Context menu opening
    const handleContextMenu = (e: MouseEvent) => {
      if (this.contextMenu.hasVisibleItems()) {
        e.preventDefault();
        e.stopPropagation();
        this.contextMenu.openAt(e.clientX, e.clientY);
      }
    };
    this.ui.container.addEventListener('contextmenu', handleContextMenu);
    this.cleanupFns.push(() => this.ui.container.removeEventListener('contextmenu', handleContextMenu));

    const handleWindowContextMenu = (e: MouseEvent) => {
      if (!this.ui.host.contains(e.target as Node)) {
        this.contextMenu.close();
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
      this.toggleFullscreen();
    };
    this.ui.fullscreenBtn.addEventListener('click', handleFullscreenClick);
    this.cleanupFns.push(() =>
      this.ui.fullscreenBtn.removeEventListener('click', handleFullscreenClick)
    );

    // 6. Hover / auto-hide
    const handleMouseEnter = () => {
      this.resetAutoHideTimer();
      this.notifyHover(true);
    };
    const handleMouseLeave = () => {
      this.resetAutoHideTimer();
      this.notifyHover(false);
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

  private notifyHover(isHovered: boolean): void {
    if (!this.onHoverCallback) return;
    const ctx = this.getAdapterContext();
    this.onHoverCallback(ctx, isHovered);
  }

  // ─── Manual Bar Dragging ──────────────────────────────────────────────

  private bindBarDragEvents(): void {
    const startDrag = (startX: number, startY: number) => {
      this.isDraggingBar = true;
      this.ui.container.classList.add(CLASS.IS_DRAGGING);
      this.closeAllMenus();
      this.resetAutoHideTimer();

      const initialOffset = this.positionManager.getEffectiveOffset();

      const onPointerMove = (e: PointerEvent) => {
        const dx = initialOffset.dx + (e.clientX - startX);
        const dy = initialOffset.dy + (e.clientY - startY);
        this.positionManager.setDragOffset({ dx, dy });
        this.resetAutoHideTimer();
      };

      const onPointerUp = () => {
        this.isDraggingBar = false;
        this.ui.container.classList.remove(CLASS.IS_DRAGGING);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        this.resetAutoHideTimer();
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    // Dedicated drag handle (full mode)
    const onHandlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    };
    this.ui.dragHandle.addEventListener('pointerdown', onHandlePointerDown);

    // Double-click to reset position back to dock
    const onHandleDblClick = (e: MouseEvent) => {
      e.stopPropagation();
      this.positionManager.resetDragOffset();
    };
    this.ui.dragHandle.addEventListener('dblclick', onHandleDblClick);

    // Minimal mode: the entire pill bar is draggable (excluding interactive buttons)
    const onContainerPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (this.config.controlsLayout !== 'minimal') return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, [role="menu"], [role="menuitem"]')) return;
      e.stopPropagation();
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    };
    this.ui.container.addEventListener('pointerdown', onContainerPointerDown);

    this.cleanupFns.push(() => {
      this.ui.dragHandle.removeEventListener('pointerdown', onHandlePointerDown);
      this.ui.dragHandle.removeEventListener('dblclick', onHandleDblClick);
      this.ui.container.removeEventListener('pointerdown', onContainerPointerDown);
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
    const isMuted = this.volumeState.isSilent;
    const vol = isMuted ? 0 : this.volumeState.volume;
    this.ui.volumeSlider.value = String(vol);

    this.ui.volumeHighIcon.style.display = 'none';
    this.ui.volumeLowIcon.style.display = 'none';
    this.ui.volumeMuteIcon.style.display = 'none';

    if (isMuted) this.ui.volumeMuteIcon.style.display = 'inline-block';
    else if (vol < 0.5) this.ui.volumeLowIcon.style.display = 'inline-block';
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

  resetAutoHideTimer(): void {
    if (this.autoHideTimeout) clearTimeout(this.autoHideTimeout);
    this.showControls();

    if (
      this.video.paused ||
      this.video.ended ||
      this.isDraggingScrub ||
      this.isDraggingBar ||
      this.isAnyMenuOpen()
    ) {
      return;
    }

    this.autoHideTimeout = setTimeout(() => {
      if (!this.video.paused && !this.isDraggingScrub && !this.isDraggingBar && !this.isDestroyed) {
        this.hideControls();
      }
    }, this.config.autoHideDelay);
  }

  // ─── Recording UI bridge ──────────────────────────────────────────────

  private handleRecordingStart(): void {
    this.ui.recIndicator.style.display = 'inline-flex';
    this.ui.recTime.textContent = '0:00';
    this.contextMenu.dispatch({ type: 'recording', isRecording: true, seconds: 0 });
  }

  private handleRecordingTick(seconds: number): void {
    this.ui.recTime.textContent = formatTime(seconds);
    this.contextMenu.dispatch({ type: 'recording', isRecording: true, seconds });
  }

  private handleRecordingEnd(): void {
    this.ui.recIndicator.style.display = 'none';
    this.contextMenu.dispatch({ type: 'recording', isRecording: false, seconds: 0 });
  }

  private showDownloadFeedback(message: string): void {
    this.contextMenu.dispatch({ type: 'feedback', message, durationMs: 2500 });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.recording.destroy();
    this.contextMenu.destroy();

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
}
