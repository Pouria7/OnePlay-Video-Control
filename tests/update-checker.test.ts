import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectBrowser,
  getBrowserDisplayName,
  isNewerVersion,
  getBrowserRelease,
  checkForUpdates,
  fetchVersionInfo,
  VersionInfo
} from '../src/utils/update-checker';

describe('UpdateChecker', () => {
  const sampleVersionInfo: VersionInfo = {
    title: 'Test Update',
    message: 'New features available',
    browsers: {
      chrome: {
        version: '1.2.0',
        url: 'https://chromewebstore.google.com/detail/test'
      },
      edge: {
        version: '1.0.0', // Edge still under review, older version
        url: 'https://microsoftedge.microsoft.com/addons/detail/test'
      },
      opera: {
        version: '1.1.0',
        url: 'https://addons.opera.com/en/extensions/details/test'
      },
      firefox: {
        version: '1.2.0',
        url: 'https://addons.mozilla.org/en-US/firefox/addon/test'
      },
      default: {
        version: '1.2.0', // Default copies Chrome
        url: 'https://chromewebstore.google.com/detail/test'
      }
    }
  };

  describe('detectBrowser', () => {
    it('detects Edge correctly', () => {
      const edgeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      expect(detectBrowser(edgeUA)).toBe('edge');
    });

    it('detects Opera correctly', () => {
      const operaUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0';
      expect(detectBrowser(operaUA)).toBe('opera');
    });

    it('detects Firefox correctly', () => {
      const ffUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      expect(detectBrowser(ffUA)).toBe('firefox');
    });

    it('detects Chrome correctly', () => {
      const chromeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      expect(detectBrowser(chromeUA)).toBe('chrome');
    });

    it('falls back to default for other user agents', () => {
      const unknownUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
      expect(detectBrowser(unknownUA)).toBe('default');
    });
  });

  describe('getBrowserDisplayName', () => {
    it('returns readable display names', () => {
      expect(getBrowserDisplayName('chrome')).toBe('Google Chrome');
      expect(getBrowserDisplayName('edge')).toBe('Microsoft Edge');
      expect(getBrowserDisplayName('opera')).toBe('Opera');
      expect(getBrowserDisplayName('firefox')).toBe('Mozilla Firefox');
      expect(getBrowserDisplayName('default')).toBe('Browser Extension Store');
    });
  });

  describe('isNewerVersion', () => {
    it('identifies newer versions correctly', () => {
      expect(isNewerVersion('1.1.0', '1.0.0')).toBe(true);
      expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
      expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
      expect(isNewerVersion('v1.2.0', '1.1.5')).toBe(true);
    });

    it('returns false for equal or older versions', () => {
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(false);
      expect(isNewerVersion('0.9.0', '1.0.0')).toBe(false);
      expect(isNewerVersion('1.0.0-beta', '1.0.0')).toBe(false);
    });
  });

  describe('getBrowserRelease', () => {
    it('resolves browser specific version and URL', () => {
      expect(getBrowserRelease(sampleVersionInfo, 'chrome')).toEqual(sampleVersionInfo.browsers.chrome);
      expect(getBrowserRelease(sampleVersionInfo, 'edge')).toEqual(sampleVersionInfo.browsers.edge);
      expect(getBrowserRelease(sampleVersionInfo, 'opera')).toEqual(sampleVersionInfo.browsers.opera);
      expect(getBrowserRelease(sampleVersionInfo, 'firefox')).toEqual(sampleVersionInfo.browsers.firefox);
    });

    it('defaults to Chrome copy when browser is default or missing', () => {
      const release = getBrowserRelease(sampleVersionInfo, 'default');
      expect(release.version).toBe(sampleVersionInfo.browsers.chrome.version);
      expect(release.url).toBe(sampleVersionInfo.browsers.chrome.url);
    });
  });

  describe('fetchVersionInfo & checkForUpdates', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      (globalThis as any).chrome = {
        runtime: {
          getManifest: () => ({ version: '1.0.0' })
        },
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue({})
          }
        }
      };
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('fetches version info successfully from endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleVersionInfo
      } as Response);

      const info = await fetchVersionInfo('https://example.com/version.json');
      expect(info.browsers.chrome.version).toBe('1.2.0');
    });

    it('detects update for Chrome when Chrome version is higher', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => sampleVersionInfo
      } as Response);

      // In JSDOM, default userAgent is usually treated as default or chrome
      const res = await checkForUpdates({ force: true });
      expect(res.latestVersion).toBe('1.2.0');
      expect(res.hasUpdate).toBe(true);
      expect(res.updateUrl).toBeTruthy();
    });

    it('reports no update when store version matches installed version', async () => {
      const noUpdateInfo: VersionInfo = {
        browsers: {
          chrome: { version: '1.0.0', url: 'https://chrome.com' },
          default: { version: '1.0.0', url: 'https://chrome.com' }
        }
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => noUpdateInfo
      } as Response);

      const res = await checkForUpdates({ force: true });
      expect(res.hasUpdate).toBe(false);
      expect(res.latestVersion).toBe('1.0.0');
    });

    it('handles fetch network error gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const res = await checkForUpdates({ force: true });
      expect(res.hasUpdate).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
