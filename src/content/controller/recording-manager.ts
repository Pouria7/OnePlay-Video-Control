/**
 * RecordingManager
 *
 * Owns the fallback download pipeline:
 *  - Direct URL download (via chrome.downloads or <a download>)
 *  - Blob fetch attempt for in-memory blobs
 *  - MediaRecorder-based capture for MSE streams (WebM only)
 *
 * NOTE: Recording is a *fallback*. Direct URL download is always preferred.
 * WebM is the only supported capture format for now; will move to settings later.
 */

import { getBestVideoSource, deriveFilename } from './video-source';
import fixWebmDuration from 'webm-duration-fix';

export interface RecordingManagerCallbacks {
  onRecordingStart: () => void;
  onRecordingTick: (seconds: number) => void;
  onRecordingEnd: () => void;
  onFeedback: (message: string) => void;
}

export class RecordingManager {
  private video: HTMLVideoElement;
  private callbacks: RecordingManagerCallbacks;

  private mediaRecorder: MediaRecorder | null = null;
  private isRecordingStream = false;
  private recordedChunks: BlobPart[] = [];
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  private recordingSeconds = 0;
  private endedHandler: (() => void) | null = null;

  constructor(video: HTMLVideoElement, callbacks: RecordingManagerCallbacks) {
    this.video = video;
    this.callbacks = callbacks;
  }

  get isRecording(): boolean {
    return this.isRecordingStream;
  }

  get seconds(): number {
    return this.recordingSeconds;
  }

  /**
   * Entry point.
   *  - If currently recording → acts as "Stop & Save"
   *  - Else → tries direct download; only records as last resort
   */
  async download(): Promise<void> {
    if (this.isRecordingStream) {
      this.stop(true);
      return;
    }

    const src = getBestVideoSource(this.video);
    if (!src) {
      console.warn('[UFVC] No video source found to download.');
      this.callbacks.onFeedback('⚠️ Video source not found');
      return;
    }

    const filename = deriveFilename(src);

    // ── Path 1: blob: URL ──────────────────────────────────────────────
    if (src.startsWith('blob:')) {
      // 1a: Try fetching it directly — works for real in-memory blobs
      try {
        const res = await fetch(src);
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 0) {
            const url = URL.createObjectURL(blob);
            this.triggerDirectDownload(url, filename);
            setTimeout(() => URL.revokeObjectURL(url), 15000);
            return;
          }
        }
      } catch {
        // fetch failed → MSE stream. Fall through to recording.
      }

      // 1b: MSE stream — last resort, record it
      this.startStreamRecording(filename);
      return;
    }

    // ── Path 2: Direct HTTP/HTTPS URL ──────────────────────────────────
    this.downloadViaChrome(src, filename);
  }

  stop(shouldSave = true): void {
    if (!this.isRecordingStream || !this.mediaRecorder) return;
    this.isRecordingStream = false;

    if (!shouldSave) {
      this.recordedChunks = [];
    }

    try {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch (err) {
      console.error('[UFVC] Error stopping recorder:', err);
    }

    if (!shouldSave) this.cleanup();
  }

  destroy(): void {
    if (this.isRecordingStream) this.stop(false);
    else this.cleanup();
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private startStreamRecording(defaultFilename: string): void {
    const stream =
      (this.video as any).captureStream?.() ??
      (this.video as any).mozCaptureStream?.();

    if (!stream || typeof MediaRecorder === 'undefined') {
      console.warn('[UFVC] Media captureStream is not supported.');
      this.callbacks.onFeedback('⚠️ Direct stream unavailable');
      return;
    }

    // WebM only for now. Format preference will move to settings later.
    const mimeType = this.pickWebmMimeType();

    try {
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      console.warn('[UFVC] Failed to init MediaRecorder:', err);
      this.callbacks.onFeedback('⚠️ Stream protected (CORS)');
      return;
    }

    this.isRecordingStream = true;
    this.recordingSeconds = 0;

    this.callbacks.onRecordingStart();

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      void this.finalizeRecording(mimeType, defaultFilename);
    };

    this.endedHandler = () => {
      if (this.isRecordingStream) this.stop(true);
    };
    this.video.addEventListener('ended', this.endedHandler, { once: true });

    if (this.video.paused) {
      try {
        const p = this.video.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {}
    }

    this.mediaRecorder.start(250);

    this.recordingTimer = setInterval(() => {
      this.recordingSeconds++;
      this.callbacks.onRecordingTick(this.recordingSeconds);
    }, 1000);
  }

  private async finalizeRecording(mimeType: string, defaultFilename: string): Promise<void> {
    if (this.recordedChunks.length === 0) {
      this.cleanup();
      return;
    }

    // WebM only for now
    const recFilename = `${defaultFilename.replace(/\.[^/.]+$/, '')}.webm`;

    let blob = new Blob(this.recordedChunks, { type: mimeType });

    try {
      // ✅ No duration arg — webm-duration-fix reads EBML internally
      //    and patches Duration + Cues + SeekHead.
      blob = await fixWebmDuration(blob);
    } catch (err) {
      console.warn('[UFVC] WebM duration patch failed:', err);
    }

    const url = URL.createObjectURL(blob);
    this.triggerDirectDownload(url, recFilename);
    setTimeout(() => URL.revokeObjectURL(url), 20000);
    this.callbacks.onFeedback('✅ Video Saved!');

    this.cleanup();
  }

  /**
   * WebM-only MIME selection.
   * Prefers VP9 for smaller files; falls back to VP8 then generic WebM.
   *
   * TODO(settings): expose format preference in extension settings and
   * allow falling back to MP4 + remux when the user enables it.
   */
  private pickWebmMimeType(): string {
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      return 'video/webm;codecs=vp9,opus';
    }
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      return 'video/webm;codecs=vp8,opus';
    }
    return 'video/webm';
  }

  private cleanup(): void {
    this.isRecordingStream = false;

    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    if (this.endedHandler) {
      this.video.removeEventListener('ended', this.endedHandler);
      this.endedHandler = null;
    }

    this.mediaRecorder = null;
    this.callbacks.onRecordingEnd();
  }

  private downloadViaChrome(url: string, filename: string): void {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(
          { type: 'DOWNLOAD_VIDEO', url, filename },
          (response) => {
            if (chrome.runtime.lastError || !response?.success) {
              this.triggerDirectDownload(url, filename);
            }
          }
        );
      } else {
        this.triggerDirectDownload(url, filename);
      }
    } catch {
      this.triggerDirectDownload(url, filename);
    }
  }

  private triggerDirectDownload(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 100);
  }
}