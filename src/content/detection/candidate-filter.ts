/**
 * Video Candidate Filter
 *
 * Evaluates whether an HTML5 video element is eligible to become a candidate
 * for floating video controls, checking rendered bounding dimensions and DOM visibility.
 */

import { VideoDetectionConfig } from './types';
import { isElementVisibleInDOM } from '../../utils/dom';

export function isCandidateVideo(
  video: HTMLVideoElement,
  config: VideoDetectionConfig,
  customFilter?: (video: HTMLVideoElement) => boolean
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

  // 4. Run site-specific adapter filter override if present
  if (customFilter && !customFilter(video)) {
    return false;
  }

  return true;
}
