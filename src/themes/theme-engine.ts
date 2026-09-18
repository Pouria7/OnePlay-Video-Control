/**
 * Theme Engine: Resolves and applies theme variables to Shadow DOM
 */

import { BUILTIN_THEMES } from './default-themes';
import { ThemeDefinition, ThemeProperties } from './theme-types';
import { CustomThemeDefinition } from '../storage/types';

export class ThemeEngine {
  private customThemes: Record<string, ThemeDefinition> = {};

  /**
   * Registers or updates custom theme definitions from storage
   */
  setCustomThemes(customThemes: Record<string, CustomThemeDefinition>): void {
    this.customThemes = {};
    for (const [id, def] of Object.entries(customThemes)) {
      this.customThemes[id] = {
        id: def.id,
        name: def.name,
        isBuiltin: false,
        properties: {
          bg: def.background,
          text: def.textColor,
          accent: def.accentColor,
          accentHover: def.accentColor,
          border: def.borderColor,
          radius: def.borderRadius,
          blur: def.backdropBlur,
          opacity: def.opacity ?? 1.0,
          shadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          scale: def.scale ?? 1.0
        }
      };
    }
  }

  /**
   * Resolves a theme by ID, falling back to minimal if not found
   */
  resolveTheme(themeId: string): ThemeDefinition {
    if (BUILTIN_THEMES[themeId]) {
      return BUILTIN_THEMES[themeId];
    }
    if (this.customThemes[themeId]) {
      return this.customThemes[themeId];
    }
    return BUILTIN_THEMES.minimal;
  }

  /**
   * Converts theme properties into CSS variable key-value pairs
   */
  getCssVariables(properties: ThemeProperties): Record<string, string> {
    return {
      '--ufvc-bg': properties.bg,
      '--ufvc-text': properties.text,
      '--ufvc-accent': properties.accent,
      '--ufvc-accent-hover': properties.accentHover,
      '--ufvc-border': properties.border,
      '--ufvc-radius': properties.radius,
      '--ufvc-blur': properties.blur,
      '--ufvc-opacity': String(properties.opacity),
      '--ufvc-shadow': properties.shadow,
      '--ufvc-scale': String(properties.scale)
    };
  }

  /**
   * Injects or updates CSS variables on a controller host/container element
   */
  applyTheme(element: HTMLElement, themeId: string): void {
    const theme = this.resolveTheme(themeId);
    const vars = this.getCssVariables(theme.properties);

    for (const [key, value] of Object.entries(vars)) {
      element.style.setProperty(key, value);
    }
  }
}

export const themeEngine = new ThemeEngine();
