import { ResolvedConfig, SiteSettings } from '../../storage/types';
import { VolumeState } from '../state/volume-state';
import { PlaybackRateState } from '../state/playback-rate-state';
import { VideoCandidateContext, VideoDetectionConfig } from '../detection/types';

export type ChangeSource = 'user' | 'external';

/**
 * Base video element context including the current page URL.
 */
export interface VideoContext {
  readonly video: HTMLVideoElement;
  readonly url: URL;
}

/**
 * Backward compatibility alias for onVideoDetected.
 */
export type VideoDetectionContext = VideoContext;

/**
 * Context passed to filterVideo, providing the video, current URL, and optional detection config.
 */
export interface VideoFilterContext extends VideoContext {
  readonly config?: VideoDetectionConfig;
}

/**
 * Context passed to scoreVideo, providing the video, current URL, and candidate metrics.
 */
export interface VideoScoreContext extends VideoContext {
  readonly candidate: VideoCandidateContext;
}

/**
 * Unified dependency context passed to all controller lifecycle methods and action hooks.
 */
export interface VideoAdapterContext extends VideoContext {
  readonly controllerHost: HTMLElement;
  readonly settings: SiteSettings;
  readonly volumeState: VolumeState;
  readonly playbackRateState?: PlaybackRateState;
  /**
   * Applies site settings overrides (e.g. controlsLayout = 'minimal') to the active controller.
   */
  updateSettings(overrides: Partial<SiteSettings>): void;
  updateConfig(newConfig: Partial<ResolvedConfig>): void;
}

/**
 * Strongly-typed payload map for all controller actions.
 */
export interface ActionPayloadMap {
  play: void;
  pause: void;
  seek: { targetTime: number; delta?: number };
  setSpeed: { rate: number };
  setVolume: { volume: number; muted: boolean };
  /**
   * NOTE on `toggleFullscreen`:
   * Always awaited sequentially by the dispatcher. Do NOT place long delays (e.g. setTimeout > 500ms)
   * inside `toggleFullscreen.before`, or the browser's Transient User Activation will expire
   * and `requestFullscreen()` will be blocked.
   */
  toggleFullscreen: { entering: boolean; fillToFit: boolean };
}

export type VideoActionType = keyof ActionPayloadMap;

export interface ActionExecutionContext<K extends VideoActionType>
  extends VideoAdapterContext {
  readonly action: K;
  readonly source: ChangeSource;
  /**
   * Mutable payload: `before` hooks can modify properties (e.g. `payload.fillToFit = false`)
   * before the core action executes.
   */
  payload: ActionPayloadMap[K];
  /**
   * Call `cancel()` inside a `before` hook to abort the default core action.
   */
  cancel(): void;
  readonly isCancelled: boolean;
}

export interface ActionLifecycleHook<K extends VideoActionType> {
  /**
   * Executed when the user triggers an action via the controller/shortcuts, BEFORE DOM mutation.
   * Always awaited sequentially. Can mutate `ctx.payload` or call `ctx.cancel()`.
   */
  before?(ctx: ActionExecutionContext<K>): void | Promise<void>;

  /**
   * Executed AFTER the state change is applied (either `'user'` initiated or `'external'` DOM event).
   */
  after?(ctx: ActionExecutionContext<K>): void | Promise<void>;
}

export type AdapterActionHooks = {
  [K in VideoActionType]?: ActionLifecycleHook<K>;
};
