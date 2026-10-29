/**
 * Site Adapter Contract Interface
 */

import { SiteSettings } from '../../storage/types';
import { TrackedVideo, VideoCandidateContext } from '../detection/types';
import {
  AdapterActionHooks,
  VideoAdapterContext,
  VideoContext,
  VideoFilterContext,
  VideoScoreContext
} from './action-types';

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
  getConfigOverrides(url?: URL): Partial<SiteSettings>;

  /**
   * Optional custom filter to accept or reject videos
   */
  filterVideo?(ctx: VideoFilterContext | HTMLVideoElement): boolean;

  /**
   * Optional custom scoring modifier for videos
   */
  scoreVideo?(ctx: VideoScoreContext | HTMLVideoElement, legacyCandidate?: VideoCandidateContext): number | null;

  /**
   * Optional custom candidate selection logic
   */
  selectVideos?(candidates: TrackedVideo[]): TrackedVideo[] | null;

  /**
   * Lifecycle hooks receiving unified context
   */
  onVideoDetected?(ctx: VideoContext | HTMLVideoElement): void;
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
