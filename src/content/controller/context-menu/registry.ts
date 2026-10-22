/**
 * Context Menu Registry
 *
 * Central registration point for controller context-menu items.
 *
 * Built-in items are registered by `registerBuiltinContextMenuItems()`.
 * Future internal plugins can contribute their own entries:
 *
 * ```ts
 * const unregister = contextMenuRegistry.register('screenshot', (ctx) => ({
 *   id: 'screenshot',
 *   section: 'tools',
 *   order: 20,
 *   element: createMenuButton({ label: 'Screenshot', icon: ICON, onClick: () => { ... } }),
 *   isVisible: () => true,
 * }));
 * ```
 *
 * Items are instantiated per controller when the controller is created, so
 * registrations made later only affect controllers created afterwards.
 */

import type {
  ContextMenuContext,
  ContextMenuItem,
  ContextMenuItemFactory,
  ContextMenuItemRegistration
} from './types';

export class ContextMenuRegistry {
  private registrations = new Map<string, ContextMenuItemRegistration>();

  /**
   * Registers (or replaces) an item factory. Returns an unregister function.
   */
  register(id: string, factory: ContextMenuItemFactory): () => void {
    this.registrations.set(id, { id, factory });
    return () => {
      if (this.registrations.get(id)?.factory === factory) {
        this.registrations.delete(id);
      }
    };
  }

  unregister(id: string): void {
    this.registrations.delete(id);
  }

  has(id: string): boolean {
    return this.registrations.has(id);
  }

  getRegistrations(): ContextMenuItemRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Instantiates every registered item for a controller.
   * A failing factory is logged and skipped so one broken item never breaks the menu.
   */
  createItems(ctx: ContextMenuContext): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    for (const { id, factory } of this.registrations.values()) {
      try {
        items.push(factory(ctx));
      } catch (err) {
        console.error(`[UFVC ContextMenu] Failed to create item "${id}":`, err);
      }
    }
    return items;
  }
}

/** Shared registry used by all controllers. */
export const contextMenuRegistry = new ContextMenuRegistry();
