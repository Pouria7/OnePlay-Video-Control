/**
 * Built-in context menu items
 *
 * - volume   (playback, compact layout only): mute toggle + slider
 * - speed    (playback, compact layout only): stepper through speed presets
 * - download (tools, hidden on download-restricted domains)
 */

import { ICONS, SPEED_PRESETS } from '../shadow-ui';
import { formatTime } from '../../../utils/dom';
import { isDownloadRestricted } from '../../../utils/download-policy';
import { contextMenuRegistry, ContextMenuRegistry } from './registry';
import type { ContextMenuContext, ContextMenuItem } from './types';

// ─── Small DOM helpers (reusable by future items) ───────────────────────

export interface MenuButtonOptions {
  className?: string;
  label: string;
  icon?: string;
  title?: string;
  onClick: (e: MouseEvent) => void;
}

/** Creates a standard full-width menu button (icon + label). */
export function createMenuButton(opts: MenuButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `ufvc-context-item${opts.className ? ` ${opts.className}` : ''}`;
  btn.setAttribute('role', 'menuitem');
  btn.title = opts.title ?? opts.label;
  setMenuButtonContent(btn, opts.label, opts.icon);
  btn.addEventListener('click', opts.onClick);
  return btn;
}

export function setMenuButtonContent(btn: HTMLElement, label: string, icon?: string): void {
  btn.innerHTML = `${icon ?? ''}<span class="ufvc-context-label"></span>`;
  (btn.querySelector('.ufvc-context-label') as HTMLElement).textContent = label;
}

const isCompactLayout = (ctx: ContextMenuContext): boolean =>
  ctx.getConfig().controlsLayout === 'minimal';

const formatRate = (rate: number): string => `${Number(rate.toFixed(2))}x`;

/** Next/previous preset relative to an arbitrary current rate. */
export function stepSpeed(current: number, direction: 1 | -1): number {
  const eps = 0.001;
  if (direction > 0) {
    return SPEED_PRESETS.find((s) => s > current + eps) ?? SPEED_PRESETS[SPEED_PRESETS.length - 1];
  }
  for (let i = SPEED_PRESETS.length - 1; i >= 0; i--) {
    if (SPEED_PRESETS[i] < current - eps) return SPEED_PRESETS[i];
  }
  return SPEED_PRESETS[0];
}

// ─── Volume ─────────────────────────────────────────────────────────────

export function createVolumeItem(ctx: ContextMenuContext): ContextMenuItem {
  const row = document.createElement('div');
  row.className = 'ufvc-context-row ufvc-context-volume';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Volume');
  row.innerHTML = `
    <button type="button" class="ufvc-context-icon-btn" aria-label="Mute or unmute"></button>
    <input type="range" class="ufvc-context-range" min="0" max="1" step="0.05" aria-label="Volume">
    <span class="ufvc-context-value"></span>
  `;

  const muteBtn = row.querySelector('button') as HTMLButtonElement;
  const slider = row.querySelector('input') as HTMLInputElement;
  const valueLabel = row.querySelector('.ufvc-context-value') as HTMLElement;

  const render = () => {
    const { volume } = ctx.volume.snapshot;
    const silent = ctx.volume.isSilent;
    const shown = silent ? 0 : volume;
    slider.value = String(shown);
    slider.style.setProperty('--ufvc-fill', `${Math.round(shown * 100)}%`);
    valueLabel.textContent = `${Math.round(shown * 100)}%`;
    muteBtn.innerHTML = silent ? ICONS.volumeMute : volume < 0.5 ? ICONS.volumeLow : ICONS.volumeHigh;
    muteBtn.title = silent ? 'Unmute' : 'Mute';
  };

  muteBtn.addEventListener('click', () => ctx.volume.toggleMute());
  slider.addEventListener('input', () => ctx.volume.setVolume(parseFloat(slider.value)));
  const unsubscribe = ctx.volume.subscribe(render);
  render();

  return {
    id: 'volume',
    section: 'playback',
    order: 10,
    element: row,
    isVisible: isCompactLayout,
    update: render,
    destroy: unsubscribe
  };
}

// ─── Speed ──────────────────────────────────────────────────────────────

export function createSpeedItem(ctx: ContextMenuContext): ContextMenuItem {
  const row = document.createElement('div');
  row.className = 'ufvc-context-row ufvc-context-speed';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Playback speed');
  row.innerHTML = `
    <span class="ufvc-context-row-label">Speed</span>
    <div class="ufvc-stepper">
      <button type="button" class="ufvc-stepper-btn" data-dir="-1" aria-label="Slower">&minus;</button>
      <button type="button" class="ufvc-stepper-value" title="Reset to 1x" aria-label="Reset speed"></button>
      <button type="button" class="ufvc-stepper-btn" data-dir="1" aria-label="Faster">+</button>
    </div>
  `;

  const [slower, value, faster] = Array.from(row.querySelectorAll('button')) as HTMLButtonElement[];
  const video = ctx.video;
  const rateStore = ctx.playbackRate;

  const getCurrentRate = (): number => (rateStore ? rateStore.rate : video.playbackRate || 1);
  const applyRate = (nextRate: number): void => {
    if (rateStore) {
      rateStore.setRate(nextRate);
    } else {
      video.playbackRate = nextRate;
    }
  };

  const render = () => {
    const rate = getCurrentRate();
    value.textContent = formatRate(rate);
    value.classList.toggle('is-default', Math.abs(rate - 1) < 0.001);
    slower.disabled = rate <= SPEED_PRESETS[0] + 0.001;
    faster.disabled = rate >= SPEED_PRESETS[SPEED_PRESETS.length - 1] - 0.001;
  };

  slower.addEventListener('click', () => applyRate(stepSpeed(getCurrentRate(), -1)));
  faster.addEventListener('click', () => applyRate(stepSpeed(getCurrentRate(), 1)));
  value.addEventListener('click', () => applyRate(1));

  const unsubscribeStore = rateStore ? rateStore.subscribe(render) : null;
  video.addEventListener('ratechange', render);
  render();

  return {
    id: 'speed',
    section: 'playback',
    order: 20,
    element: row,
    isVisible: isCompactLayout,
    update: render,
    destroy: () => {
      if (unsubscribeStore) unsubscribeStore();
      video.removeEventListener('ratechange', render);
    }
  };
}

// ─── Download ───────────────────────────────────────────────────────────

const DOWNLOAD_LABEL = 'Download Video';

export function createDownloadItem(ctx: ContextMenuContext): ContextMenuItem {
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  const renderState = () => {
    if (ctx.recording.isRecording) {
      setMenuButtonContent(btn, `Stop & Save (${formatTime(ctx.recording.seconds)})`, ICONS.stopRecord);
      btn.title = 'Stop recording and save';
    } else {
      setMenuButtonContent(btn, DOWNLOAD_LABEL, ICONS.download);
      btn.title = DOWNLOAD_LABEL;
    }
  };

  const btn = createMenuButton({
    className: 'ufvc-context-download',
    label: DOWNLOAD_LABEL,
    icon: ICONS.download,
    onClick: () => {
      ctx.close();
      void ctx.recording.download();
    }
  });

  return {
    id: 'download',
    section: 'tools',
    order: 10,
    element: btn,
    isVisible: () => !isDownloadRestricted(),
    update: () => {
      if (!feedbackTimer) renderState();
    },
    onEvent: (event) => {
      if (event.type === 'recording') {
        if (!feedbackTimer) renderState();
      } else if (event.type === 'feedback') {
        if (feedbackTimer) clearTimeout(feedbackTimer);
        setMenuButtonContent(btn, event.message);
        feedbackTimer = setTimeout(() => {
          feedbackTimer = null;
          renderState();
        }, event.durationMs ?? 2500);
      }
    },
    destroy: () => {
      if (feedbackTimer) clearTimeout(feedbackTimer);
    }
  };
}

// ─── Registration ───────────────────────────────────────────────────────

/**
 * Registers the built-in items. Safe to call multiple times.
 */
export function registerBuiltinContextMenuItems(registry: ContextMenuRegistry = contextMenuRegistry): void {
  if (!registry.has('volume')) registry.register('volume', createVolumeItem);
  if (!registry.has('speed')) registry.register('speed', createSpeedItem);
  if (!registry.has('download')) registry.register('download', createDownloadItem);
}
