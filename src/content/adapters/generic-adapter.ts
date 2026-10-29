/**
 * Generic Default Site Adapter
 *
 * Provides standard fallback behavior and universal defaults
 * for any web page without hardcoded site rules.
 */

import { SiteAdapter } from './site-adapter';
import { SiteSettings } from '../../storage/types';
import {
  AdapterActionHooks,
  VideoAdapterContext,
  VideoContext,
  VideoFilterContext,
  VideoScoreContext
} from './action-types';

export class GenericAdapter implements SiteAdapter {
  readonly id = 'generic';
  readonly name = 'Universal Generic Adapter';

  matches(_url: URL): boolean {
    return true; // Catch-all fallback
  }

  getConfigOverrides(_url?: URL): Partial<SiteSettings> {
    return {};
  }

  filterVideo(_ctx: VideoFilterContext | HTMLVideoElement): boolean {
    return true;
  }

  scoreVideo(_ctx: VideoScoreContext | HTMLVideoElement): number | null {
    return null;
  }

  onVideoDetected(_ctx: VideoContext | HTMLVideoElement): void {}

  onVideoActivated(_ctx: VideoAdapterContext): void {}

  onVideoDeactivated(_ctx: VideoAdapterContext): void {}

  onControllerHover(_ctx: VideoAdapterContext, _isHovered: boolean): void {}

  readonly actions: AdapterActionHooks = {
    toggleFullscreen: {
      // Universal baseline: prevent vertical videos from stretching or cropping in fullscreen
      before: ({ video, payload }) => {
        const isVertical = video.videoHeight > video.videoWidth;
        if (payload.entering && isVertical) {
          payload.fillToFit = false;
        }
      }
    }
  };
}
