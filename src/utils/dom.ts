/**
 * DOM utility functions
 */

/**
 * Returns the deeply active element, penetrating open shadow roots
 */
export function getDeepActiveElement(root: Document | ShadowRoot = document): Element | null {
  let active = root.activeElement;
  while (active && active.shadowRoot && active.shadowRoot.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/**
 * Checks if the user is currently focused on an editable element or typing
 */
export function isEditableElement(element: Element | null): boolean {
  if (!element) return false;

  const tagName = element.tagName.toUpperCase();
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    // If it's a range or checkbox or radio, space might still trigger it, but text inputs must be protected
    return true;
  }

  if (element.hasAttribute('contenteditable')) {
    const attr = element.getAttribute('contenteditable');
    if (attr === '' || attr === 'true' || attr === 'plaintext-only') {
      return true;
    }
  }

  // Check closest editable container
  if (element.closest('[contenteditable="true"], [contenteditable="plaintext-only"]')) {
    return true;
  }

  return false;
}

/**
 * Checks if an element is currently connected to the DOM and not styled display:none or visibility:hidden
 */
export function isElementVisibleInDOM(element: HTMLElement): boolean {
  if (!element.isConnected) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  if (parseFloat(style.opacity || '1') <= 0.01) return false;

  return true;
}

/**
 * Formats time in seconds to mm:ss or hh:mm:ss
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const rounded = Math.floor(seconds);
  const hrs = Math.floor(rounded / 3600);
  const mins = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  const paddedSecs = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    const paddedMins = mins.toString().padStart(2, '0');
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${mins}:${paddedSecs}`;
}
