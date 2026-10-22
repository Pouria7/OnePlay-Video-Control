/**
 * YouTube Site Adapter
 *
 * Dedicated strictly to YouTube's inline preview video cards (e.g. on homepage/feed).
 *
 * Excludes YouTube's main watch player entirely, and binds a single capture-phase
 * mouseleave event blocker directly to <ytd-video-preview> as soon as it appears,
 * preventing preview deactivation when hovering the floating controller.
 */

import { SiteAdapter } from './site-adapter';
import { SiteSettings } from '../../storage/types';
import { domainMatches } from '../../utils/url';
import { VideoCandidateContext } from '../detection/types';

export class YouTubeAdapter implements SiteAdapter {
  readonly id = 'youtube';
  readonly name = 'YouTube Adapter';

  // Ensures we only attach the mouseleave listener once per preview element
  private boundPreviews = new WeakSet<Element>();
  private audioInterceptors = new WeakSet<HTMLVideoElement>();

  matches(url: URL): boolean {
    return domainMatches(url.hostname, 'youtube.com');
  }

  getConfigOverrides(): Partial<SiteSettings> {
    return {
      minWidth: 100,
      minHeight: 60,
      visibilityThreshold: 0.2,
      allowMultiple: false // Only one active preview at a time
    };
  }

  /**
   * Suppresses YouTube's automatic volume muting and event listeners on preview videos.
   */
  private interceptVideoAudio(video: HTMLVideoElement): void {
    if (this.audioInterceptors.has(video)) return;
    this.audioInterceptors.add(video);

    // 1. Block volumechange events from propagating to YouTube's internal handlers
    video.addEventListener(
      'volumechange',
      (e) => {
        // Stop YouTube's inline preview scripts from catching the event and resetting volume
        e.stopImmediatePropagation();
      },
      true // Capture phase intercepts before YouTube's bubble/target listeners
    );

    // 2. Clear any HTML attributes forcing mute on detected preview
    video.removeAttribute('muted');
    if (video.muted) {
      video.muted = false;
    }
  }

  /**
   * Binds mouseleave with stopImmediatePropagation directly to ytd-video-preview once
   */
  private bindPreviewElement(element: Element | null): void {
    if (!element || this.boundPreviews.has(element)) return;
    this.boundPreviews.add(element);

    element.addEventListener(
      'mouseleave',
      (e) => {
        e.stopImmediatePropagation();
      },
      true
    );
  }

  /**
   * YouTube Candidate Filter:
   * 1. Whitelists preview video cards (inline-player, ytd-video-preview, secondary/sidebar recommendations).
   * 2. Excludes YouTube's main watch player.
   * 3. Excludes full-screen Shorts reels.
   */
  filterVideo(video: HTMLVideoElement): boolean {
    // 1. Explicitly ALLOW any preview player video
    const isPreview = !!video.closest(
      'ytd-video-preview, #video-preview, #inline-preview-player, ytd-player#inline-player'
    );
    if (isPreview) {
      const previewEl = video.closest('ytd-video-preview');
      if (previewEl) {
        this.bindPreviewElement(previewEl as HTMLElement);
      }
      return true;
    }

    // 2. Exclude YouTube's main watch player containers
    const isMainWatchPlayer = !!video.closest(
      'ytd-watch-flexy, ytd-watch-grid, #player-theater-container, #full-bleed-container, #primary #player, #primary #ytd-player'
    );
    if (isMainWatchPlayer) {
      return false;
    }

    // 3. Exclude Shorts full-screen reel player
    if (video.closest('ytd-shorts, ytd-reel-video-renderer')) {
      return false;
    }

    // 4. Exclude oversized videos (main player exceeds 550x420 when not in a preview container)
    const rect = video.getBoundingClientRect();
    if (rect.width > 550 || rect.height > 420) {
      return false;
    }

    return true;
  }

  scoreVideo(_video: HTMLVideoElement, context: VideoCandidateContext): number | null {
    if (context.isPlaying) {
      return 300;
    }
    return 100;
  }

  onVideoDetected(video: HTMLVideoElement): void {
    this.interceptVideoAudio(video);
    const preview = video.closest('ytd-video-preview') || document.querySelector('ytd-video-preview');
    if (preview) {
      this.bindPreviewElement(preview);
    }
  }

  onVideoActivated(video: HTMLVideoElement): void {
    this.interceptVideoAudio(video);
    const preview = video.closest('ytd-video-preview') || document.querySelector('ytd-video-preview');
    if (preview) {
      this.bindPreviewElement(preview);
    }
  }
}
