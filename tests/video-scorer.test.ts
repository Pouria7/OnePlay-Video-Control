import { describe, it, expect, beforeEach } from 'vitest';
import { calculateVideoScore } from '../src/content/detection/video-scorer';

describe('VideoScorer', () => {
  let video: HTMLVideoElement;
  const mockRect = { width: 640, height: 360, left: 0, top: 0, right: 640, bottom: 360 } as DOMRect;

  beforeEach(() => {
    video = document.createElement('video');
  });

  it('awards +1000 audible bonus for playing unmuted videos with volume > 0', () => {
    const score = calculateVideoScore(video, {
      isPlaying: true,
      isMuted: false,
      volume: 0.8,
      intersectionRatio: 0.5,
      boundingRect: mockRect
    });

    expect(score.audibleBonus).toBe(1000);
    expect(score.playingMutedBonus).toBe(0);
  });

  it('awards +500 bonus for playing muted videos', () => {
    const score = calculateVideoScore(video, {
      isPlaying: true,
      isMuted: true,
      volume: 0.8,
      intersectionRatio: 0.5,
      boundingRect: mockRect
    });

    expect(score.audibleBonus).toBe(0);
    expect(score.playingMutedBonus).toBe(500);
  });

  it('awards zero playback bonus for paused videos', () => {
    const score = calculateVideoScore(video, {
      isPlaying: false,
      isMuted: false,
      volume: 1.0,
      intersectionRatio: 0.5,
      boundingRect: mockRect
    });

    expect(score.audibleBonus).toBe(0);
    expect(score.playingMutedBonus).toBe(0);
  });

  it('awards +300 high visibility bonus when intersection ratio >= 70%', () => {
    const score70 = calculateVideoScore(video, {
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.7,
      boundingRect: mockRect
    });
    expect(score70.highVisibilityBonus).toBe(300);

    const score80 = calculateVideoScore(video, {
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.8,
      boundingRect: mockRect
    });
    expect(score80.highVisibilityBonus).toBe(300);

    const score100 = calculateVideoScore(video, {
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 1.0,
      boundingRect: mockRect
    });
    expect(score100.highVisibilityBonus).toBe(300);
  });

  it('does NOT award high visibility bonus when intersection ratio is below 70% (e.g. 69%, 50%, 10%, 0%)', () => {
    const score69 = calculateVideoScore(video, {
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.69,
      boundingRect: mockRect
    });
    expect(score69.highVisibilityBonus).toBe(0);

    const score50 = calculateVideoScore(video, {
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.5,
      boundingRect: mockRect
    });
    expect(score50.highVisibilityBonus).toBe(0);

    const score10 = calculateVideoScore(video, {
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.1,
      boundingRect: mockRect
    });
    expect(score10.highVisibilityBonus).toBe(0);

    const score0 = calculateVideoScore(video, {
      isPlaying: true,
      isMuted: true,
      volume: 0,
      intersectionRatio: 0.0,
      boundingRect: mockRect
    });
    expect(score0.highVisibilityBonus).toBe(0);
  });

  it('incorporates site adapter custom score modifier', () => {
    const score = calculateVideoScore(
      video,
      {
        isPlaying: true,
        isMuted: true,
        volume: 0,
        intersectionRatio: 0.5,
        boundingRect: mockRect
      },
      0.7,
      () => 150
    );

    expect(score.adapterBonus).toBe(150);
    expect(score.total).toBe(score.playingMutedBonus + score.visibilityScore + score.dimensionScore + 150);
  });
});
