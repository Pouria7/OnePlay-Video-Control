/**
 * Core type definitions for Universal Video Controls
 */

export enum VideoLifecycleState {
  DISCOVERED = 'DISCOVERED',
  TRACKED = 'TRACKED',
  CANDIDATE = 'CANDIDATE',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  REMOVED = 'REMOVED',
  CLEANED = 'CLEANED'
}

export type BuiltinThemeName = 'classic-dark' | 'midnight' | 'glass' | 'ocean-blue';

export interface VideoDimensions {
  width: number;
  height: number;
}

export interface VideoMediaState {
  paused: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
  readyState: number;
  ended: boolean;
}

export interface VideoScoreBreakdown {
  audibleBonus: number;
  playingMutedBonus: number;
  highVisibilityBonus: number;
  visibilityScore: number;
  dimensionScore: number;
  adapterBonus: number;
  total: number;
}

export type ShortcutAction =
  | 'togglePlay'
  | 'seekBackward'
  | 'seekForward'
  | 'volumeUp'
  | 'volumeDown'
  | 'toggleMute'
  | 'toggleFullscreen';

export interface ShortcutsConfig {
  togglePlay: string;
  seekBackward: string;
  seekForward: string;
  volumeUp: string;
  volumeDown: string;
  toggleMute: string;
  toggleFullscreen: string;
}
