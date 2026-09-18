import { describe, it, expect } from 'vitest';
import { resolveEffectiveConfig } from '../src/storage/config-precedence';
import { DEFAULT_GLOBAL_SETTINGS } from '../src/storage/types';

describe('ConfigPrecedence', () => {
  it('falls back to built-in defaults when no overrides exist', () => {
    const config = resolveEffectiveConfig({
      domain: 'example.com'
    });

    expect(config.enabled).toBe(DEFAULT_GLOBAL_SETTINGS.enabled);
    expect(config.theme).toBe(DEFAULT_GLOBAL_SETTINGS.defaultTheme);
    expect(config.controllerPosition).toBe(DEFAULT_GLOBAL_SETTINGS.controllerPosition);
    expect(config.controlsLayout).toBe(DEFAULT_GLOBAL_SETTINGS.controlsLayout);
    expect(config.minWidth).toBe(DEFAULT_GLOBAL_SETTINGS.minWidth);
    expect(config.minHeight).toBe(DEFAULT_GLOBAL_SETTINGS.minHeight);
    expect(config.visibilityThreshold).toBe(DEFAULT_GLOBAL_SETTINGS.visibilityThreshold);
    expect(config.seekInterval).toBe(DEFAULT_GLOBAL_SETTINGS.seekInterval);
  });

  it('allows global user settings to override built-in defaults', () => {
    const config = resolveEffectiveConfig({
      domain: 'example.com',
      globalUserSettings: {
        defaultTheme: 'glass',
        seekInterval: 10,
        minWidth: 200
      }
    });

    expect(config.theme).toBe('glass');
    expect(config.seekInterval).toBe(10);
    expect(config.minWidth).toBe(200);
    expect(config.minHeight).toBe(DEFAULT_GLOBAL_SETTINGS.minHeight); // untouched default
  });

  it('allows site adapter to override global user settings', () => {
    const config = resolveEffectiveConfig({
      domain: 'instagram.com',
      globalUserSettings: {
        defaultTheme: 'classic-dark',
        minWidth: 140,
        visibilityThreshold: 0.8
      },
      adapterOverrides: {
        minWidth: 180,
        visibilityThreshold: 0.65
      }
    });

    expect(config.theme).toBe('classic-dark'); // from global user
    expect(config.minWidth).toBe(180); // overridden by adapter
    expect(config.visibilityThreshold).toBe(0.65); // overridden by adapter
  });

  it('allows user per-site settings to override adapter and global settings (highest priority)', () => {
    const config = resolveEffectiveConfig({
      domain: 'instagram.com',
      globalUserSettings: {
        defaultTheme: 'classic-dark',
        minWidth: 140
      },
      adapterOverrides: {
        theme: 'midnight',
        minWidth: 180
      },
      userSiteSettings: {
        theme: 'ocean-blue',
        minWidth: 250,
        enabled: false
      }
    });

    // User per-site wins on all specified fields
    expect(config.theme).toBe('ocean-blue');
    expect(config.minWidth).toBe(250);
    expect(config.enabled).toBe(false);
  });

  it('handles selective/whitelist policy vs universal policy', () => {
    // Under selective policy, unconfigured site is disabled
    const selectiveUnconfigured = resolveEffectiveConfig({
      domain: 'randomsite.com',
      globalUserSettings: {
        defaultSitePolicy: 'selective'
      }
    });
    expect(selectiveUnconfigured.enabled).toBe(false);

    // Under selective policy, explicitly configured site is enabled
    const selectiveConfigured = resolveEffectiveConfig({
      domain: 'favsite.com',
      globalUserSettings: {
        defaultSitePolicy: 'selective'
      },
      userSiteSettings: {
        enabled: true
      }
    });
    expect(selectiveConfigured.enabled).toBe(true);

    // Under universal policy, unconfigured site is enabled
    const universalUnconfigured = resolveEffectiveConfig({
      domain: 'randomsite.com',
      globalUserSettings: {
        defaultSitePolicy: 'universal'
      }
    });
    expect(universalUnconfigured.enabled).toBe(true);
  });

  it('respects controllerPosition and controlsLayout overrides', () => {
    const config = resolveEffectiveConfig({
      domain: 'youtube.com',
      globalUserSettings: {
        controllerPosition: 'top-outside',
        controlsLayout: 'minimal'
      },
      userSiteSettings: {
        controllerPosition: 'top-inside'
      }
    });

    expect(config.controllerPosition).toBe('top-inside'); // site overrides global
    expect(config.controlsLayout).toBe('minimal'); // global setting
  });
});
