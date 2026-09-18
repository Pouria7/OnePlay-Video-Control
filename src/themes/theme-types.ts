/**
 * Theme system types and CSS variable contracts
 */

export interface ThemeProperties {
  bg: string;
  text: string;
  accent: string;
  accentHover: string;
  border: string;
  radius: string;
  blur: string;
  opacity: number;
  shadow: string;
  scale: number;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  isBuiltin: boolean;
  properties: ThemeProperties;
}
