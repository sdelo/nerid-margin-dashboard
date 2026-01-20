/**
 * Brand Configuration
 * 
 * Centralized brand settings for easy updates.
 * Logo can be swapped by changing the import/path here.
 */

// Logo imports - swap these when updating brand assets
import NeridLogo from '../assets/nerid-logo.svg';

export const brand = {
  name: 'Nerid',
  tagline: 'Liquidity infrastructure on Sui',
  
  // Logo configuration
  logo: {
    src: NeridLogo,
    alt: 'Nerid',
    // Size variants for different contexts
    sizes: {
      sm: 'w-6 h-6',
      md: 'w-8 h-8', 
      lg: 'w-10 h-10',
      xl: 'w-14 h-14',
    },
  },

  // External links (placeholders for now)
  links: {
    docs: 'https://docs.sui.io/guides/developer/deepbook',
    twitter: 'https://x.com/NeridFinance',
    discord: 'https://discord.com',
    github: 'https://github.com/sdelo/nerid-margin-dashboard',
  },

  // Copyright
  copyright: `© ${new Date().getFullYear()} Nerid`,
} as const;

export type Brand = typeof brand;
