import { describe, it, expect, beforeEach } from 'vitest';
import { isCandidateVideo } from '../src/content/detection/candidate-filter';
import { VideoDetectionConfig } from '../src/content/detection/types';

describe('CandidateFilter', () => {
  let video: HTMLVideoElement;
  const config: VideoDetectionConfig = {
    minWidth: 160,
    minHeight: 120,
    visibilityThreshold: 0.7,
    allowMultiple: true
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    video = document.createElement('video');
    document.body.appendChild(video);
  });

  it('rejects videos disconnected from DOM', () => {
    const detached = document.createElement('video');
    expect(isCandidateVideo(detached, config)).toBe(false);
  });

  it('rejects videos smaller than minimum dimensions', () => {
    // Mock getBoundingClientRect
    video.getBoundingClientRect = () =>
      ({ width: 100, height: 80, left: 0, top: 0, right: 100, bottom: 80 } as DOMRect);

    expect(isCandidateVideo(video, config)).toBe(false);
  });

  it('accepts videos meeting or exceeding minimum dimensions', () => {
    video.getBoundingClientRect = () =>
      ({ width: 400, height: 300, left: 0, top: 0, right: 400, bottom: 300 } as DOMRect);

    expect(isCandidateVideo(video, config)).toBe(true);
  });

  it('rejects videos hidden by display: none', () => {
    video.style.display = 'none';
    video.getBoundingClientRect = () =>
      ({ width: 400, height: 300, left: 0, top: 0, right: 400, bottom: 300 } as DOMRect);

    expect(isCandidateVideo(video, config)).toBe(false);
  });

  it('rejects videos hidden by visibility: hidden', () => {
    video.style.visibility = 'hidden';
    video.getBoundingClientRect = () =>
      ({ width: 400, height: 300, left: 0, top: 0, right: 400, bottom: 300 } as DOMRect);

    expect(isCandidateVideo(video, config)).toBe(false);
  });

  it('respects custom adapter filter', () => {
    video.getBoundingClientRect = () =>
      ({ width: 400, height: 300, left: 0, top: 0, right: 400, bottom: 300 } as DOMRect);

    const rejectFilter = () => false;
    expect(isCandidateVideo(video, config, rejectFilter)).toBe(false);

    const allowFilter = () => true;
    expect(isCandidateVideo(video, config, allowFilter)).toBe(true);
  });

  it('rejects videos hidden or clipped by parent overflow/carousel (intersectionRatio <= 0.05)', () => {
    video.getBoundingClientRect = () =>
      ({ width: 600, height: 400, left: 0, top: 0, right: 600, bottom: 400 } as DOMRect);

    // Completely clipped or scrolled out of carousel view
    expect(isCandidateVideo(video, config, undefined, { intersectionRatio: 0 })).toBe(false);
    expect(isCandidateVideo(video, config, undefined, { intersectionRatio: 0.04 })).toBe(false);

    // Visible in carousel (e.g. 50% or 100% visible)
    expect(isCandidateVideo(video, config, undefined, { intersectionRatio: 0.5 })).toBe(true);
  });

  it('rejects videos when unclipped visible box (intersectionRect) is smaller than minimal usable dimensions', () => {
    video.getBoundingClientRect = () =>
      ({ width: 600, height: 400, left: 0, top: 0, right: 600, bottom: 400 } as DOMRect);

    // Only a 20px sliver peeking out of a carousel border
    const tinyIntersectionRect = {
      width: 20,
      height: 400,
      left: 0,
      top: 0,
      right: 20,
      bottom: 400
    } as DOMRectReadOnly;

    expect(
      isCandidateVideo(video, config, undefined, {
        intersectionRatio: 0.1,
        intersectionRect: tinyIntersectionRect
      })
    ).toBe(false);

    // Adequate visible portion inside carousel
    const adequateIntersectionRect = {
      width: 300,
      height: 200,
      left: 0,
      top: 0,
      right: 300,
      bottom: 200
    } as DOMRectReadOnly;

    expect(
      isCandidateVideo(video, config, undefined, {
        intersectionRatio: 0.5,
        intersectionRect: adequateIntersectionRect
      })
    ).toBe(true);
  });

  it('YouTubeAdapter rejects oversized main players and accepts small previews', async () => {
    const { YouTubeAdapter } = await import('../src/content/adapters/youtube-adapter');
    const adapter = new YouTubeAdapter();

    // Oversized video (like main watch player, e.g. 1280x720)
    video.getBoundingClientRect = () =>
      ({ width: 1280, height: 720, left: 0, top: 0, right: 1280, bottom: 720 } as DOMRect);
    expect(adapter.filterVideo(video)).toBe(false);

    // Small video inside main primary player (rejected)
    video.getBoundingClientRect = () =>
      ({ width: 360, height: 202, left: 0, top: 0, right: 360, bottom: 202 } as DOMRect);
    const primary = document.createElement('div');
    primary.id = 'primary';
    const player = document.createElement('div');
    player.id = 'player';
    player.appendChild(video);
    primary.appendChild(player);
    document.body.appendChild(primary);
    expect(adapter.filterVideo(video)).toBe(false);

    // Small video inside sidebar #secondary (accepted!)
    document.body.innerHTML = '';
    const secondary = document.createElement('div');
    secondary.id = 'secondary';
    secondary.appendChild(video);
    document.body.appendChild(secondary);
    expect(adapter.filterVideo(video)).toBe(true);

    // Small video inside preview container (accepted!)
    document.body.innerHTML = '';
    const preview = document.createElement('ytd-video-preview');
    preview.appendChild(video);
    document.body.appendChild(preview);

    expect(adapter.filterVideo(video)).toBe(true);
  });
});
