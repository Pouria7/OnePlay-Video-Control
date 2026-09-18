/**
 * Video Detection and Lifecycle types
 */

import { VideoDimensions, VideoLifecycleState, VideoScoreBreakdown } from '../../types';

export interface VideoDetectionConfig {
  minWidth: number;
  minHeight: number;
  visibilityThreshold: number;
  allowMultiple: boolean;
}

export interface VideoCandidateContext {
  intersectionRatio: number;
  boundingRect: DOMRect;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
}

export interface TrackedVideo {
  readonly id: string;
  readonly element: HTMLVideoElement;
  state: VideoLifecycleState;
  intersectionRatio: number;
  boundingRect: DOMRect;
  dimensions: VideoDimensions;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
  score: number;
  scoreBreakdown?: VideoScoreBreakdown;
  lastUpdated: number;
}
