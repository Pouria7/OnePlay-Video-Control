/**
 * Video Candidate Filter
 *
 * Evaluates whether an HTML5 video element is eligible to become a candidate
 * for floating video controls, checking rendered bounding dimensions and DOM visibility.
 */

import { VideoDetectionConfig } from './types';
import { isElementVisibleInDOM } from '../../utils/dom';

export interface CandidateFilterContext {
  intersectionRatio?: number;
  intersectionRect?: DOMRectReadOnly;
}

export function isCandidateVideo(
  video: HTMLVideoElement,
  config: VideoDetectionConfig,
  customFilter?: (video: HTMLVideoElement) => boolean,
  context?: CandidateFilterContext
): boolean {
  if (!video || !(video instanceof HTMLVideoElement)) {
    return false;
  }

  // 1. Must be connected to the active DOM tree
  if (!video.isConnected) {
    return false;
  }

  // 2. Must not be hidden via display:none, visibility:hidden, or zero opacity
  if (!isElementVisibleInDOM(video)) {
    return false;
  }

  // 3. Must satisfy minimum rendered dimensions (from getBoundingClientRect)
  const rect = video.getBoundingClientRect();
  if (rect.width < config.minWidth || rect.height < config.minHeight) {
    return false;
  }

  // 4. Must not be clipped/hidden by parent overflow:hidden, clip-path, or carousel/slider
  if (context?.intersectionRatio !== undefined) {
    // If the visible ratio is negligible (e.g. scrolled or clipped away in a carousel)
    if (context.intersectionRatio <= 0.05) {
      return false;
    }
  }

  if (context?.intersectionRect) {
    // If the unclipped visible box is smaller than minimal usable controller dimensions
    const minVisibleWidth = Math.min(config.minWidth, 80);
    const minVisibleHeight = Math.min(config.minHeight, 60);
    if (context.intersectionRect.width < minVisibleWidth || context.intersectionRect.height < minVisibleHeight) {
      return false;
    }
  }

  // 5. Run site-specific adapter filter override if present
  if (customFilter && !customFilter(video)) {
    return false;
  }

  return true;
}
