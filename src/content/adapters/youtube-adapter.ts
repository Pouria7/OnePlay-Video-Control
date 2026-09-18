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

  matches(url: URL): boolean {
    return domainMatches(url.hostname, 'youtube.com');
  }

  getConfigOverrides(): Partial<SiteSettings> {
    return {
      minWidth: 120,
      minHeight: 80,
      visibilityThreshold: 0.5,
      allowMultiple: false // Only one active preview at a time
    };
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
   * Strictly allow only YouTube preview cards.
   * Excludes main watch player via maximum size threshold (500x420) and container checks,
   * while allowing small preview cards in sidebar on /watch or in feed.
   */
  filterVideo(video: HTMLVideoElement): boolean {
    // 1. Exclude videos exceeding maximum preview dimensions (main watch player is large)
    const rect = video.getBoundingClientRect();
    const maxVideoWidth = 500;
    const maxVideoHeight = 420;
    if (rect.width > maxVideoWidth || rect.height > maxVideoHeight) {
      return false;
    }

    // 2. Exclude main watch player containers & Shorts player
    if (
      video.closest(
        'ytd-watch-flexy, ytd-watch-grid, #full-bleed-container, ytd-reel-video-renderer, ytd-shorts'
      )
    ) {
      if (!video.closest('ytd-video-preview, #inline-preview-player')) {
        return false;
      }
    }

    if (video.closest('#movie_player:not(#inline-preview-player)')) {
      if (!video.closest('ytd-video-preview, #inline-preview-player')) {
        return false;
      }
    }

    // 3. Only allow YouTube's inline preview player
    const preview = video.closest('ytd-video-preview') || document.querySelector('ytd-video-preview');
    if (preview) {
      this.bindPreviewElement(preview);
      return true;
    }

    const isInline = !!video.closest('#inline-preview-player, ytd-player#inline-player');
    return isInline;
  }

  scoreVideo(_video: HTMLVideoElement, context: VideoCandidateContext): number | null {
    if (context.isPlaying && context.intersectionRatio > 0.3) {
      return 200;
    }
    return 0;
  }

  onVideoDetected(video: HTMLVideoElement): void {
    const preview = video.closest('ytd-video-preview') || document.querySelector('ytd-video-preview');
    if (preview) {
      this.bindPreviewElement(preview);
    }
  }

  onVideoActivated(video: HTMLVideoElement): void {
    const preview = video.closest('ytd-video-preview') || document.querySelector('ytd-video-preview');
    if (preview) {
      this.bindPreviewElement(preview);
    }
  }
}
