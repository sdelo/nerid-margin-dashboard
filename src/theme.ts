import { defaultTheme } from './types/theme';

export function applyTheme(theme = defaultTheme) {
  const root = document.documentElement;
  
  // Background
  root.style.setProperty('--color-bg-start', theme.colors.backgroundStart);
  root.style.setProperty('--color-bg-end', theme.colors.backgroundEnd);
  
  // Brand accent
  root.style.setProperty('--color-brand', theme.colors.brand);
  root.style.setProperty('--color-brand-light', theme.colors.brandLight);
  
  // Warning accent
  root.style.setProperty('--color-warning', theme.colors.warning);
  root.style.setProperty('--color-warning-light', theme.colors.warningLight);
  
  // Semantic
  root.style.setProperty('--color-positive', theme.colors.positive);
  root.style.setProperty('--color-negative', theme.colors.negative);
  
  // Neutrals
  root.style.setProperty('--color-neutral', theme.colors.neutral);
  root.style.setProperty('--color-neutral-light', theme.colors.neutralLight);
  
  // Legacy support
  root.style.setProperty('--color-amber-300', theme.colors.amber300);
  root.style.setProperty('--color-amber-400', theme.colors.amber400);
  root.style.setProperty('--color-cyan-200', theme.colors.cyan200);
  root.style.setProperty('--color-cyan-300', theme.colors.cyan300);
  if (theme.colors.rose400) root.style.setProperty('--color-rose-400', theme.colors.rose400);
  if (theme.colors.emerald400) root.style.setProperty('--color-emerald-400', theme.colors.emerald400);
  if (theme.colors.indigo400) root.style.setProperty('--color-indigo-400', theme.colors.indigo400);
  if (theme.colors.blue400) root.style.setProperty('--color-blue-400', theme.colors.blue400);
  root.style.setProperty('--color-blue-700', theme.colors.blue700);

  root.style.setProperty('--radius-xl', theme.radii.xl);
  root.style.setProperty('--radius-2xl', theme.radii.twoXl);
  root.style.setProperty('--radius-3xl', theme.radii.threeXl);
}

export const themes = {
  default: defaultTheme,
  nerid: {
    colors: {
      // Lifted teal-navy gradient
      backgroundStart: '#0c1a24',
      backgroundEnd: '#0a1419',
      
      // Brand - teal
      brand: '#2dd4bf',
      brandLight: '#5eead4',
      
      // Warning - amber
      warning: '#fbbf24',
      warningLight: '#fcd34d',
      
      // Semantic
      positive: '#2dd4bf',
      negative: '#f87171',
      
      // Neutrals - slate
      neutral: '#64748b',
      neutralLight: '#94a3b8',
      
      // Legacy
      amber300: '#fcd34d',
      amber400: '#fbbf24',
      cyan200: '#99f6e4',
      cyan300: '#5eead4',
      rose400: '#fb7185',
      emerald400: '#34d399',
      indigo400: '#6366f1',
      blue400: '#38bdf8',
      blue700: '#1d4ed8',
    },
    radii: {
      xl: '0.75rem',
      twoXl: '1rem',
      threeXl: '1.5rem',
    },
  },
} as const;

export type ThemeName = keyof typeof themes;

export function setTheme(name: ThemeName) {
  applyTheme(themes[name]);
}
