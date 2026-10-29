/**
 * Site Adapter Contract Interface
 */

import { SiteSettings } from '../../storage/types';
import { TrackedVideo, VideoCandidateContext } from '../detection/types';
import { AdapterActionHooks, VideoAdapterContext } from './action-types';

export interface SiteAdapter {
  readonly id: string;
  readonly name: string;

  /**
   * Checks if this adapter should activate for the given URL
   */
  matches(url: URL): boolean;

  /**
   * Provides site-specific default config overrides
   */
  getConfigOverrides(): Partial<SiteSettings>;

  /**
   * Optional custom filter to accept or reject videos
   */
  filterVideo?(video: HTMLVideoElement): boolean;

  /**
   * Optional custom scoring modifier for videos
   */
  scoreVideo?(video: HTMLVideoElement, context: VideoCandidateContext): number | null;

  /**
   * Optional custom candidate selection logic
   */
  selectVideos?(candidates: TrackedVideo[]): TrackedVideo[] | null;

  /**
   * Lifecycle hooks receiving unified context
   */
  onVideoDetected?(video: HTMLVideoElement): void;
  onVideoActivated?(ctx: VideoAdapterContext): void;
  onVideoDeactivated?(ctx: VideoAdapterContext): void;

  /**
   * Hover and interaction bridge hook
   */
  onControllerHover?(ctx: VideoAdapterContext, isHovered: boolean): void;

  /**
   * Optional per-action before/after interceptors.
   */
  readonly actions?: AdapterActionHooks;
}
