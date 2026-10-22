/**
 * Controller Context Menu — public contracts
 *
 * The right-click menu of the floating controller is assembled from independent
 * items. Each item is created by a factory registered in a `ContextMenuRegistry`,
 * so built-in features (and, later, internal plugins) can contribute entries
 * without the controller knowing about them.
 */

import type { ResolvedConfig } from '../../../storage/types';
import type { RecordingManager } from '../recording-manager';
import type { VolumeState } from '../volume-state';

/**
 * Sections are rendered in this order and separated by a divider.
 * Items inside a section are sorted by `order` (ascending).
 */
export const CONTEXT_MENU_SECTIONS = ['playback', 'tools', 'plugins'] as const;
export type ContextMenuSection = (typeof CONTEXT_MENU_SECTIONS)[number];

/**
 * Events the controller forwards to every menu item.
 * Extend this union when new controller-level signals are needed.
 */
export type ContextMenuEvent =
  | { type: 'recording'; isRecording: boolean; seconds: number }
  | { type: 'feedback'; message: string; durationMs?: number };

/**
 * Services exposed by the controller to menu items.
 */
export interface ContextMenuContext {
  readonly video: HTMLVideoElement;
  readonly volume: VolumeState;
  readonly recording: RecordingManager;
  /** Current resolved configuration (changes over time). */
  getConfig(): ResolvedConfig;
  /** Closes the menu. */
  close(): void;
  /** Re-evaluates visibility and refreshes all items (e.g. after a state change). */
  refresh(): void;
}

/**
 * A single context-menu entry instance (one per controller).
 */
export interface ContextMenuItem {
  readonly id: string;
  readonly section: ContextMenuSection;
  /** Sort order inside its section (lower first). */
  readonly order: number;
  /** The rendered element. Created once by the factory. */
  readonly element: HTMLElement;

  /** Whether the item should be shown right now. Evaluated every time the menu opens. */
  isVisible(ctx: ContextMenuContext): boolean;
  /** Sync the element with the current state. Called when the menu opens and on `refresh()`. */
  update?(ctx: ContextMenuContext): void;
  /** Receives controller events (recording progress, feedback messages, ...). */
  onEvent?(event: ContextMenuEvent, ctx: ContextMenuContext): void;
  /** Release listeners/timers. */
  destroy?(): void;
}

/**
 * Creates an item for a specific controller.
 */
export type ContextMenuItemFactory = (ctx: ContextMenuContext) => ContextMenuItem;

export interface ContextMenuItemRegistration {
  readonly id: string;
  readonly factory: ContextMenuItemFactory;
}
