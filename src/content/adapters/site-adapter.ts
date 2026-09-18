/**
 * Site Adapter Contract Interface
 */

import { SiteSettings } from '../../storage/types';
import { TrackedVideo, VideoCandidateContext } from '../detection/types';

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
   * Lifecycle hooks
   */
  onVideoDetected?(video: HTMLVideoElement): void;
  onVideoActivated?(video: HTMLVideoElement): void;
  onVideoDeactivated?(video: HTMLVideoElement): void;

  /**
   * Hover and interaction bridge hook
   */
  onControllerHover?(video: HTMLVideoElement, isHovered: boolean, controllerHost: HTMLElement): void;
}
