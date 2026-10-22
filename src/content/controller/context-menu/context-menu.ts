/**
 * Controller Context Menu
 *
 * Owns the menu element inside the controller's shadow DOM, instantiates items
 * from a `ContextMenuRegistry`, and handles visibility, section dividers,
 * viewport-aware positioning and event forwarding.
 */

import { contextMenuRegistry, ContextMenuRegistry } from './registry';
import { registerBuiltinContextMenuItems } from './builtin-items';
import {
  CONTEXT_MENU_SECTIONS,
  ContextMenuContext,
  ContextMenuEvent,
  ContextMenuItem
} from './types';

const OPEN_CLASS = 'open';
const VIEWPORT_PADDING = 6;
const POINTER_GAP = 4;

export interface ContextMenuOptions {
  /** Menu element (positioned absolutely inside `anchor`). */
  element: HTMLElement;
  /** Element the menu is positioned relative to (the controller bar). */
  anchor: HTMLElement;
  /** Services passed to items; `close` and `refresh` are provided by the menu. */
  context: Omit<ContextMenuContext, 'close' | 'refresh'>;
  registry?: ContextMenuRegistry;
  onOpenChange?: (isOpen: boolean) => void;
}

export class ContextMenu {
  private readonly element: HTMLElement;
  private readonly anchor: HTMLElement;
  private readonly ctx: ContextMenuContext;
  private readonly items: ContextMenuItem[];
  private readonly onOpenChange?: (isOpen: boolean) => void;
  private readonly stopClick = (e: Event) => e.stopPropagation();

  constructor(options: ContextMenuOptions) {
    this.element = options.element;
    this.anchor = options.anchor;
    this.onOpenChange = options.onOpenChange;

    this.ctx = {
      ...options.context,
      close: () => this.close(),
      refresh: () => this.refresh()
    };

    const registry = options.registry ?? contextMenuRegistry;
    if (registry === contextMenuRegistry) registerBuiltinContextMenuItems(registry);

    this.items = registry.createItems(this.ctx).sort(
      (a, b) =>
        CONTEXT_MENU_SECTIONS.indexOf(a.section) - CONTEXT_MENU_SECTIONS.indexOf(b.section) ||
        a.order - b.order
    );

    this.element.setAttribute('role', 'menu');
    // Interactions inside the menu must not reach the controller/page "click to close" handlers.
    this.element.addEventListener('click', this.stopClick);
    this.element.addEventListener('pointerdown', this.stopClick);
    this.element.addEventListener('mousedown', this.stopClick);
    this.render();
  }

  get isOpen(): boolean {
    return this.element.classList.contains(OPEN_CLASS);
  }

  /** True when at least one item is currently visible. */
  hasVisibleItems(): boolean {
    return this.getVisibleItems().length > 0;
  }

  getItem<T extends ContextMenuItem = ContextMenuItem>(id: string): T | undefined {
    return this.items.find((i) => i.id === id) as T | undefined;
  }

  /**
   * Opens the menu at the pointer position. Returns false (and stays closed)
   * when there is nothing to show.
   */
  openAt(clientX: number, clientY: number): boolean {
    if (!this.render()) {
      this.close();
      return false;
    }

    this.element.classList.add(OPEN_CLASS);
    this.position(clientX, clientY);
    this.onOpenChange?.(true);
    return true;
  }

  close(): void {
    if (!this.isOpen) return;
    this.element.classList.remove(OPEN_CLASS);
    this.onOpenChange?.(false);
  }

  /** Re-evaluates visibility and refreshes items; closes the menu if it became empty. */
  refresh(): void {
    const hasItems = this.render();
    if (!hasItems) this.close();
  }

  dispatch(event: ContextMenuEvent): void {
    for (const item of this.items) {
      try {
        item.onEvent?.(event, this.ctx);
      } catch (err) {
        console.error(`[UFVC ContextMenu] Item "${item.id}" failed to handle event:`, err);
      }
    }
  }

  destroy(): void {
    this.close();
    this.element.removeEventListener('click', this.stopClick);
    this.element.removeEventListener('pointerdown', this.stopClick);
    this.element.removeEventListener('mousedown', this.stopClick);
    for (const item of this.items) {
      try {
        item.destroy?.();
      } catch (err) {
        console.error(`[UFVC ContextMenu] Item "${item.id}" cleanup failed:`, err);
      }
    }
    this.element.replaceChildren();
  }

  // ─── Internals ────────────────────────────────────────────────────────

  private getVisibleItems(): ContextMenuItem[] {
    return this.items.filter((item) => {
      try {
        return item.isVisible(this.ctx);
      } catch {
        return false;
      }
    });
  }

  /** Rebuilds the DOM (visible items + section dividers). Returns whether anything is visible. */
  private render(): boolean {
    const visible = this.getVisibleItems();
    const children: HTMLElement[] = [];
    let lastSection: string | null = null;

    for (const item of visible) {
      if (lastSection !== null && item.section !== lastSection) {
        const divider = document.createElement('div');
        divider.className = 'ufvc-context-separator';
        divider.setAttribute('role', 'separator');
        children.push(divider);
      }
      lastSection = item.section;
      try {
        item.update?.(this.ctx);
      } catch (err) {
        console.error(`[UFVC ContextMenu] Item "${item.id}" failed to update:`, err);
      }
      children.push(item.element);
    }

    this.element.replaceChildren(...children);
    return visible.length > 0;
  }

  /** Places the menu near the pointer while keeping it inside the viewport. */
  private position(clientX: number, clientY: number): void {
    const anchorRect = this.anchor.getBoundingClientRect();
    const menuWidth = this.element.offsetWidth || 180;
    const menuHeight = this.element.offsetHeight || 40;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    // Horizontal: start slightly left of the pointer, clamp to viewport
    let left = clientX - 10;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportWidth - menuWidth - VIEWPORT_PADDING));

    // Vertical: prefer above the pointer, flip below when there is not enough room
    let top = clientY - menuHeight - POINTER_GAP;
    if (top < VIEWPORT_PADDING) top = clientY + POINTER_GAP;
    top = Math.max(VIEWPORT_PADDING, Math.min(top, viewportHeight - menuHeight - VIEWPORT_PADDING));

    this.element.style.left = `${Math.round(left - anchorRect.left)}px`;
    this.element.style.top = `${Math.round(top - anchorRect.top)}px`;
    this.element.style.bottom = 'auto';
  }
}
