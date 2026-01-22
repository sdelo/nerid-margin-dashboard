import React from "react";
import { Link } from "react-router-dom";
import { brand } from "../config/brand";

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-4 mt-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src={brand.logo.src} alt={brand.logo.alt} className={brand.logo.sizes.md} />
            <div>
              <div className="font-bold text-white tracking-wide">{brand.name}</div>
              <div className="text-sm text-white/50">{brand.tagline}</div>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-6">
            <FooterLink href={brand.links.twitter}>Twitter</FooterLink>
            <FooterLink href={brand.links.github}>GitHub</FooterLink>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-white/40">
          <div>
            Built for the DeepBook Community
          </div>
          <div>
            {brand.copyright}. Open source.
          </div>
        </div>
      </div>
    </footer>
  );
}

interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
  internal?: boolean;
  placeholder?: boolean;
}

function FooterLink({ href, children, internal, placeholder }: FooterLinkProps) {
  const className = `text-white/60 hover:text-white transition-colors ${placeholder ? 'opacity-50 cursor-not-allowed' : ''}`;
  
  if (internal) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  
  return (
    <a 
      href={placeholder ? undefined : href}
      target="_blank" 
      rel="noopener noreferrer" 
      className={className}
      onClick={placeholder ? (e) => e.preventDefault() : undefined}
    >
      {children}
      {placeholder && <span className="ml-1 text-xs">(soon)</span>}
    </a>
  );
}
