/**
 * Domain Restrictions for Media Download / Recording
 *
 * Enforces Chrome Web Store policies (e.g. YouTube copyright policy / Blue Zinc).
 * Disables downloading or stream recording on blacklisted domains.
 */

import { domainMatches } from './url';

/**
 * Domains where downloading or recording video streams is strictly prohibited
 * to comply with platform developer policies (specifically YouTube).
 */
export const DOWNLOAD_RESTRICTED_DOMAINS: readonly string[] = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com'
];

/**
 * Checks if media downloading/recording is restricted on the given hostname or URL.
 */
export function isDownloadRestricted(urlOrHostname?: string | URL | Location): boolean {
  try {
    let hostname = '';
    const target = urlOrHostname !== undefined
      ? urlOrHostname
      : (typeof window !== 'undefined' && window.location ? window.location : '');

    if (typeof target === 'string') {
      try {
        hostname = new URL(target).hostname;
      } catch {
        hostname = target;
      }
    } else if (target && typeof target === 'object' && 'hostname' in target) {
      hostname = (target as any).hostname || '';
    }

    if (!hostname) return false;

    return DOWNLOAD_RESTRICTED_DOMAINS.some((domain) => domainMatches(hostname, domain));
  } catch {
    return false;
  }
}
