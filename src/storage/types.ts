/**
 * Configuration and storage data schemas
 */

import { BuiltinThemeName, ShortcutsConfig } from '../types';

export type DefaultSitePolicy = 'universal' | 'selective';

export type ControllerPosition = 'bottom-inside' | 'bottom-outside' | 'top-inside' | 'top-outside';
export type ControlsLayout = 'full' | 'minimal';

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
  togglePlay: 'Space',
  seekBackward: 'ArrowLeft',
  seekForward: 'ArrowRight',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
  toggleMute: 'KeyM',
  toggleFullscreen: 'KeyF'
};

export interface GlobalSettings {
  enabled: boolean;
  defaultSitePolicy: DefaultSitePolicy;
  defaultTheme: BuiltinThemeName | string;
  controllerPosition: ControllerPosition;
  controlsLayout: ControlsLayout;
  minWidth: number;
  minHeight: number;
  visibilityThreshold: number;
  seekInterval: number;
  allowMultiple: boolean;
  autoHideDelay: number;
  shortcuts: ShortcutsConfig;
}

export interface SiteSettings {
  enabled?: boolean;
  theme?: string;
  controllerPosition?: ControllerPosition;
  controlsLayout?: ControlsLayout;
  minWidth?: number;
  minHeight?: number;
  visibilityThreshold?: number;
  seekInterval?: number;
  allowMultiple?: boolean;
}

export interface CustomThemeDefinition {
  id: string;
  name: string;
  background: string;
  textColor: string;
  accentColor: string;
  borderColor: string;
  borderRadius: string;
  backdropBlur: string;
  opacity: number;
  scale: number;
}

export interface StorageSchema {
  globalSettings: GlobalSettings;
  siteSettings: Record<string, SiteSettings>;
  customThemes: Record<string, CustomThemeDefinition>;
}

export interface ResolvedConfig {
  enabled: boolean;
  theme: string;
  controllerPosition: ControllerPosition;
  controlsLayout: ControlsLayout;
  minWidth: number;
  minHeight: number;
  visibilityThreshold: number;
  seekInterval: number;
  allowMultiple: boolean;
  autoHideDelay: number;
  shortcuts: ShortcutsConfig;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  enabled: true,
  defaultSitePolicy: 'universal',
  defaultTheme: 'classic-dark',
  controllerPosition: 'bottom-inside',
  controlsLayout: 'full',
  minWidth: 160,
  minHeight: 120,
  visibilityThreshold: 0.7,
  seekInterval: 5,
  allowMultiple: true,
  autoHideDelay: 2200,
  shortcuts: DEFAULT_SHORTCUTS
};
