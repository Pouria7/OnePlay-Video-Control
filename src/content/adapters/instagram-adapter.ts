/**
 * Instagram Web Site Adapter
 *
 * Designed specifically for resilience against Instagram's dynamic obfuscated class names,
 * transparent tap-to-mute overlay wrappers, and SPA feed/reels routing.
 *
 * Implements context-driven lifecycle hooks and action interceptors (e.g. disabling fillToFit
 * on vertical reels when entering fullscreen).
 */

import { SiteAdapter } from './site-adapter';
import { SiteSettings } from '../../storage/types';
import { domainMatches } from '../../utils/url';
import { VideoCandidateContext } from '../detection/types';
import { AdapterActionHooks, VideoAdapterContext } from './action-types';

export class InstagramAdapter implements SiteAdapter {
  readonly id = 'instagram';
  readonly name = 'Instagram Web Adapter';

  matches(url: URL): boolean {
    return domainMatches(url.hostname, 'instagram.com');
  }

  getConfigOverrides(): Partial<SiteSettings> {
    return {
      minWidth: 180,
      minHeight: 180,
      visibilityThreshold: 0.65,
      allowMultiple: false
    };
  }

  filterVideo(video: HTMLVideoElement): boolean {
    const rect = video.getBoundingClientRect();
    return rect.width >= 140 && rect.height >= 140;
  }

  scoreVideo(_video: HTMLVideoElement, context: VideoCandidateContext): number | null {
    let bonus = 0;
    if (context.isPlaying && context.intersectionRatio >= 0.65) {
      bonus += 150;
    }
    return bonus;
  }

  onVideoActivated({ video }: VideoAdapterContext): void {
    video.style.pointerEvents = 'auto';
  }

  readonly actions: AdapterActionHooks = {
    toggleFullscreen: {
      // Keep execution fast (no long setTimeout) to preserve browser fullscreen User Gesture
      before: ({ video, payload }) => {
        const isVertical = video.videoHeight > video.videoWidth;
        if (payload.entering && isVertical) {
          payload.fillToFit = false;
        }
      }
    }
  };
}
