/**
 * Generic Default Site Adapter
 *
 * Provides standard fallback behavior for any web page without hardcoded site rules.
 */

import { SiteAdapter } from './site-adapter';
import { SiteSettings } from '../../storage/types';

export class GenericAdapter implements SiteAdapter {
  readonly id = 'generic';
  readonly name = 'Universal Generic Adapter';

  matches(_url: URL): boolean {
    return true; // Catch-all fallback
  }

  getConfigOverrides(): Partial<SiteSettings> {
    return {};
  }
}
