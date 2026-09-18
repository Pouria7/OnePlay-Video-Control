/**
 * Shadow DOM UI Generator and Styling
 *
 * Renders the floating video controller UI completely isolated from host-site styles
 * using an open Shadow Root and high z-index (2147483647).
 */

export interface ShadowUIElements {
  host: HTMLElement;
  shadowRoot: ShadowRoot;
  container: HTMLElement;
  playPauseBtn: HTMLButtonElement;
  playIcon: SVGElement;
  pauseIcon: SVGElement;
  timeDisplay: HTMLElement;
  currentTimeSpan: HTMLElement;
  durationSpan: HTMLElement;
  progressContainer: HTMLElement;
  progressBar: HTMLElement;
  bufferBar: HTMLElement;
  scrubThumb: HTMLElement;
  timeTooltip: HTMLElement;
  volumeBtn: HTMLButtonElement;
  volumeHighIcon: SVGElement;
  volumeLowIcon: SVGElement;
  volumeMuteIcon: SVGElement;
  volumeSliderContainer: HTMLElement;
  volumeSlider: HTMLInputElement;
  speedBtn: HTMLButtonElement;
  speedMenu: HTMLElement;
  fullscreenBtn: HTMLButtonElement;
  seekBackBtn: HTMLButtonElement;
  seekForwardBtn: HTMLButtonElement;
}

export const ICONS = {
  play: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  seekBack: `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="12" y="15.5" font-size="7.5" font-weight="700" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" fill="currentColor">5</text></svg>`,
  seekForward: `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="12" y="15.5" font-size="7.5" font-weight="700" font-family="system-ui, -apple-system, sans-serif" text-anchor="middle" fill="currentColor">5</text></svg>`,
  volumeHigh: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
  volumeLow: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>`,
  volumeMute: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
  fullscreen: `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`
};

export function createShadowUI(): ShadowUIElements {
  const host = document.createElement('div');
  host.className = 'ufvc-controller-root';
  host.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    pointer-events: auto;
    transition: opacity 0.25s ease, transform 0.25s ease;
    user-select: none;
    -webkit-user-select: none;
  `;

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      direction: ltr !important;
      unicode-bidi: isolate !important;
      box-sizing: border-box !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      font-size: 13px !important;
      line-height: 1 !important;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .ufvc-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      height: 100%;
      padding: 0 10px;
      background: var(--ufvc-bg, rgba(18, 20, 24, 0.76));
      color: var(--ufvc-text, #f3f4f6);
      border: var(--ufvc-border, 1px solid rgba(255, 255, 255, 0.12));
      border-radius: var(--ufvc-radius, 10px);
      backdrop-filter: var(--ufvc-blur, blur(8px));
      -webkit-backdrop-filter: var(--ufvc-blur, blur(8px));
      box-shadow: var(--ufvc-shadow, 0 8px 24px -4px rgba(0, 0, 0, 0.35));
      opacity: var(--ufvc-opacity, 0.95);
      transform: scale(var(--ufvc-scale, 1.0));
      transform-origin: bottom center;
      transition: opacity 0.25s ease, transform 0.2s ease, background 0.2s ease;
    }

    /* Single-row layout (default) */
    .ufvc-row-top,
    .ufvc-row-bottom {
      display: contents;
    }

    .ufvc-play-btn { order: 1; }
    .ufvc-seek-back-btn { order: 2; }
    .ufvc-seek-forward-btn { order: 3; }
    .ufvc-time { order: 4; }
    .ufvc-progress-container { order: 5; flex: 1; }
    .ufvc-volume-wrapper { order: 6; }
    .ufvc-speed-wrapper { order: 7; }
    .ufvc-fullscreen-btn { order: 8; }

    /* Responsive Two-row layout for small / compact videos */
    .ufvc-bar.two-row {
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      padding: 6px 10px;
    }

    .ufvc-bar.two-row .ufvc-row-top {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      height: 22px;
    }

    .ufvc-bar.two-row .ufvc-row-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: 28px;
    }

    .ufvc-bar.two-row .ufvc-progress-container {
      order: 1;
      flex: 1;
    }

    .ufvc-bar.two-row .ufvc-time {
      order: 2;
    }

    /* Minimal controls mode */
    .ufvc-bar.minimal-mode .ufvc-volume-wrapper,
    .ufvc-bar.minimal-mode .ufvc-speed-wrapper,
    .ufvc-bar.minimal-mode .ufvc-fullscreen-btn {
      display: none !important;
    }

    .ufvc-bar.two-row.minimal-mode .ufvc-row-bottom {
      justify-content: center;
      gap: 16px;
    }

    .ufvc-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 5px;
      border-radius: 6px;
      transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
      flex-shrink: 0;
    }

    .ufvc-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: var(--ufvc-accent-hover, #ffffff);
    }

    .ufvc-btn:active {
      transform: scale(0.92);
    }

    .ufvc-time {
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.85);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* Progress bar */
    .ufvc-progress-container {
      position: relative;
      flex: 1;
      height: 16px;
      display: flex;
      align-items: center;
      cursor: pointer;
      touch-action: none;
      min-width: 60px;
    }

    .ufvc-progress-track {
      position: relative;
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
      transition: height 0.15s ease;
    }

    .ufvc-progress-container:hover .ufvc-progress-track {
      height: 6px;
    }

    .ufvc-buffer-bar {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 0%;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
    }

    .ufvc-progress-bar {
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 0%;
      background: var(--ufvc-accent, #38bdf8);
      border-radius: 2px;
    }

    .ufvc-scrub-thumb {
      position: absolute;
      left: 0%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0);
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.5);
      transition: transform 0.15s ease;
      pointer-events: none;
    }

    .ufvc-progress-container:hover .ufvc-scrub-thumb,
    .ufvc-progress-container.dragging .ufvc-scrub-thumb {
      transform: translate(-50%, -50%) scale(1);
    }

    /* Tooltip */
    .ufvc-time-tooltip {
      position: absolute;
      bottom: 22px;
      left: 0;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      color: #ffffff;
      padding: 3px 6px;
      font-size: 10px;
      font-weight: 500;
      border-radius: 4px;
      pointer-events: none;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.12s ease;
    }

    .ufvc-progress-container:hover .ufvc-time-tooltip {
      opacity: 1;
    }

    /* Volume wrapper */
    .ufvc-volume-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .ufvc-volume-slider-box {
      display: none;
      position: absolute;
      bottom: 34px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ufvc-bg, rgba(18, 20, 24, 0.9));
      padding: 8px 6px;
      border-radius: 8px;
      border: var(--ufvc-border, 1px solid rgba(255, 255, 255, 0.12));
      box-shadow: var(--ufvc-shadow, 0 4px 16px rgba(0,0,0,0.4));
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      height: 90px;
      align-items: center;
      justify-content: center;
    }

    .ufvc-volume-wrapper:hover .ufvc-volume-slider-box,
    .ufvc-volume-slider-box.active {
      display: flex;
    }

    .ufvc-volume-slider {
      writing-mode: bt-lr; /* IE/Edge */
      -webkit-appearance: slider-vertical;
      width: 6px;
      height: 74px;
      accent-color: var(--ufvc-accent, #38bdf8);
      cursor: pointer;
    }

    /* Speed Menu */
    .ufvc-speed-wrapper {
      position: relative;
    }

    .ufvc-speed-btn {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 6px;
      min-width: 34px;
    }

    .ufvc-speed-menu {
      display: none;
      position: absolute;
      bottom: 34px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ufvc-bg, rgba(18, 20, 24, 0.95));
      border: var(--ufvc-border, 1px solid rgba(255, 255, 255, 0.12));
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      padding: 4px;
      flex-direction: column;
      gap: 2px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 10;
    }

    .ufvc-speed-menu.open {
      display: flex;
    }

    .ufvc-speed-item {
      background: transparent;
      border: none;
      color: #e5e7eb;
      font-size: 11px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      text-align: center;
      transition: background 0.1s ease;
    }

    .ufvc-speed-item:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    .ufvc-speed-item.active {
      background: var(--ufvc-accent, #38bdf8);
      color: #000000;
      font-weight: 700;
    }

    /* Auto-hide fade */
    .ufvc-bar.idle {
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;

  shadowRoot.appendChild(style);

  const container = document.createElement('div');
  container.className = 'ufvc-bar';

  container.innerHTML = `
    <div class="ufvc-row-top">
      <div class="ufvc-progress-container" title="Seek (Left/Right Arrow)">
        <div class="ufvc-progress-track">
          <div class="ufvc-buffer-bar"></div>
          <div class="ufvc-progress-bar"></div>
        </div>
        <div class="ufvc-scrub-thumb"></div>
        <div class="ufvc-time-tooltip">0:00</div>
      </div>

      <div class="ufvc-time">
        <span class="ufvc-current-time">0:00</span> / <span class="ufvc-duration">0:00</span>
      </div>
    </div>

    <div class="ufvc-row-bottom">
      <button class="ufvc-btn ufvc-play-btn" title="Play/Pause (Space)" aria-label="Play or Pause">
        <span class="ufvc-icon-play">${ICONS.play}</span>
        <span class="ufvc-icon-pause" style="display:none;">${ICONS.pause}</span>
      </button>

      <button class="ufvc-btn ufvc-seek-back-btn" title="Seek -5s (← or J)" aria-label="Seek Backward 5 Seconds">
        ${ICONS.seekBack}
      </button>

      <button class="ufvc-btn ufvc-seek-forward-btn" title="Seek +5s (→ or L)" aria-label="Seek Forward 5 Seconds">
        ${ICONS.seekForward}
      </button>

      <div class="ufvc-volume-wrapper">
        <button class="ufvc-btn ufvc-volume-btn" title="Mute/Unmute" aria-label="Mute or Unmute">
          <span class="ufvc-icon-vol-high">${ICONS.volumeHigh}</span>
          <span class="ufvc-icon-vol-low" style="display:none;">${ICONS.volumeLow}</span>
          <span class="ufvc-icon-vol-mute" style="display:none;">${ICONS.volumeMute}</span>
        </button>
        <div class="ufvc-volume-slider-box">
          <input type="range" class="ufvc-volume-slider" min="0" max="1" step="0.05" value="1" orient="vertical" title="Volume (Up/Down Arrow)">
        </div>
      </div>

      <div class="ufvc-speed-wrapper">
        <button class="ufvc-btn ufvc-speed-btn" title="Playback Speed">1x</button>
        <div class="ufvc-speed-menu">
          <button class="ufvc-speed-item" data-speed="0.5">0.5x</button>
          <button class="ufvc-speed-item active" data-speed="1">1x</button>
          <button class="ufvc-speed-item" data-speed="1.25">1.25x</button>
          <button class="ufvc-speed-item" data-speed="1.5">1.5x</button>
          <button class="ufvc-speed-item" data-speed="2">2x</button>
        </div>
      </div>

      <button class="ufvc-btn ufvc-fullscreen-btn" title="Toggle Fullscreen" aria-label="Toggle Fullscreen">
        ${ICONS.fullscreen}
      </button>
    </div>
  `;

  shadowRoot.appendChild(container);

  return {
    host,
    shadowRoot,
    container,
    playPauseBtn: container.querySelector('.ufvc-play-btn') as HTMLButtonElement,
    playIcon: container.querySelector('.ufvc-icon-play') as SVGElement,
    pauseIcon: container.querySelector('.ufvc-icon-pause') as SVGElement,
    timeDisplay: container.querySelector('.ufvc-time') as HTMLElement,
    currentTimeSpan: container.querySelector('.ufvc-current-time') as HTMLElement,
    durationSpan: container.querySelector('.ufvc-duration') as HTMLElement,
    progressContainer: container.querySelector('.ufvc-progress-container') as HTMLElement,
    progressBar: container.querySelector('.ufvc-progress-bar') as HTMLElement,
    bufferBar: container.querySelector('.ufvc-buffer-bar') as HTMLElement,
    scrubThumb: container.querySelector('.ufvc-scrub-thumb') as HTMLElement,
    timeTooltip: container.querySelector('.ufvc-time-tooltip') as HTMLElement,
    volumeBtn: container.querySelector('.ufvc-volume-btn') as HTMLButtonElement,
    volumeHighIcon: container.querySelector('.ufvc-icon-vol-high') as SVGElement,
    volumeLowIcon: container.querySelector('.ufvc-icon-vol-low') as SVGElement,
    volumeMuteIcon: container.querySelector('.ufvc-icon-vol-mute') as SVGElement,
    volumeSliderContainer: container.querySelector('.ufvc-volume-slider-box') as HTMLElement,
    volumeSlider: container.querySelector('.ufvc-volume-slider') as HTMLInputElement,
    speedBtn: container.querySelector('.ufvc-speed-btn') as HTMLButtonElement,
    speedMenu: container.querySelector('.ufvc-speed-menu') as HTMLElement,
    fullscreenBtn: container.querySelector('.ufvc-fullscreen-btn') as HTMLButtonElement,
    seekBackBtn: container.querySelector('.ufvc-seek-back-btn') as HTMLButtonElement,
    seekForwardBtn: container.querySelector('.ufvc-seek-forward-btn') as HTMLButtonElement
  };
}
