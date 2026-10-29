/**
 * Keyboard shortcuts utility module
 *
 * Provides serialization, combination matching, and human-friendly formatting
 * for single and multi-key keyboard shortcuts (e.g. 'Space', 'Ctrl+M', 'Alt+Shift+Right').
 */

export interface ParsedShortcut {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

/**
 * Normalizes key alias to comparable standard form
 */
export function normalizeKey(key: string): string {
  if (key === ' ') return 'space';
  const k = key.trim().toLowerCase();
  if (k === 'space') return 'space';
  if (k === 'left' || k === 'arrowleft') return 'arrowleft';
  if (k === 'right' || k === 'arrowright') return 'arrowright';
  if (k === 'up' || k === 'arrowup') return 'arrowup';
  if (k === 'down' || k === 'arrowdown') return 'arrowdown';
  if (k === '[' || k === 'bracketleft') return 'bracketleft';
  if (k === ']' || k === 'bracketright') return 'bracketright';
  if (k === '<' || k === 'comma') return 'comma';
  if (k === '>' || k === 'period') return 'period';
  if (k.startsWith('key') && k.length === 4) return k;
  if (/^[a-z]$/.test(k)) return `key${k}`;
  if (/^[0-9]$/.test(k)) return `digit${k}`;
  return k;
}

/**
 * Parses a shortcut string like "Ctrl+Shift+KeyM" or "Space"
 */
export function parseShortcut(shortcutStr: string): ParsedShortcut {
  if (!shortcutStr || !shortcutStr.trim()) {
    return { ctrl: false, alt: false, shift: false, meta: false, key: '' };
  }

  const parts = shortcutStr.split('+').map((p) => p.trim());
  let ctrl = false;
  let alt = false;
  let shift = false;
  let meta = false;
  let key = '';

  for (const part of parts) {
    const p = part.toLowerCase();
    if (p === 'ctrl' || p === 'control') {
      ctrl = true;
    } else if (p === 'alt' || p === 'option') {
      alt = true;
    } else if (p === 'shift') {
      shift = true;
    } else if (p === 'meta' || p === 'cmd' || p === 'command' || p === 'win') {
      meta = true;
    } else {
      key = part;
    }
  }

  return { ctrl, alt, shift, meta, key };
}

/**
 * Checks if a KeyboardEvent matches a configured shortcut string
 */
export function matchesShortcut(e: KeyboardEvent, shortcutStr: string): boolean {
  if (!shortcutStr) return false;

  const parsed = parseShortcut(shortcutStr);
  if (!parsed.key) return false;

  // Verify modifiers match exactly
  if (e.ctrlKey !== parsed.ctrl) return false;
  if (e.altKey !== parsed.alt) return false;
  if (e.shiftKey !== parsed.shift) return false;
  if (e.metaKey !== parsed.meta) return false;

  const expectedKey = normalizeKey(parsed.key);
  const eventCode = normalizeKey(e.code);
  const eventKey = normalizeKey(e.key);

  return eventCode === expectedKey || eventKey === expectedKey;
}

/**
 * Converts a KeyboardEvent into a canonical shortcut string, e.g. "Ctrl+Shift+KeyM".
 * Returns empty string if only modifier keys were pressed.
 */
export function eventToShortcutString(e: KeyboardEvent): string {
  if (MODIFIER_KEYS.has(e.key)) {
    return '';
  }

  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  let keyPart = e.code;
  if (!keyPart) {
    keyPart = e.key.toUpperCase();
  }

  parts.push(keyPart);
  return parts.join('+');
}

/**
 * Formats a canonical shortcut string for UI presentation (e.g. "Ctrl + Shift + M")
 */
export function formatShortcutForDisplay(shortcutStr: string): string {
  if (!shortcutStr) return 'None';

  const parsed = parseShortcut(shortcutStr);
  const parts: string[] = [];

  if (parsed.ctrl) parts.push('Ctrl');
  if (parsed.alt) parts.push('Alt');
  if (parsed.shift) parts.push('Shift');
  if (parsed.meta) parts.push('Cmd');

  let displayKey = parsed.key;
  const lower = displayKey.toLowerCase();

  if (lower === 'space') {
    displayKey = 'Space';
  } else if (lower === 'arrowleft' || lower === 'left') {
    displayKey = '← Left';
  } else if (lower === 'arrowright' || lower === 'right') {
    displayKey = '→ Right';
  } else if (lower === 'arrowup' || lower === 'up') {
    displayKey = '↑ Up';
  } else if (lower === 'arrowdown' || lower === 'down') {
    displayKey = '↓ Down';
  } else if (lower === 'bracketleft' || lower === '[') {
    displayKey = '[';
  } else if (lower === 'bracketright' || lower === ']') {
    displayKey = ']';
  } else if (lower === 'comma' || lower === '<') {
    displayKey = '<';
  } else if (lower === 'period' || lower === '>') {
    displayKey = '>';
  } else if (lower.startsWith('key') && lower.length === 4) {
    displayKey = lower.substring(3).toUpperCase();
  } else if (lower.startsWith('digit') && lower.length === 6) {
    displayKey = lower.substring(5);
  }

  parts.push(displayKey);
  return parts.join(' + ');
}
