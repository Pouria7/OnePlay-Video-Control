import { describe, it, expect, beforeEach } from 'vitest';
import { VideoRegistry } from '../src/content/detection/video-registry';
import { VideoDetectionConfig } from '../src/content/detection/types';
import { VideoLifecycleState } from '../src/types';

describe('VideoRegistry with Adapter Hooks', () => {
  let registry: VideoRegistry;
  let video1: HTMLVideoElement;
  let video2: HTMLVideoElement;

  const config: VideoDetectionConfig = {
    minWidth: 160,
    minHeight: 120,
    visibilityThreshold: 0.7,
    allowMultiple: true
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    video1 = document.createElement('video');
    video2 = document.createElement('video');
    document.body.appendChild(video1);
    document.body.appendChild(video2);

    video1.getBoundingClientRect = () =>
      ({ width: 300, height: 200, left: 0, top: 0, right: 300, bottom: 200 } as DOMRect);
    video2.getBoundingClientRect = () =>
      ({ width: 600, height: 400, left: 0, top: 0, right: 600, bottom: 400 } as DOMRect);
  });

  it('excludes videos rejected by filterVideo hook from candidates', () => {
    // Adapter filter that only allows video1
    const filterVideo = (v: HTMLVideoElement) => v === video1;

    registry = new VideoRegistry(undefined, undefined, { filterVideo });

    const rec1 = registry.register(video1, config);
    const rec2 = registry.register(video2, config);

    expect(rec1.state).toBe(VideoLifecycleState.CANDIDATE);
    expect(rec2.state).toBe(VideoLifecycleState.INACTIVE);
    expect(rec2.score).toBe(0);

    const candidates = registry.getCandidates();
    expect(candidates.length).toBe(1);
    expect(candidates[0].element).toBe(video1);
  });

  it('incorporates scoreVideo hook bonus into calculated score', () => {
    const scoreVideo = (_v: HTMLVideoElement) => 250;

    registry = new VideoRegistry(undefined, undefined, { scoreVideo });

    const rec = registry.register(video1, config);
    expect(rec.scoreBreakdown?.adapterBonus).toBe(250);
    expect(rec.score).toBeGreaterThanOrEqual(250);
  });

  it('updates video eligibility when hooks change dynamically via setHooks', () => {
    registry = new VideoRegistry();

    const rec1 = registry.register(video1, config);
    const rec2 = registry.register(video2, config);

    expect(registry.getCandidates().length).toBe(2);

    // Now set a filter that excludes video2
    registry.setHooks({
      filterVideo: (v) => v === video1
    });

    registry.updateAll(config);

    const candidates = registry.getCandidates();
    expect(candidates.length).toBe(1);
    expect(candidates[0].element).toBe(video1);
    expect(rec2.state).toBe(VideoLifecycleState.INACTIVE);
  });
});
