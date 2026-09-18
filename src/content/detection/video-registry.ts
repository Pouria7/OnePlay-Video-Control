/**
 * Video Registry and Lifecycle Engine
 *
 * Maintains the internal registry of tracked HTML5 video elements,
 * attaches and cleans up all listeners and observers, and guarantees zero memory leaks.
 */

import { VideoLifecycleState } from '../../types';
import { TrackedVideo, VideoDetectionConfig } from './types';
import { intersectionTracker } from './intersection-tracker';
import { isCandidateVideo } from './candidate-filter';
import { calculateVideoScore } from './video-scorer';

export type VideoUpdateCallback = (tracked: TrackedVideo) => void;
export type VideoRemovedCallback = (videoId: string, video: HTMLVideoElement) => void;

interface InternalTrackedRecord extends TrackedVideo {
  cleanupFns: Array<() => void>;
  resizeObserver?: ResizeObserver;
}

export class VideoRegistry {
  private records = new Map<HTMLVideoElement, InternalTrackedRecord>();
  private idCounter = 0;
  private onUpdateCallback: VideoUpdateCallback | null = null;
  private onRemoveCallback: VideoRemovedCallback | null = null;

  constructor(
    onUpdate?: VideoUpdateCallback,
    onRemove?: VideoRemovedCallback
  ) {
    if (onUpdate) this.onUpdateCallback = onUpdate;
    if (onRemove) this.onRemoveCallback = onRemove;
  }

  setCallbacks(onUpdate: VideoUpdateCallback, onRemove: VideoRemovedCallback): void {
    this.onUpdateCallback = onUpdate;
    this.onRemoveCallback = onRemove;
  }

  /**
   * Registers a newly discovered HTMLVideoElement
   */
  register(video: HTMLVideoElement, config: VideoDetectionConfig): TrackedVideo {
    const existing = this.records.get(video);
    if (existing) {
      this.updateVideoState(video, config);
      return existing;
    }

    const videoId = `ufvc-video-${++this.idCounter}`;
    const cleanupFns: Array<() => void> = [];

    const rect = video.getBoundingClientRect();

    const record: InternalTrackedRecord = {
      id: videoId,
      element: video,
      state: VideoLifecycleState.DISCOVERED,
      intersectionRatio: 0,
      boundingRect: rect,
      dimensions: { width: rect.width, height: rect.height },
      isPlaying: !video.paused && !video.ended && video.readyState > 2,
      isMuted: video.muted || video.volume === 0,
      volume: video.volume,
      currentTime: video.currentTime || 0,
      duration: isFinite(video.duration) ? video.duration : 0,
      playbackRate: video.playbackRate || 1,
      score: 0,
      lastUpdated: Date.now(),
      cleanupFns
    };

    this.records.set(video, record);
    record.state = VideoLifecycleState.TRACKED;

    // Attach media event listeners
    const handleMediaEvent = () => {
      this.updateVideoState(video, config);
    };

    const events = [
      'play',
      'playing',
      'pause',
      'ended',
      'volumechange',
      'loadedmetadata',
      'loadeddata',
      'loadstart',
      'canplay',
      'durationchange',
      'emptied',
      'ratechange'
    ];

    events.forEach((evt) => {
      video.addEventListener(evt, handleMediaEvent, { passive: true });
      cleanupFns.push(() => video.removeEventListener(evt, handleMediaEvent));
    });

    // Throttled timeupdate listener
    let lastTimeUpdate = 0;
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdate > 250) {
        lastTimeUpdate = now;
        record.currentTime = video.currentTime;
        record.duration = isFinite(video.duration) ? video.duration : 0;
        if (this.onUpdateCallback) {
          this.onUpdateCallback(record);
        }
      }
    };
    video.addEventListener('timeupdate', handleTimeUpdate, { passive: true });
    cleanupFns.push(() => video.removeEventListener('timeupdate', handleTimeUpdate));

    // Intersection observer
    intersectionTracker.observe(video, (ratio) => {
      record.intersectionRatio = ratio;
      this.updateVideoState(video, config);
    });
    cleanupFns.push(() => intersectionTracker.unobserve(video));

    // ResizeObserver for dimension changes
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        const newRect = video.getBoundingClientRect();
        record.boundingRect = newRect;
        record.dimensions = { width: newRect.width, height: newRect.height };
        this.updateVideoState(video, config);
      });
      ro.observe(video);
      record.resizeObserver = ro;
      cleanupFns.push(() => ro.disconnect());
    }

    // Initial evaluation
    this.updateVideoState(video, config);

    return record;
  }

  /**
   * Updates state, recalculates bounding rect, candidate eligibility, and score
   */
  updateVideoState(video: HTMLVideoElement, config: VideoDetectionConfig): void {
    const record = this.records.get(video);
    if (!record) return;

    if (!video.isConnected) {
      this.unregister(video);
      return;
    }

    const rect = video.getBoundingClientRect();
    record.boundingRect = rect;
    record.dimensions = { width: rect.width, height: rect.height };
    record.isPlaying = !video.paused && !video.ended;
    record.isMuted = video.muted || video.volume === 0;
    record.volume = video.volume;
    record.currentTime = video.currentTime;
    record.duration = isFinite(video.duration) ? video.duration : 0;
    record.playbackRate = video.playbackRate;
    record.lastUpdated = Date.now();

    const isCandidate = isCandidateVideo(video, config);

    if (isCandidate) {
      if (record.state !== VideoLifecycleState.ACTIVE) {
        record.state = VideoLifecycleState.CANDIDATE;
      }
      const breakdown = calculateVideoScore(
        video,
        {
          intersectionRatio: record.intersectionRatio,
          boundingRect: record.boundingRect,
          isPlaying: record.isPlaying,
          isMuted: record.isMuted,
          volume: record.volume
        },
        config.visibilityThreshold
      );
      record.score = breakdown.total;
      record.scoreBreakdown = breakdown;
    } else {
      record.state = VideoLifecycleState.INACTIVE;
      record.score = 0;
    }

    if (this.onUpdateCallback) {
      this.onUpdateCallback(record);
    }
  }

  /**
   * Unregisters a video, cleans up all listeners and observers
   */
  unregister(video: HTMLVideoElement): void {
    const record = this.records.get(video);
    if (!record) return;

    record.state = VideoLifecycleState.REMOVED;

    if (this.onRemoveCallback) {
      this.onRemoveCallback(record.id, video);
    }

    // Run all cleanup handlers
    record.cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('[UFVC Registry] Cleanup error:', err);
      }
    });
    record.cleanupFns = [];

    record.state = VideoLifecycleState.CLEANED;
    this.records.delete(video);
  }

  /**
   * Returns all currently candidate-eligible tracked videos
   */
  getCandidates(): TrackedVideo[] {
    const list: TrackedVideo[] = [];
    for (const record of this.records.values()) {
      if (
        record.state === VideoLifecycleState.CANDIDATE ||
        record.state === VideoLifecycleState.ACTIVE
      ) {
        list.push(record);
      }
    }
    return list;
  }

  /**
   * Returns a record by element
   */
  get(video: HTMLVideoElement): TrackedVideo | undefined {
    return this.records.get(video);
  }

  /**
   * Returns total number of tracked videos
   */
  size(): number {
    return this.records.size;
  }

  /**
   * Complete teardown of all tracked videos
   */
  destroy(): void {
    for (const video of Array.from(this.records.keys())) {
      this.unregister(video);
    }
    this.records.clear();
  }
}
