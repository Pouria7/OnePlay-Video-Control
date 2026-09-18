/**
 * Built-in Theme Definitions
 */

import { ThemeDefinition } from './theme-types';

export const BUILTIN_THEMES: Record<string, ThemeDefinition> = {
  minimal: {
    id: 'minimal',
    name: 'Minimal (Default)',
    isBuiltin: true,
    properties: {
      bg: 'rgba(18, 20, 24, 0.76)',
      text: '#f3f4f6',
      accent: '#9ca3af',
      accentHover: '#e5e7eb',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      radius: '10px',
      blur: 'blur(8px)',
      opacity: 0.95,
      shadow: '0 8px 24px -4px rgba(0, 0, 0, 0.35)',
      scale: 1.0
    }
  },
  'minimal-dark': {
    id: 'minimal-dark',
    name: 'Minimal Dark',
    isBuiltin: true,
    properties: {
      bg: 'rgba(8, 8, 10, 0.92)',
      text: '#ffffff',
      accent: '#e2e8f0',
      accentHover: '#ffffff',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      radius: '8px',
      blur: 'none',
      opacity: 1.0,
      shadow: '0 10px 30px rgba(0, 0, 0, 0.65)',
      scale: 1.0
    }
  },
  glass: {
    id: 'glass',
    name: 'Glassmorphism',
    isBuiltin: true,
    properties: {
      bg: 'rgba(255, 255, 255, 0.14)',
      text: '#ffffff',
      accent: '#38bdf8',
      accentHover: '#7dd3fc',
      border: '1px solid rgba(255, 255, 255, 0.28)',
      radius: '14px',
      blur: 'blur(16px) saturate(180%)',
      opacity: 0.96,
      shadow: '0 12px 32px 0 rgba(31, 38, 135, 0.37), inset 0 1px 0 0 rgba(255, 255, 255, 0.35)',
      scale: 1.0
    }
  },
  'accent-blue': {
    id: 'accent-blue',
    name: 'Accent Blue',
    isBuiltin: true,
    properties: {
      bg: 'rgba(15, 23, 42, 0.85)',
      text: '#f8fafc',
      accent: '#3b82f6',
      accentHover: '#60a5fa',
      border: '1px solid rgba(59, 130, 246, 0.35)',
      radius: '10px',
      blur: 'blur(10px)',
      opacity: 0.98,
      shadow: '0 8px 24px -2px rgba(14, 165, 233, 0.25)',
      scale: 1.0
    }
  }
};
