import { describe, it, expect } from 'vitest';
import {
  normalizeKey,
  parseShortcut,
  matchesShortcut,
  eventToShortcutString,
  formatShortcutForDisplay
} from '../src/utils/shortcuts';

describe('Shortcuts Utility', () => {
  describe('normalizeKey', () => {
    it('normalizes space aliases', () => {
      expect(normalizeKey(' ')).toBe('space');
      expect(normalizeKey('Space')).toBe('space');
    });

    it('normalizes arrow key aliases', () => {
      expect(normalizeKey('Left')).toBe('arrowleft');
      expect(normalizeKey('ArrowLeft')).toBe('arrowleft');
      expect(normalizeKey('Right')).toBe('arrowright');
      expect(normalizeKey('ArrowRight')).toBe('arrowright');
    });

    it('normalizes single letter to key prefix', () => {
      expect(normalizeKey('m')).toBe('keym');
      expect(normalizeKey('M')).toBe('keym');
      expect(normalizeKey('KeyM')).toBe('keym');
      expect(normalizeKey('f')).toBe('keyf');
    });
  });

  describe('parseShortcut', () => {
    it('parses single key shortcuts', () => {
      const p = parseShortcut('Space');
      expect(p.ctrl).toBe(false);
      expect(p.alt).toBe(false);
      expect(p.shift).toBe(false);
      expect(p.meta).toBe(false);
      expect(p.key).toBe('Space');
    });

    it('parses combo shortcuts with modifiers', () => {
      const p = parseShortcut('Ctrl+Shift+KeyM');
      expect(p.ctrl).toBe(true);
      expect(p.alt).toBe(false);
      expect(p.shift).toBe(true);
      expect(p.meta).toBe(false);
      expect(p.key).toBe('KeyM');
    });

    it('parses Alt and Cmd/Meta combos', () => {
      const p = parseShortcut('Alt+Cmd+ArrowRight');
      expect(p.alt).toBe(true);
      expect(p.meta).toBe(true);
      expect(p.ctrl).toBe(false);
      expect(p.key).toBe('ArrowRight');
    });
  });

  describe('matchesShortcut', () => {
    function makeKeyEvent(opts: {
      code: string;
      key?: string;
      ctrlKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
      metaKey?: boolean;
    }): KeyboardEvent {
      return {
        code: opts.code,
        key: opts.key || opts.code,
        ctrlKey: !!opts.ctrlKey,
        altKey: !!opts.altKey,
        shiftKey: !!opts.shiftKey,
        metaKey: !!opts.metaKey
      } as unknown as KeyboardEvent;
    }

    it('matches single key shortcut when no modifiers are pressed', () => {
      const evt = makeKeyEvent({ code: 'Space', key: ' ' });
      expect(matchesShortcut(evt, 'Space')).toBe(true);
    });

    it('rejects single key shortcut if a modifier is pressed', () => {
      const evt = makeKeyEvent({ code: 'Space', key: ' ', ctrlKey: true });
      expect(matchesShortcut(evt, 'Space')).toBe(false);
    });

    it('matches combination shortcut like Ctrl+KeyM', () => {
      const evt = makeKeyEvent({ code: 'KeyM', key: 'm', ctrlKey: true });
      expect(matchesShortcut(evt, 'Ctrl+KeyM')).toBe(true);
      expect(matchesShortcut(evt, 'Ctrl+M')).toBe(true);
    });

    it('rejects combination if modifier is missing', () => {
      const evt = makeKeyEvent({ code: 'KeyM', key: 'm', ctrlKey: false });
      expect(matchesShortcut(evt, 'Ctrl+KeyM')).toBe(false);
    });

    it('matches multi-modifier combo like Ctrl+Shift+ArrowLeft', () => {
      const evt = makeKeyEvent({
        code: 'ArrowLeft',
        key: 'ArrowLeft',
        ctrlKey: true,
        shiftKey: true
      });
      expect(matchesShortcut(evt, 'Ctrl+Shift+ArrowLeft')).toBe(true);
    });

    it('matches Mute toggle shortcut with KeyM or m', () => {
      const evt = makeKeyEvent({ code: 'KeyM', key: 'm' });
      expect(matchesShortcut(evt, 'KeyM')).toBe(true);
      expect(matchesShortcut(evt, 'm')).toBe(true);
    });
  });

  describe('eventToShortcutString', () => {
    it('returns empty string if only modifier key pressed', () => {
      const evt = { key: 'Control', code: 'ControlLeft', ctrlKey: true } as KeyboardEvent;
      expect(eventToShortcutString(evt)).toBe('');
    });

    it('serializes single key without modifiers', () => {
      const evt = {
        key: ' ',
        code: 'Space',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false
      } as KeyboardEvent;
      expect(eventToShortcutString(evt)).toBe('Space');
    });

    it('serializes combo key with modifiers', () => {
      const evt = {
        key: 'm',
        code: 'KeyM',
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        metaKey: false
      } as KeyboardEvent;
      expect(eventToShortcutString(evt)).toBe('Ctrl+Shift+KeyM');
    });
  });

  describe('formatShortcutForDisplay', () => {
    it('formats Space cleanly', () => {
      expect(formatShortcutForDisplay('Space')).toBe('Space');
    });

    it('formats arrows with unicode arrow glyphs', () => {
      expect(formatShortcutForDisplay('ArrowLeft')).toBe('← Left');
      expect(formatShortcutForDisplay('ArrowRight')).toBe('→ Right');
      expect(formatShortcutForDisplay('ArrowUp')).toBe('↑ Up');
      expect(formatShortcutForDisplay('ArrowDown')).toBe('↓ Down');
    });

    it('formats letter keys by stripping Key prefix', () => {
      expect(formatShortcutForDisplay('KeyM')).toBe('M');
      expect(formatShortcutForDisplay('Ctrl+KeyM')).toBe('Ctrl + M');
      expect(formatShortcutForDisplay('Ctrl+Shift+KeyM')).toBe('Ctrl + Shift + M');
    });
  });
});
