/**
 * Adapter Manager: Registers and resolves the appropriate site adapter for the current URL
 */

import { SiteAdapter } from './site-adapter';
import { GenericAdapter } from './generic-adapter';
import { InstagramAdapter } from './instagram-adapter';
import { YouTubeAdapter } from './youtube-adapter';

export class AdapterManager {
  private adapters: SiteAdapter[] = [];
  private genericAdapter: SiteAdapter = new GenericAdapter();

  constructor() {
    // Register built-in site adapters
    this.register(new InstagramAdapter());
    this.register(new YouTubeAdapter());
  }

  /**
   * Registers a site adapter
   */
  register(adapter: SiteAdapter): void {
    this.adapters.push(adapter);
  }

  /**
   * Resolves the matching adapter for a given URL, falling back to GenericAdapter
   */
  resolve(url: URL | Location): SiteAdapter {
    const urlObj = url instanceof URL ? url : new URL(url.href);
    for (const adapter of this.adapters) {
      try {
        if (adapter.matches(urlObj)) {
          return adapter;
        }
      } catch (err) {
        console.warn(`[UFVC AdapterManager] Error matching adapter ${adapter.id}:`, err);
      }
    }
    return this.genericAdapter;
  }
}

export const adapterManager = new AdapterManager();
