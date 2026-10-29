/**
 * YouTube Site Adapter
 *
 * Dedicated strictly to YouTube's inline preview video cards (e.g. on homepage/feed)
 * and vertical Shorts reels.
 *
 * Excludes YouTube's main watch player, and binds a single capture-phase
 * mouseleave event blocker directly to <ytd-video-preview> as soon as it appears,
 * preventing preview deactivation when hovering the floating controller.
 */

import { GenericAdapter } from './generic-adapter';
import { SiteSettings } from '../../storage/types';
import { domainMatches } from '../../utils/url';
import { VideoCandidateContext } from '../detection/types';
import {
  VideoAdapterContext,
  VideoContext,
  VideoFilterContext,
  VideoScoreContext
} from './action-types';

export class YouTubeAdapter extends GenericAdapter {
  override readonly id = 'youtube';
  override readonly name = 'YouTube Adapter';

  // Ensures we only attach the mouseleave listener once per preview element
  private boundPreviews = new WeakSet<Element>();
  private audioInterceptors = new WeakSet<HTMLVideoElement>();

  override matches(url: URL): boolean {
    return domainMatches(url.hostname, 'youtube.com');
  }

  override getConfigOverrides(_url?: URL): Partial<SiteSettings> {
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
   * 2. Whitelists Shorts video reels (does not exclude them).
   * 3. Excludes YouTube's main watch player.
   */
  override filterVideo(input: VideoFilterContext | HTMLVideoElement): boolean {
    const video = input instanceof HTMLVideoElement ? input : input.video;
    const url = input instanceof HTMLVideoElement ? undefined : input.url;

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

    // 2. Whitelist Shorts video reels (do not filter out Shorts)
    const currentUrl =
      url ?? (typeof window !== 'undefined' && window.location?.href ? new URL(window.location.href) : undefined);
    const isShorts =
      (currentUrl && currentUrl.pathname.includes('/shorts')) ||
      !!video.closest('ytd-shorts, ytd-reel-video-renderer');
    if (isShorts) {
      return true;
    }

    // 3. Exclude YouTube's main watch player containers
    const isMainWatchPlayer = !!video.closest(
      'ytd-watch-flexy, ytd-watch-grid, #player-theater-container, #full-bleed-container, #primary #player, #primary #ytd-player'
    );
    if (isMainWatchPlayer) {
      return false;
    }

    // 4. Exclude oversized videos (main player exceeds 550x420 when not in a preview container)
    const rect = video.getBoundingClientRect();
    if (rect.width > 550 || rect.height > 420) {
      return false;
    }

    return true;
  }

  override scoreVideo(
    input: VideoScoreContext | HTMLVideoElement,
    legacyCandidate?: VideoCandidateContext
  ): number | null {
    const candidate = input instanceof HTMLVideoElement ? legacyCandidate : input.candidate;
    if (candidate?.isPlaying) {
      return 300;
    }
    return 100;
  }

  override onVideoDetected(input: VideoContext | HTMLVideoElement): void {
    const video = input instanceof HTMLVideoElement ? input : input.video;
    this.interceptVideoAudio(video);
    const preview = video.closest('ytd-video-preview') || document.querySelector('ytd-video-preview');
    if (preview) {
      this.bindPreviewElement(preview);
    }
  }

  override onVideoActivated(ctx: VideoAdapterContext): void {
    const { video, url, settings, updateSettings } = ctx;
    this.interceptVideoAudio(video);
    const preview = video.closest('ytd-video-preview') || document.querySelector('ytd-video-preview');
    if (preview) {
      this.bindPreviewElement(preview);
    }

    // On Shorts page, if controller is active/enabled, override layout to minimal pill mode
    const isShorts =
      (url && url.pathname.includes('/shorts')) ||
      !!video.closest('ytd-shorts, ytd-reel-video-renderer');
    if (isShorts && settings.enabled !== false) {
      updateSettings({ controlsLayout: 'minimal' });
    }
  }
}
