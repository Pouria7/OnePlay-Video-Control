import { describe, it, expect } from 'vitest';
import { selectActiveVideos } from '../src/content/detection/video-selector';
import { TrackedVideo, VideoDetectionConfig } from '../src/content/detection/types';
import { VideoLifecycleState } from '../src/types';

describe('VideoSelector', () => {
  const config: VideoDetectionConfig = {
    minWidth: 160,
    minHeight: 120,
    visibilityThreshold: 0.7,
    allowMultiple: true
  };

  const createMockCandidate = (overrides: Partial<TrackedVideo>): TrackedVideo => {
    const video = document.createElement('video');
    return {
      id: `test-${Math.random()}`,
      element: video,
      state: VideoLifecycleState.CANDIDATE,
      intersectionRatio: 0.5,
      boundingRect: { width: 640, height: 360, left: 0, top: 0, right: 640, bottom: 360 } as DOMRect,
      dimensions: { width: 640, height: 360 },
      isPlaying: false,
      isMuted: true,
      volume: 1.0,
      currentTime: 0,
      duration: 100,
      playbackRate: 1,
      score: 100,
      lastUpdated: Date.now(),
      ...overrides
    };
  };

  it('prefers audible playing videos over muted playing videos even if muted has higher visibility', () => {
    // Video A: playing + unmuted + 40%
    const videoA = createMockCandidate({
      id: 'video-A',
      isPlaying: true,
      isMuted: false,
      volume: 1.0,
      intersectionRatio: 0.4,
      score: 1060
    });

    // Video B: playing + muted + 90%
    const videoB = createMockCandidate({
      id: 'video-B',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.9,
      score: 910
    });

    // Video C: playing + muted + 75%
    const videoC = createMockCandidate({
      id: 'video-C',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.75,
      score: 895
    });

    const selected = selectActiveVideos([videoA, videoB, videoC], config);
    expect(selected.length).toBe(1);
    expect(selected[0].id).toBe('video-A');
  });

  it('supports multiple active videos when all are muted and multiple meet >= 70% threshold', () => {
    const videoB = createMockCandidate({
      id: 'video-B',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.9,
      score: 910
    });

    const videoC = createMockCandidate({
      id: 'video-C',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.75,
      score: 895
    });

    const videoD = createMockCandidate({
      id: 'video-D',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.3,
      score: 550
    });

    const selected = selectActiveVideos([videoB, videoC, videoD], config);

    // Both videoB (90%) and videoC (75%) qualify under the 70% rule!
    expect(selected.length).toBe(2);
    expect(selected.map((c) => c.id)).toEqual(['video-B', 'video-C']);
  });

  it('selects single highest scored video when allowMultiple is false', () => {
    const singleConfig: VideoDetectionConfig = {
      ...config,
      allowMultiple: false
    };

    const videoB = createMockCandidate({
      id: 'video-B',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.9,
      score: 910
    });

    const videoC = createMockCandidate({
      id: 'video-C',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.75,
      score: 895
    });

    const selected = selectActiveVideos([videoB, videoC], singleConfig);
    expect(selected.length).toBe(1);
    expect(selected[0].id).toBe('video-B');
  });

  it('prioritizes video with highest visibility when no video reaches 70%', () => {
    // Video A: 61%
    const videoA = createMockCandidate({
      id: 'video-A',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.61,
      score: 580
    });

    // Video B: 48%
    const videoB = createMockCandidate({
      id: 'video-B',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.48,
      score: 565
    });

    // Video C: 32%
    const videoC = createMockCandidate({
      id: 'video-C',
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.32,
      score: 545
    });

    const singleConfig: VideoDetectionConfig = {
      ...config,
      allowMultiple: false
    };

    const selected = selectActiveVideos([videoA, videoB, videoC], singleConfig);
    expect(selected.length).toBe(1);
    expect(selected[0].id).toBe('video-A');
  });

  it('respects custom adapter selectVideos override', () => {
    const videoA = createMockCandidate({ id: 'video-A' });
    const videoB = createMockCandidate({ id: 'video-B' });

    const customSelector = (candidates: TrackedVideo[]) => {
      return candidates.filter((c) => c.id === 'video-B');
    };

    const selected = selectActiveVideos([videoA, videoB], config, customSelector);
    expect(selected.length).toBe(1);
    expect(selected[0].id).toBe('video-B');
  });
});
