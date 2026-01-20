export type Theme = {
  colors: {
    // Background - lifted teal-navy gradient
    backgroundStart: string;
    backgroundEnd: string;
    
    // Brand accent (primary) - teal
    brand: string;
    brandLight: string;
    
    // Warning accent - amber (separated from brand)
    warning: string;
    warningLight: string;
    
    // Semantic colors
    positive: string;  // teal/green family
    negative: string;  // muted red, bright for alerts
    
    // Neutrals - slate/blue-gray, not cyan
    neutral: string;
    neutralLight: string;
    
    // Legacy support (for gradual migration)
    cyan200: string;
    cyan300: string;
    amber300: string;
    amber400: string;
    rose400: string;
    emerald400: string;
    indigo400?: string;
    blue400?: string;
    blue700: string;
  };
  radii: {
    xl: string;
    twoXl: string;
    threeXl: string;
  };
};

export const defaultTheme: Theme = {
  colors: {
    // Background - lifted teal-navy, brighter mids
    backgroundStart: '#0c1a24',  // teal-tinted navy
    backgroundEnd: '#0a1419',    // slightly darker base
    
    // Brand accent - teal
    brand: '#2dd4bf',      // teal-400
    brandLight: '#5eead4', // teal-300
    
    // Warning - amber (now separate from brand)
    warning: '#fbbf24',    // amber-400
    warningLight: '#fcd34d', // amber-300
    
    // Semantic
    positive: '#2dd4bf',   // teal (same as brand, per design)
    negative: '#f87171',   // red-400, muted
    
    // Neutrals - slate/blue-gray
    neutral: '#64748b',    // slate-500
    neutralLight: '#94a3b8', // slate-400
    
    // Legacy (for migration)
    cyan200: '#99f6e4',    // teal-200 (adjusted)
    cyan300: '#5eead4',    // teal-300
    amber300: '#fcd34d',
    amber400: '#fbbf24',
    rose400: '#fb7185',
    emerald400: '#34d399',
    blue700: '#1d4ed8',
  },
  radii: {
    xl: '0.75rem',
    twoXl: '1rem',
    threeXl: '1.5rem',
  },
};
