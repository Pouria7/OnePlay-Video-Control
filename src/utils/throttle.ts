/**
 * Throttling and debouncing utilities
 */

/**
 * Creates a function throttled to requestAnimationFrame.
 * Guarantees that the wrapped function runs at most once per frame,
 * avoiding duplicate layout reads and reflow thrashing.
 */
export function rafThrottle<T extends (...args: any[]) => void>(fn: T): (...args: Parameters<T>) => void {
  let isTicking = false;
  let lastArgs: Parameters<T> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    lastArgs = args;
    if (!isTicking) {
      isTicking = true;
      requestAnimationFrame(() => {
        isTicking = false;
        if (lastArgs) {
          fn.apply(this, lastArgs);
          lastArgs = null;
        }
      });
    }
  };
}

/**
 * Creates a debounced function that delays execution until waitMs milliseconds
 * have elapsed since the last call.
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, waitMs);
  };
}
