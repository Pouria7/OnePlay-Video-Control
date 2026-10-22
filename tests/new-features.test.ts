import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VolumeState } from '../src/content/controller/volume-state';
import { calculateDragBounds, applyDragOffset, PositionCoordinates } from '../src/utils/geometry';
import { ContextMenuRegistry } from '../src/content/controller/context-menu/registry';
import { stepSpeed } from '../src/content/controller/context-menu/builtin-items';

describe('VolumeState Store', () => {
  let video: HTMLVideoElement;

  beforeEach(() => {
    video = document.createElement('video');
    video.volume = 1;
    video.muted = false;
  });

  it('updates video element and notifies subscribers immediately on user volume change', () => {
    const volumeState = new VolumeState(video);
    const listener = vi.fn();
    volumeState.subscribe(listener);

    volumeState.setVolume(0.4);

    expect(video.volume).toBeCloseTo(0.4);
    expect(video.muted).toBe(false);
    expect(volumeState.volume).toBeCloseTo(0.4);
    expect(volumeState.muted).toBe(false);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ volume: 0.4, muted: false }),
      'user'
    );
  });

  it('sets muted to true when user sets volume to 0', () => {
    const volumeState = new VolumeState(video);
    volumeState.setVolume(0);

    expect(volumeState.isSilent).toBe(true);
    expect(volumeState.muted).toBe(true);
  });

  it('restores previous audible volume when toggling mute', () => {
    const volumeState = new VolumeState(video);
    volumeState.setVolume(0.8);
    expect(volumeState.volume).toBeCloseTo(0.8);

    volumeState.toggleMute();
    expect(volumeState.isSilent).toBe(true);
    expect(volumeState.muted).toBe(true);

    volumeState.toggleMute();
    expect(volumeState.isSilent).toBe(false);
    expect(volumeState.muted).toBe(false);
    expect(volumeState.volume).toBeCloseTo(0.8);
  });

  it('re-applies user volume when external script silences video inside guard window', () => {
    let now = 1000;
    const volumeState = new VolumeState(video, {
      guardWindowMs: 2000,
      maxReapplies: 3,
      now: () => now
    });

    // User explicitly sets volume to 0.7
    volumeState.setVolume(0.7);
    expect(video.volume).toBeCloseTo(0.7);

    // Page script (e.g. YouTube preview) resets volume to 0 500ms later
    now += 500;
    video.volume = 0;
    video.muted = true;
    volumeState.handleMediaVolumeChange();

    // VolumeState should fight back and restore 0.7
    expect(video.volume).toBeCloseTo(0.7);
    expect(video.muted).toBe(false);
    expect(volumeState.volume).toBeCloseTo(0.7);

    // After guard window expires, external changes are adopted
    now += 3000;
    video.volume = 0.2;
    video.muted = false;
    volumeState.handleMediaVolumeChange();
    expect(volumeState.volume).toBeCloseTo(0.2);
  });
});

describe('Manual Drag Geometry & Bounds', () => {
  const dock: PositionCoordinates = {
    left: 200,
    top: 400,
    width: 400,
    height: 44,
    visible: true
  };

  const createVideoRect = (top = 200, height = 300, left = 100, width = 600): DOMRect => ({
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => {}
  });

  it('calculates drag bounds within horizontal margin and vertical half-height for bottom-inside', () => {
    const videoRect = createVideoRect(200, 300, 100, 600); // middle is 350
    const bounds = calculateDragBounds(videoRect, dock, 'bottom-inside', {
      horizontalOverflow: 100,
      viewportMargin: 4
    });

    // Horizontal: [100 - 100, 700 + 100 - 400] = [0 clamped to margin 4, 400]
    expect(bounds.minLeft).toBe(4);
    expect(bounds.maxLeft).toBe(400);

    // Vertical bottom-inside: minTop is min(dock.top=400, middle=350) => 350, maxTop is dock.top=400
    expect(bounds.minTop).toBe(350);
    expect(bounds.maxTop).toBe(400);
  });

  it('clamps manual drag offset to calculated bounds', () => {
    const videoRect = createVideoRect(200, 300, 100, 600);

    // Try dragging 500px up (beyond middle)
    const pos = applyDragOffset(videoRect, dock, { dx: 0, dy: -500 }, 'bottom-inside');
    expect(pos.top).toBe(350); // Clamped at middle

    // Try dragging 200px down (below bottom dock)
    const posDown = applyDragOffset(videoRect, dock, { dx: 0, dy: 200 }, 'bottom-inside');
    expect(posDown.top).toBe(400); // Clamped at dock top
  });
});

describe('ContextMenu Registry & Extensibility', () => {
  it('allows registering custom items and ordering them by section and order', () => {
    const registry = new ContextMenuRegistry();
    const fakeCtx = {
      video: document.createElement('video'),
      volume: {} as any,
      recording: {} as any,
      getConfig: () => ({} as any),
      close: () => {},
      refresh: () => {}
    };

    const unreg = registry.register('my-plugin', () => ({
      id: 'my-plugin',
      section: 'plugins',
      order: 5,
      element: document.createElement('button'),
      isVisible: () => true
    }));

    const items = registry.createItems(fakeCtx);
    expect(items.length).toBe(1);
    expect(items[0].id).toBe('my-plugin');

    unreg();
    expect(registry.createItems(fakeCtx).length).toBe(0);
  });

  it('steps playback speed correctly through presets', () => {
    expect(stepSpeed(1, 1)).toBe(1.25);
    expect(stepSpeed(1, -1)).toBe(0.75);
    expect(stepSpeed(3, 1)).toBe(3);
    expect(stepSpeed(0.5, -1)).toBe(0.5);
  });
});
