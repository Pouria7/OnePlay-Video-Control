/**
 * Instagram Web Site Adapter
 *
 * Designed specifically for resilience against Instagram's dynamic obfuscated class names,
 * transparent tap-to-mute overlay wrappers, and SPA feed/reels routing.
 *
 * Implements context-driven lifecycle hooks and action interceptors (e.g. disabling fillToFit
 * on vertical reels when entering fullscreen, and adapting controller layout to minimal pill mode).
 */

import { GenericAdapter } from './generic-adapter';
import { SiteSettings } from '../../storage/types';
import { domainMatches } from '../../utils/url';
import { VideoCandidateContext } from '../detection/types';
import {
  AdapterActionHooks,
  VideoAdapterContext,
  VideoFilterContext,
  VideoScoreContext
} from './action-types';

export class InstagramAdapter extends GenericAdapter {
  override readonly id = 'instagram';
  override readonly name = 'Instagram Web Adapter';

  override matches(url: URL): boolean {
    return domainMatches(url.hostname, 'instagram.com');
  }

  override getConfigOverrides(_url?: URL): Partial<SiteSettings> {
    return {
      minWidth: 180,
      minHeight: 180,
      visibilityThreshold: 0.65,
      allowMultiple: false
    };
  }

  override filterVideo(input: VideoFilterContext | HTMLVideoElement): boolean {
    const video = input instanceof HTMLVideoElement ? input : input.video;
    const rect = video.getBoundingClientRect();
    // Exclude tiny story avatar circular preview videos
    return rect.width >= 140 && rect.height >= 140;
  }

  override scoreVideo(
    input: VideoScoreContext | HTMLVideoElement,
    legacyCandidate?: VideoCandidateContext
  ): number | null {
    const candidate = input instanceof HTMLVideoElement ? legacyCandidate : input.candidate;
    let bonus = 0;
    if (candidate && candidate.isPlaying && candidate.intersectionRatio >= 0.65) {
      bonus += 150;
    }
    return bonus;
  }

  override onVideoActivated(ctx: VideoAdapterContext): void {
    ctx.video.style.pointerEvents = 'auto';

    // On Reels, Stories, or vertical videos, set layout to minimal (pill) if controller is enabled
    const isReelOrStory =
      (ctx.url && (ctx.url.pathname.includes('/reel') || ctx.url.pathname.includes('/stories'))) ||
      (ctx.video.videoHeight > 0 && ctx.video.videoHeight > ctx.video.videoWidth);

    if (isReelOrStory && ctx.settings.enabled !== false) {
      ctx.updateSettings({ controlsLayout: 'minimal' });
    }
  }

  override readonly actions: AdapterActionHooks = {
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
