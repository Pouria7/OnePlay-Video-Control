/**
 * Helpers for detecting the best downloadable video source URL
 * and deriving a sensible filename.
 */

export function getBestVideoSource(video: HTMLVideoElement): string {
  // 1. currentSrc (if not blob)
  if (video.currentSrc && !video.currentSrc.startsWith('blob:')) {
    return video.currentSrc;
  }
  // 2. src (if not blob)
  if (video.src && !video.src.startsWith('blob:')) {
    return video.src;
  }
  // 3. <source> children
  const sources = video.querySelectorAll('source');
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i].getAttribute('src') || sources[i].src;
    if (s && !s.startsWith('blob:')) return s;
  }
  // 4. data-* attributes
  const dataSrc =
    video.getAttribute('data-src') ||
    video.getAttribute('data-orig-src') ||
    video.getAttribute('data-video-src');
  if (dataSrc && !dataSrc.startsWith('blob:')) return dataSrc;

  // 5. OpenGraph / Twitter meta
  const ogVideo =
    document.querySelector('meta[property="og:video:secure_url"]')?.getAttribute('content') ||
    document.querySelector('meta[property="og:video"]')?.getAttribute('content') ||
    document.querySelector('meta[name="twitter:player:stream"]')?.getAttribute('content');
  if (ogVideo && !ogVideo.startsWith('blob:')) return ogVideo;

  // Fallback: whatever we have (even blob)
  return video.currentSrc || video.src || (sources[0] ? (sources[0].getAttribute('src') || sources[0].src) : '');
}

export function deriveFilename(src: string): string {
  try {
    const urlObj = new URL(src, window.location.href);
    const baseName = urlObj.pathname.substring(urlObj.pathname.lastIndexOf('/') + 1);
    if (
      baseName &&
      /\.(mp4|webm|mkv|mov)$/i.test(baseName)
    ) {
      return baseName.split('?')[0];
    }
    const pageTitle = document.title.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'video';
    return `${pageTitle.slice(0, 50)}.mp4`;
  } catch {
    return `video_${Date.now()}.mp4`;
  }
}