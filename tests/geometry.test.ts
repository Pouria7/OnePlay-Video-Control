import { describe, it, expect } from 'vitest';
import { calculateControllerPosition } from '../src/utils/geometry';

describe('calculateControllerPosition', () => {
  const videoRect = {
    top: 100,
    bottom: 400,
    left: 200,
    right: 600,
    width: 400,
    height: 300
  } as DOMRect;

  it('calculates bottom-inside position correctly', () => {
    const pos = calculateControllerPosition(videoRect, 380, 44, 10, 'bottom-inside');
    expect(pos.visible).toBe(true);
    // top should be videoRect.bottom - controllerHeight - margin = 400 - 44 - 10 = 346
    expect(pos.top).toBe(346);
    expect(pos.height).toBe(44);
  });

  it('calculates bottom-outside position correctly', () => {
    const pos = calculateControllerPosition(videoRect, 380, 44, 10, 'bottom-outside');
    expect(pos.visible).toBe(true);
    // top should be videoRect.bottom + margin = 400 + 10 = 410
    expect(pos.top).toBe(410);
    expect(pos.height).toBe(44);
  });

  it('calculates top-inside position correctly', () => {
    const pos = calculateControllerPosition(videoRect, 380, 44, 10, 'top-inside');
    expect(pos.visible).toBe(true);
    // top should be videoRect.top + margin = 100 + 10 = 110
    expect(pos.top).toBe(110);
    expect(pos.height).toBe(44);
  });

  it('calculates top-outside position correctly', () => {
    const pos = calculateControllerPosition(videoRect, 380, 44, 10, 'top-outside');
    expect(pos.visible).toBe(true);
    // top should be videoRect.top - controllerHeight - margin = 100 - 44 - 10 = 46
    expect(pos.top).toBe(46);
    expect(pos.height).toBe(44);
  });

  it('adapts to 2-row height (62px)', () => {
    const pos = calculateControllerPosition(videoRect, 380, 62, 10, 'bottom-inside');
    expect(pos.visible).toBe(true);
    // 400 - 62 - 10 = 328
    expect(pos.top).toBe(328);
    expect(pos.height).toBe(62);
  });
});
