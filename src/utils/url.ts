/**
 * URL and domain utility functions
 */

const COMMON_TWO_PART_TLDS = new Set([
  'co.uk',
  'com.au',
  'co.nz',
  'co.jp',
  'com.br',
  'com.mx',
  'co.za',
  'org.uk',
  'gov.uk'
]);

/**
 * Normalizes a hostname by removing leading www, mobile m., and port, converting to lowercase
 */
export function normalizeDomain(rawHostname: string): string {
  if (!rawHostname) return '';
  let host = rawHostname.toLowerCase().trim();
  // Remove port if present
  if (host.includes(':')) {
    host = host.split(':')[0];
  }
  // Strip leading www.
  if (host.startsWith('www.')) {
    host = host.slice(4);
  }
  return host;
}

/**
 * Extracts the base registrable domain (e.g. m.youtube.com -> youtube.com, reels.instagram.com -> instagram.com)
 */
export function extractBaseDomain(rawHostname: string): string {
  const host = normalizeDomain(rawHostname);
  if (!host) return '';

  // Check IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === 'localhost') {
    return host;
  }

  const parts = host.split('.');
  if (parts.length <= 2) {
    return host;
  }

  // Check if ending matches a known 2-part TLD like co.uk
  const lastTwo = parts.slice(-2).join('.');
  if (COMMON_TWO_PART_TLDS.has(lastTwo)) {
    if (parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return host;
  }

  // Otherwise, base domain is the last 2 parts (e.g. [reels, instagram, com] -> instagram.com)
  return parts.slice(-2).join('.');
}

/**
 * Checks whether a given hostname matches a target domain pattern.
 * Supports exact match, subdomain match (e.g. m.youtube.com matches youtube.com),
 * and prevents prefix mismatch (e.g. fakeinstagram.com does NOT match instagram.com).
 */
export function domainMatches(currentHostname: string, targetDomainPattern: string): boolean {
  const current = normalizeDomain(currentHostname);
  const target = normalizeDomain(targetDomainPattern);

  if (!current || !target) return false;

  if (current === target) {
    return true;
  }

  // Check if current is a subdomain of target (e.g., reels.instagram.com ends with .instagram.com)
  if (current.endsWith(`.${target}`)) {
    return true;
  }

  // Check if base domain matches
  if (extractBaseDomain(current) === target) {
    return true;
  }

  return false;
}

/**
 * Safely extracts normalized base domain from a URL string or Location object
 */
export function getDomainFromUrl(urlOrLocation: string | Location): string {
  try {
    if (typeof urlOrLocation === 'string') {
      const parsed = new URL(urlOrLocation);
      return extractBaseDomain(parsed.hostname);
    }
    return extractBaseDomain(urlOrLocation.hostname);
  } catch {
    return '';
  }
}
