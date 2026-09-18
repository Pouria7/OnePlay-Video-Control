/**
 * Configuration precedence resolution engine
 *
 * Precedence Order:
 * 1. User per-site settings (highest priority)
 * 2. Site adapter configuration
 * 3. Global user settings & Default Site Policy (universal vs. selective)
 * 4. Built-in defaults (lowest priority)
 */

import { DEFAULT_GLOBAL_SETTINGS, GlobalSettings, ResolvedConfig, SiteSettings } from './types';

export interface PrecedenceInput {
  domain: string;
  userSiteSettings?: SiteSettings;
  adapterOverrides?: Partial<SiteSettings>;
  globalUserSettings?: Partial<GlobalSettings>;
  builtInDefaults?: GlobalSettings;
}

/**
 * Resolves a final effective configuration for a specific domain by merging layers
 * according to the strict precedence order.
 */
export function resolveEffectiveConfig(input: PrecedenceInput): ResolvedConfig {
  const defaults = input.builtInDefaults ?? DEFAULT_GLOBAL_SETTINGS;
  const globalUser = input.globalUserSettings ?? {};
  const adapter = input.adapterOverrides ?? {};
  const site = input.userSiteSettings ?? {};

  // Helper to pick the first defined value in order of priority: site -> adapter -> globalUser -> defaults
  function pick<T>(
    siteVal: T | undefined,
    adapterVal: T | undefined,
    globalVal: T | undefined,
    defaultVal: T
  ): T {
    if (siteVal !== undefined) return siteVal;
    if (adapterVal !== undefined) return adapterVal;
    if (globalVal !== undefined) return globalVal;
    return defaultVal;
  }

  // Handle Default Site Policy: 'universal' (show everywhere by default) vs 'selective' (whitelist only)
  const policy = globalUser.defaultSitePolicy ?? defaults.defaultSitePolicy;
  let baseEnabled = globalUser.enabled ?? defaults.enabled;
  if (baseEnabled && policy === 'selective' && site.enabled === undefined) {
    // If selective mode is on and site is not explicitly in user settings, default to false
    baseEnabled = false;
  }

  const enabled = pick(site.enabled, adapter.enabled, undefined, baseEnabled);
  const theme = pick(site.theme, adapter.theme, globalUser.defaultTheme, defaults.defaultTheme);
  const controllerPosition = pick(
    site.controllerPosition,
    adapter.controllerPosition,
    globalUser.controllerPosition,
    defaults.controllerPosition
  );
  const controlsLayout = pick(
    site.controlsLayout,
    adapter.controlsLayout,
    globalUser.controlsLayout,
    defaults.controlsLayout
  );
  const minWidth = pick(site.minWidth, adapter.minWidth, globalUser.minWidth, defaults.minWidth);
  const minHeight = pick(site.minHeight, adapter.minHeight, globalUser.minHeight, defaults.minHeight);
  const visibilityThreshold = pick(
    site.visibilityThreshold,
    adapter.visibilityThreshold,
    globalUser.visibilityThreshold,
    defaults.visibilityThreshold
  );
  const seekInterval = pick(
    site.seekInterval,
    adapter.seekInterval,
    globalUser.seekInterval,
    defaults.seekInterval
  );
  const allowMultiple = pick(
    site.allowMultiple,
    adapter.allowMultiple,
    globalUser.allowMultiple,
    defaults.allowMultiple
  );
  const autoHideDelay = pick(
    undefined,
    undefined,
    globalUser.autoHideDelay,
    defaults.autoHideDelay
  );

  const defaultShortcuts = defaults.shortcuts || DEFAULT_GLOBAL_SETTINGS.shortcuts;
  const userShortcuts = globalUser.shortcuts || {};
  const shortcuts = { ...defaultShortcuts, ...userShortcuts };

  return {
    enabled,
    theme,
    controllerPosition,
    controlsLayout,
    minWidth,
    minHeight,
    visibilityThreshold,
    seekInterval,
    allowMultiple,
    autoHideDelay,
    shortcuts
  };
}
