/**
 * Video Scoring Engine
 *
 * Implements the hierarchical scoring logic:
 * 1. Playing + Audible (> 0 vol and !muted) -> highest baseline bonus (+1000)
 * 2. Playing + Muted -> secondary baseline bonus (+500)
 * 3. 70% Visibility Rule -> high priority visibility bonus (+300)
 * 4. Continuous viewport visibility ratio -> proportional score (0 - 100)
 * 5. Rendered area bonus -> proportional (0 - 50)
 * 6. Site adapter custom score modifier
 */

import { VideoCandidateContext } from './types';
import { VideoScoreBreakdown } from '../../types';

export function calculateVideoScore(
  video: HTMLVideoElement,
  context: VideoCandidateContext,
  visibilityThreshold = 0.7,
  customScorer?: (video: HTMLVideoElement, context: VideoCandidateContext) => number | null
): VideoScoreBreakdown {
  let audibleBonus = 0;
  let playingMutedBonus = 0;
  let highVisibilityBonus = 0;

  const isAudible = context.isPlaying && !context.isMuted && context.volume > 0;
  const isPlayingMuted = context.isPlaying && (context.isMuted || context.volume === 0);

  // Audible playback priority
  if (isAudible) {
    audibleBonus = 1000;
  } else if (isPlayingMuted) {
    playingMutedBonus = 500;
  }

  // 70% (or configured threshold) Visibility Rule
  if (context.intersectionRatio >= visibilityThreshold) {
    highVisibilityBonus = 300;
  }

  // Viewport intersection score (0 to 100)
  const visibilityScore = Math.round(context.intersectionRatio * 100);

  // Rendered area score (up to 50 pts, favoring prominent video elements)
  const area = context.boundingRect.width * context.boundingRect.height;
  const dimensionScore = Math.min(50, Math.round(area / 10000));

  // Site adapter bonus/override
  let adapterBonus = 0;
  if (customScorer) {
    const custom = customScorer(video, context);
    if (custom !== null && !isNaN(custom)) {
      adapterBonus = custom;
    }
  }

  const total =
    audibleBonus +
    playingMutedBonus +
    highVisibilityBonus +
    visibilityScore +
    dimensionScore +
    adapterBonus;

  return {
    audibleBonus,
    playingMutedBonus,
    highVisibilityBonus,
    visibilityScore,
    dimensionScore,
    adapterBonus,
    total
  };
}
