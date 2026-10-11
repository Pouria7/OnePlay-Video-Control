/**
 * Update Checker Module
 *
 * Checks for extension updates by querying a hosted version.json file
 * (hosted on Cloudflare Pages).
 *
 * Since extension stores (Chrome Web Store, Edge Add-ons, Opera, Firefox)
 * approve updates at different times, each browser has its own approved version and URL.
 * 'default' falls back directly to Chrome.
 */

export type SupportedBrowser = 'chrome' | 'edge' | 'opera' | 'firefox' | 'default';

export interface BrowserRelease {
  version: string;
  url: string;
}

export interface VersionInfo {
  title?: string;
  message?: string;
  browsers: {
    chrome: BrowserRelease;
    edge?: BrowserRelease;
    opera?: BrowserRelease;
    firefox?: BrowserRelease;
    default?: BrowserRelease;
    [browser: string]: BrowserRelease | undefined;
  };
  /** Optional fallback / backward compatibility */
  latestVersion?: string;
  storeUrls?: Record<string, string>;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  detectedBrowser: SupportedBrowser;
  detectedBrowserName: string;
  updateUrl: string;
  versionInfo: VersionInfo | null;
  fromCache: boolean;
  error?: string;
}

export const CLOUDFLARE_PAGES_UPDATE_URL = 'https://anaspect-oneplay.pages.dev/version.json';

const CACHE_KEY = 'ufvc_update_cache';
const DISMISSED_KEY = 'ufvc_dismissed_update_version';
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Detects browser family from navigator.userAgent.
 * Note: Checks Edge and Opera first because Chromium-based browsers also include 'Chrome' in userAgent.
 */
export function detectBrowser(customUserAgent?: string): SupportedBrowser {
  const ua = customUserAgent !== undefined ? customUserAgent : (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (/Edg\//i.test(ua)) return 'edge';
  if (/OPR\/|Opera/i.test(ua)) return 'opera';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  if (/Chrome|CriOS/i.test(ua)) return 'chrome';
  return 'default';
}

/**
 * Returns a human-friendly name for the detected browser.
 */
export function getBrowserDisplayName(browser: SupportedBrowser): string {
  switch (browser) {
    case 'chrome':
      return 'Google Chrome';
    case 'edge':
      return 'Microsoft Edge';
    case 'opera':
      return 'Opera';
    case 'firefox':
      return 'Mozilla Firefox';
    default:
      return 'Browser Extension Store';
  }
}

/**
 * Resolves the specific approved version and store URL for a given browser.
 * If browser is 'default' or not explicitly defined, it copies/falls back to 'chrome'.
 */
export function getBrowserRelease(
  versionInfo: VersionInfo | null | undefined,
  browser: SupportedBrowser = detectBrowser()
): BrowserRelease {
  const fallbackChrome: BrowserRelease = {
    version: '1.0.0',
    url: 'https://chromewebstore.google.com/detail/universal-video-controls'
  };

  if (!versionInfo) {
    return fallbackChrome;
  }

  // Backward compatibility with flat structure if ever present
  if (!versionInfo.browsers && versionInfo.latestVersion) {
    const url =
      versionInfo.storeUrls?.[browser] ||
      versionInfo.storeUrls?.default ||
      versionInfo.storeUrls?.chrome ||
      fallbackChrome.url;
    return {
      version: versionInfo.latestVersion,
      url
    };
  }

  if (!versionInfo.browsers) {
    return fallbackChrome;
  }

  const chromeRelease = versionInfo.browsers.chrome || fallbackChrome;
  const defaultRelease = versionInfo.browsers.default || chromeRelease;

  if (browser === 'default') {
    return defaultRelease;
  }

  return versionInfo.browsers[browser] || defaultRelease || chromeRelease;
}

/**
 * Compares two semantic version strings (e.g. "1.1.0" > "1.0.0").
 * Returns true if latest is strictly newer than current.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  if (!latest || !current) return false;

  const clean = (v: string) =>
    v.trim().replace(/^v/i, '').split(/[-+]/)[0].split('.').map((part) => parseInt(part, 10) || 0);

  const lParts = clean(latest);
  const cParts = clean(current);
  const maxLen = Math.max(lParts.length, cParts.length);

  for (let i = 0; i < maxLen; i++) {
    const l = lParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }

  return false;
}

/**
 * Fetches JSON with a timeout.
 */
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-cache',
      headers: { Accept: 'application/json' }
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches version info from Cloudflare Pages.
 */
export async function fetchVersionInfo(primaryUrl = CLOUDFLARE_PAGES_UPDATE_URL): Promise<VersionInfo> {
  try {
    const res = await fetchWithTimeout(primaryUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.browsers || typeof data.latestVersion === 'string')) {
        return data as VersionInfo;
      }
    }
  } catch (err) {
    console.warn('[UpdateChecker] Version metadata fetch failed:', err);
  }

  throw new Error('Could not fetch update version metadata.');
}

/**
 * Gets currently installed extension version.
 */
export function getCurrentVersion(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getManifest) {
    return chrome.runtime.getManifest().version || '1.0.0';
  }
  return '1.0.0';
}

/**
 * Checks for updates.
 * Respects cache unless force is true.
 */
export async function checkForUpdates(options: { force?: boolean; endpointUrl?: string } = {}): Promise<UpdateCheckResult> {
  const currentVersion = getCurrentVersion();
  const detectedBrowser = detectBrowser();
  const detectedBrowserName = getBrowserDisplayName(detectedBrowser);

  // Check cache if not forcing
  if (!options.force && typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const cached = await chrome.storage.local.get(CACHE_KEY);
      const record = cached[CACHE_KEY];
      if (record && record.timestamp && record.versionInfo) {
        const isFresh = Date.now() - record.timestamp < CACHE_DURATION_MS;
        if (isFresh) {
          const vInfo: VersionInfo = record.versionInfo;
          const release = getBrowserRelease(vInfo, detectedBrowser);
          const hasUpdate = isNewerVersion(release.version, currentVersion);
          return {
            hasUpdate,
            currentVersion,
            latestVersion: release.version,
            detectedBrowser,
            detectedBrowserName,
            updateUrl: release.url,
            versionInfo: vInfo,
            fromCache: true
          };
        }
      }
    } catch {
      // Ignore cache read failures and proceed with network request
    }
  }

  // Perform network fetch
  try {
    const versionInfo = await fetchVersionInfo(options.endpointUrl);
    const release = getBrowserRelease(versionInfo, detectedBrowser);
    const hasUpdate = isNewerVersion(release.version, currentVersion);

    // Cache the result
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({
          [CACHE_KEY]: {
            timestamp: Date.now(),
            versionInfo
          }
        });
      } catch {
        // Ignore cache write errors
      }
    }

    return {
      hasUpdate,
      currentVersion,
      latestVersion: release.version,
      detectedBrowser,
      detectedBrowserName,
      updateUrl: release.url,
      versionInfo,
      fromCache: false
    };
  } catch (err: any) {
    const fallbackRelease = getBrowserRelease(undefined, detectedBrowser);
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      detectedBrowser,
      detectedBrowserName,
      updateUrl: fallbackRelease.url,
      versionInfo: null,
      fromCache: false,
      error: err?.message || 'Failed to check for updates'
    };
  }
}

/**
 * Checks if a specific version update has been dismissed by the user.
 */
export async function isVersionDismissed(version: string): Promise<boolean> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const res = await chrome.storage.local.get(DISMISSED_KEY);
      return res[DISMISSED_KEY] === version;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Remembers a version as dismissed.
 */
export async function dismissVersion(version: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [DISMISSED_KEY]: version });
    } catch {
      // Ignore
    }
  }
}
