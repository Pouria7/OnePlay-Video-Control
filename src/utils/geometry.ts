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
  const minAllowed = Math.min(controllerWidth, 100);
  const actualWidth = Math.min(controllerWidth, Math.max(minAllowed, videoRect.width - margin * 2));

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
 * Manual drag offset (in px) relative to the docked controller position.
 */
export interface DragOffset {
  dx: number;
  dy: number;
}

export interface DragLimitsOptions {
  /** Extra horizontal room beyond the video's left/right edges (px). */
  horizontalOverflow?: number;
  /** Vertical travel allowed away from the video for "outside" docks (px). */
  outsideTravel?: number;
  /** Minimum distance kept from viewport edges (px). */
  viewportMargin?: number;
}

export interface DragBounds {
  minLeft: number;
  maxLeft: number;
  minTop: number;
  maxTop: number;
}

/**
 * Computes the area in which a manually dragged controller may move.
 *
 * The limits are always expressed relative to the video and the docked
 * position (`dock`), never as absolute page coordinates, so they follow the
 * video while scrolling:
 *
 * - Horizontal: within the video width, plus `horizontalOverflow` on each side.
 * - bottom-inside: from the dock up to the vertical middle of the video.
 * - top-inside: from the dock down to the vertical middle of the video.
 * - bottom-outside / top-outside: from the dock, `outsideTravel` px further
 *   away from the video.
 *
 * The dock itself may be clamped to the viewport (e.g. a bottom dock when the
 * video bottom is scrolled off-screen). In that case the dock is always kept
 * reachable: e.g. for bottom-inside the upper limit is
 * `min(dock.top, videoMiddle)`, so a controller that already sits above the
 * middle is never forced to jump.
 */
export function calculateDragBounds(
  videoRect: DOMRect,
  dock: PositionCoordinates,
  positionMode: ControllerPosition = 'bottom-inside',
  options: DragLimitsOptions = {}
): DragBounds {
  const overflowX = options.horizontalOverflow ?? 100;
  const travel = options.outsideTravel ?? 200;
  const margin = options.viewportMargin ?? 4;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  const videoMiddle = videoRect.top + videoRect.height / 2;

  let minLeft = Math.min(dock.left, videoRect.left - overflowX);
  let maxLeft = Math.max(dock.left, videoRect.right + overflowX - dock.width);

  let minTop: number;
  let maxTop: number;
  switch (positionMode) {
    case 'top-inside':
      minTop = dock.top;
      maxTop = Math.max(dock.top, videoMiddle - dock.height);
      break;
    case 'top-outside':
      minTop = dock.top - travel;
      maxTop = dock.top;
      break;
    case 'bottom-outside':
      minTop = dock.top;
      maxTop = dock.top + travel;
      break;
    case 'bottom-inside':
    default:
      minTop = Math.min(dock.top, videoMiddle);
      maxTop = dock.top;
      break;
  }

  // Keep inside the viewport
  minLeft = Math.max(minLeft, margin);
  maxLeft = Math.min(maxLeft, viewportWidth - dock.width - margin);
  minTop = Math.max(minTop, margin);
  maxTop = Math.min(maxTop, viewportHeight - dock.height - margin);

  // Degenerate ranges collapse onto the dock (clamped by the viewport)
  if (maxLeft < minLeft) minLeft = maxLeft = Math.max(margin, Math.min(dock.left, viewportWidth - dock.width - margin));
  if (maxTop < minTop) minTop = maxTop = Math.max(margin, Math.min(dock.top, viewportHeight - dock.height - margin));

  return { minLeft, maxLeft, minTop, maxTop };
}

/**
 * Applies a manual drag offset to the docked position, clamped by
 * `calculateDragBounds`. Returns the final coordinates.
 */
export function applyDragOffset(
  videoRect: DOMRect,
  dock: PositionCoordinates,
  offset: DragOffset,
  positionMode: ControllerPosition = 'bottom-inside',
  options: DragLimitsOptions = {}
): PositionCoordinates {
  if (!dock.visible || (offset.dx === 0 && offset.dy === 0)) return dock;

  const b = calculateDragBounds(videoRect, dock, positionMode, options);
  const left = Math.max(b.minLeft, Math.min(dock.left + offset.dx, b.maxLeft));
  const top = Math.max(b.minTop, Math.min(dock.top + offset.dy, b.maxTop));

  return { ...dock, left: Math.round(left), top: Math.round(top) };
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
