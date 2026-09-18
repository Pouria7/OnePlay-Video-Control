/**
 * Chrome Storage Manager with sync support, local fallback, and change subscription
 */

import {
  CustomThemeDefinition,
  DEFAULT_GLOBAL_SETTINGS,
  GlobalSettings,
  SiteSettings,
  StorageSchema
} from './types';
import { normalizeDomain } from '../utils/url';

class StorageManager {
  private inMemoryCache: StorageSchema = {
    globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
    siteSettings: {},
    customThemes: {}
  };

  private isChromeStorageAvailable(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      !!chrome.storage &&
      (!!chrome.storage.sync || !!chrome.storage.local)
    );
  }

  private getStorageArea(): chrome.storage.StorageArea | null {
    if (!this.isChromeStorageAvailable()) return null;
    return chrome.storage.sync || chrome.storage.local || null;
  }

  /**
   * Initializes or fetches all current settings from storage
   */
  async getAll(): Promise<StorageSchema> {
    const storage = this.getStorageArea();
    if (!storage) {
      return this.inMemoryCache;
    }

    try {
      const result = await storage.get(['globalSettings', 'siteSettings', 'customThemes']);
      this.inMemoryCache = {
        globalSettings: { ...DEFAULT_GLOBAL_SETTINGS, ...(result.globalSettings || {}) },
        siteSettings: result.siteSettings || {},
        customThemes: result.customThemes || {}
      };
      return this.inMemoryCache;
    } catch (err) {
      console.warn('[UFVC Storage] Failed to read from chrome.storage, using in-memory cache:', err);
      return this.inMemoryCache;
    }
  }

  /**
   * Retrieves global settings
   */
  async getGlobalSettings(): Promise<GlobalSettings> {
    const all = await this.getAll();
    return all.globalSettings;
  }

  /**
   * Updates global settings
   */
  async setGlobalSettings(partial: Partial<GlobalSettings>): Promise<GlobalSettings> {
    const all = await this.getAll();
    all.globalSettings = { ...all.globalSettings, ...partial };
    await this.persist('globalSettings', all.globalSettings);
    return all.globalSettings;
  }

  /**
   * Retrieves settings for a specific domain
   */
  async getSiteSettings(rawDomain: string): Promise<SiteSettings | undefined> {
    const domain = normalizeDomain(rawDomain);
    const all = await this.getAll();
    return all.siteSettings[domain];
  }

  /**
   * Updates or sets settings for a specific domain
   */
  async setSiteSettings(rawDomain: string, settings: Partial<SiteSettings>): Promise<SiteSettings> {
    const domain = normalizeDomain(rawDomain);
    const all = await this.getAll();
    const existing = all.siteSettings[domain] || {};
    all.siteSettings[domain] = { ...existing, ...settings };
    await this.persist('siteSettings', all.siteSettings);
    return all.siteSettings[domain];
  }

  /**
   * Retrieves custom theme definitions
   */
  async getCustomThemes(): Promise<Record<string, CustomThemeDefinition>> {
    const all = await this.getAll();
    return all.customThemes;
  }

  /**
   * Saves or updates a custom theme definition
   */
  async saveCustomTheme(theme: CustomThemeDefinition): Promise<void> {
    const all = await this.getAll();
    all.customThemes[theme.id] = theme;
    await this.persist('customThemes', all.customThemes);
  }

  /**
   * Adds an observer callback triggered whenever storage changes
   */
  onChanged(callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void): () => void {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'sync' || areaName === 'local') {
          // Update cache
          if (changes.globalSettings?.newValue) {
            this.inMemoryCache.globalSettings = changes.globalSettings.newValue;
          }
          if (changes.siteSettings?.newValue) {
            this.inMemoryCache.siteSettings = changes.siteSettings.newValue;
          }
          if (changes.customThemes?.newValue) {
            this.inMemoryCache.customThemes = changes.customThemes.newValue;
          }
          callback(changes);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
    return () => {};
  }

  private async persist(key: keyof StorageSchema, value: any): Promise<void> {
    const storage = this.getStorageArea();
    if (!storage) return;

    try {
      await storage.set({ [key]: value });
    } catch (err) {
      console.warn(`[UFVC Storage] Failed to persist ${key} to primary storage, trying fallback:`, err);
      if (chrome.storage.local && storage !== chrome.storage.local) {
        try {
          await chrome.storage.local.set({ [key]: value });
        } catch (localErr) {
          console.error('[UFVC Storage] Fallback persistence failed:', localErr);
        }
      }
    }
  }
}

export const storageManager = new StorageManager();
