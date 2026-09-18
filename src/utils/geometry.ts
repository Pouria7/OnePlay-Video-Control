import { ControllerPosition } from '../storage/types';

export interface PositionCoordinates {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Calculates the exact fixed-position coordinates for the floating controller bar
 * based on the target video's bounding rect, position mode, and viewport dimensions.
 */
export function calculateControllerPosition(
  videoRect: DOMRect,
  controllerWidth = 380,
  controllerHeight = 44,
  margin = 10,
  positionMode: ControllerPosition = 'bottom-inside'
): PositionCoordinates {
  // If the video has zero area or is entirely outside the viewport, hide the controller
  if (videoRect.width <= 0 || videoRect.height <= 0) {
    return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
  }

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  // Check if video is within viewport
  const isOutOfBounds =
    videoRect.bottom < 0 ||
    videoRect.top > viewportHeight ||
    videoRect.right < 0 ||
    videoRect.left > viewportWidth;

  if (isOutOfBounds) {
    return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
  }

  // Desired width: either default controller width or constrained by video width
  const actualWidth = Math.min(controllerWidth, Math.max(200, videoRect.width - margin * 2));

  // Center horizontally over the video
  let left = videoRect.left + (videoRect.width - actualWidth) / 2;

  // Clamp horizontally so it stays within viewport
  left = Math.max(margin, Math.min(left, viewportWidth - actualWidth - margin));

  // Calculate vertical coordinate based on docking mode
  let top: number;
  switch (positionMode) {
    case 'top-outside':
      top = videoRect.top - controllerHeight - margin;
      if (top < margin) {
        top = Math.max(margin, videoRect.top + margin);
      }
      break;

    case 'top-inside':
      top = videoRect.top + margin;
      if (top + controllerHeight > videoRect.bottom - margin) {
        top = Math.max(margin, videoRect.bottom - controllerHeight - margin);
      }
      break;

    case 'bottom-outside':
      top = videoRect.bottom + margin;
      const maxOutsideTop = viewportHeight - controllerHeight - margin;
      if (top > maxOutsideTop) {
        top = Math.min(maxOutsideTop, videoRect.bottom - controllerHeight - margin);
      }
      break;

    case 'bottom-inside':
    default:
      top = videoRect.bottom - controllerHeight - margin;
      const maxInsideTop = viewportHeight - controllerHeight - margin;
      if (top > maxInsideTop && videoRect.top < maxInsideTop) {
        top = maxInsideTop;
      }
      const minInsideTop = Math.max(margin, videoRect.top + margin);
      top = Math.max(minInsideTop, Math.min(top, maxInsideTop));
      break;
  }

  // Clamp within viewport
  top = Math.max(margin, Math.min(top, viewportHeight - controllerHeight - margin));

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(actualWidth),
    height: Math.round(controllerHeight),
    visible: true
  };
}

/**
 * Calculates geometric intersection ratio between an element rect and viewport
 */
export function calculateViewportIntersectionRatio(rect: DOMRect): number {
  if (rect.width <= 0 || rect.height <= 0) return 0;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  const visibleLeft = Math.max(0, rect.left);
  const visibleTop = Math.max(0, rect.top);
  const visibleRight = Math.min(viewportWidth, rect.right);
  const visibleBottom = Math.min(viewportHeight, rect.bottom);

  const visibleWidth = Math.max(0, visibleRight - visibleLeft);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);

  const visibleArea = visibleWidth * visibleHeight;
  const totalArea = rect.width * rect.height;

  if (totalArea <= 0) return 0;
  return Math.min(1.0, Math.max(0.0, visibleArea / totalArea));
}
