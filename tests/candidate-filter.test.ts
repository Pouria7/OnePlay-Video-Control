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

  it('YouTubeAdapter rejects oversized main players and accepts small previews', async () => {
    const { YouTubeAdapter } = await import('../src/content/adapters/youtube-adapter');
    const adapter = new YouTubeAdapter();

    // Oversized video (like main watch player, e.g. 1280x720)
    video.getBoundingClientRect = () =>
      ({ width: 1280, height: 720, left: 0, top: 0, right: 1280, bottom: 720 } as DOMRect);
    expect(adapter.filterVideo(video)).toBe(false);

    // Small video outside preview container
    video.getBoundingClientRect = () =>
      ({ width: 360, height: 202, left: 0, top: 0, right: 360, bottom: 202 } as DOMRect);
    expect(adapter.filterVideo(video)).toBe(false);

    // Small video inside preview container
    const preview = document.createElement('ytd-video-preview');
    preview.appendChild(video);
    document.body.appendChild(preview);

    expect(adapter.filterVideo(video)).toBe(true);
  });
});
