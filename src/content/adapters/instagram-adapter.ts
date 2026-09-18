/**
 * Instagram Web Site Adapter
 *
 * Designed specifically for resilience against Instagram's dynamic obfuscated class names,
 * transparent tap-to-mute overlay wrappers, and SPA feed/reels routing.
 *
 * Crucially:
 * - Does NOT touch or inject into Instagram's player DOM.
 * - Does NOT depend on generated React or GraphQL CSS class names.
 * - Configures optimal dimensions for Reels, Stories, and Feed posts.
 */

import { SiteAdapter } from './site-adapter';
import { SiteSettings } from '../../storage/types';
import { domainMatches } from '../../utils/url';
import { VideoCandidateContext } from '../detection/types';

export class InstagramAdapter implements SiteAdapter {
  readonly id = 'instagram';
  readonly name = 'Instagram Web Adapter';

  matches(url: URL): boolean {
    return domainMatches(url.hostname, 'instagram.com');
  }

  getConfigOverrides(): Partial<SiteSettings> {
    return {
      // Instagram feed and reel videos are at least 180x180px
      minWidth: 180,
      minHeight: 180,
      visibilityThreshold: 0.65, // Slightly more lenient threshold for scroll feeds
      allowMultiple: false // In Instagram feed/reels, user expects controls on the primary visible item
    };
  }

  /**
   * Filter out Instagram story preview thumbnails or background preloaders
   */
  filterVideo(video: HTMLVideoElement): boolean {
    const rect = video.getBoundingClientRect();
    // Exclude tiny story avatar circular preview videos
    if (rect.width < 140 || rect.height < 140) {
      return false;
    }
    return true;
  }

  /**
   * Instagram-specific scoring:
   * Boost videos that are actively rendering frames in viewport
   */
  scoreVideo(_video: HTMLVideoElement, context: VideoCandidateContext): number | null {
    let bonus = 0;
    // Instagram Reels often autoplay muted in feed; give high visibility muted videos a strong boost
    if (context.isPlaying && context.intersectionRatio >= 0.65) {
      bonus += 150;
    }
    return bonus;
  }

  onVideoActivated(video: HTMLVideoElement): void {
    // Ensure video pointer events don't break when our floating controller overlays it
    video.style.pointerEvents = 'auto';
  }
}
