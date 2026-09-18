/**
 * Candidate Video Selection Engine
 *
 * Implements candidate prioritization, 70% visibility rule,
 * and multiple active video controller resolution.
 */

import { TrackedVideo, VideoDetectionConfig } from './types';

export function selectActiveVideos(
  candidates: TrackedVideo[],
  config: VideoDetectionConfig,
  customSelector?: (candidates: TrackedVideo[]) => TrackedVideo[] | null
): TrackedVideo[] {
  if (!candidates || candidates.length === 0) {
    return [];
  }

  // 1. Run site adapter selector override if provided
  if (customSelector) {
    const customResult = customSelector(candidates);
    if (customResult !== null) {
      return customResult;
    }
  }

  // 2. Separate candidates by media state
  const audiblePlaying = candidates.filter(
    (c) => c.isPlaying && !c.isMuted && c.volume > 0 && c.intersectionRatio > 0.05
  );

  const mutedPlaying = candidates.filter(
    (c) => c.isPlaying && (c.isMuted || c.volume === 0) && c.intersectionRatio > 0.1
  );

  const visiblePaused = candidates.filter(
    (c) => !c.isPlaying && c.intersectionRatio >= config.visibilityThreshold
  );

  // Group 1: Audible playing videos take top priority
  if (audiblePlaying.length > 0) {
    if (!config.allowMultiple) {
      // Return highest scored audible video
      return [audiblePlaying.sort((a, b) => b.score - a.score)[0]];
    }
    // Return all audible playing videos
    return audiblePlaying.sort((a, b) => b.score - a.score);
  }

  // Group 2: All playing candidate videos are muted
  // Check 70% (or configured) visibility rule
  const highlyVisiblePlaying = mutedPlaying.filter(
    (c) => c.intersectionRatio >= config.visibilityThreshold
  );

  if (highlyVisiblePlaying.length > 0) {
    if (!config.allowMultiple) {
      return [highlyVisiblePlaying.sort((a, b) => b.score - a.score)[0]];
    }
    // Multiple videos reaching >= 70% visibility rule remain active simultaneously!
    return highlyVisiblePlaying.sort((a, b) => b.score - a.score);
  }

  // Group 3: No playing video reached >= 70% visibility
  if (mutedPlaying.length > 0) {
    // Sort by highest visibility ratio
    const sortedMuted = [...mutedPlaying].sort((a, b) => {
      if (Math.abs(b.intersectionRatio - a.intersectionRatio) > 0.05) {
        return b.intersectionRatio - a.intersectionRatio;
      }
      return b.score - a.score;
    });

    if (!config.allowMultiple) {
      return [sortedMuted[0]];
    }

    // Keep the top visible video(s) that have significant visibility (e.g. >= 25%)
    const topRatio = sortedMuted[0].intersectionRatio;
    return sortedMuted.filter((c) => c.intersectionRatio >= Math.max(0.25, topRatio - 0.15));
  }

  // Group 4: No playing videos, but videos paused in viewport with high visibility
  if (visiblePaused.length > 0) {
    const sortedPaused = [...visiblePaused].sort((a, b) => b.score - a.score);
    if (!config.allowMultiple) {
      return [sortedPaused[0]];
    }
    return sortedPaused;
  }

  // No active candidates meet the criteria
  return [];
}
