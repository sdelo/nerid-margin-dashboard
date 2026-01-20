import React from "react";
import { Link } from "react-router-dom";
import { LandingNavBar } from "../components/LandingNavBar";
import { LandingPoolCard } from "../components/LandingPoolCard";
import { GlobalMetricsPanel } from "../features/lending/components/GlobalMetricsPanel";
import { HowItWorks } from "../components/HowItWorks";
import { TransparencySection } from "../components/TransparencySection";
import { Footer } from "../components/Footer";
import { useAllPools } from "../hooks/useAllPools";
import { useProtocolMetrics } from "../hooks/useProtocolMetrics";
import { brand } from "../config/brand";

export function LandingPage() {
  const { pools, isLoading } = useAllPools();
  const metrics = useProtocolMetrics();

  // Calculate total suppliers across pools
  const totalSuppliers = React.useMemo(() => {
    if (pools.length === 0) return 0;
    return pools.reduce((acc, p) => acc + (p.ui.depositors || 0), 0);
  }, [pools]);

  return (
    <div className="min-h-screen">
      <LandingNavBar />

      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo and Name */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src={brand.logo.src} alt={brand.logo.alt} className={brand.logo.sizes.xl} />
            <h1 className="text-4xl font-bold text-white tracking-wide">{brand.name}</h1>
          </div>

          {/* Main Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Earn yield with confidence
          </h2>

          {/* Subline - Punchy explainer */}
          <p className="text-xl text-white/70 max-w-2xl mx-auto mb-2">
            Supply to DeepBook margin pools. Earn variable interest from borrowing demand.
          </p>

          {/* Powered by DeepBook - Badge style attribution near headline */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Powered by</span>
            <span className="text-xs font-medium text-white/50">DeepBook</span>
          </div>

          {/* Stats Highlight - Active Suppliers and Borrowers with timeframe */}
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-6 px-6 py-3 rounded-full bg-white/5 border border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <UsersSmallIcon />
              <span className="text-white/50 text-xs">Active suppliers <span className="text-white/40">(7d)</span>:</span>
              <span className="text-lg font-bold text-teal-400">
                {isLoading ? "..." : totalSuppliers.toLocaleString()}
              </span>
            </div>
            <div className="hidden sm:block w-px h-5 bg-white/10" />
            <div className="flex items-center gap-2">
              <BorrowersIcon />
              <span className="text-white/50 text-xs">Active borrowers <span className="text-white/40">(7d)</span>:</span>
              <span className="text-lg font-bold text-teal-400">
                {metrics.isLoading ? "..." : metrics.activeMarginManagers.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Alive proof - Total borrowed shows real flow */}
          <p className="text-sm text-white/40 mb-8">
            {metrics.isLoading ? "" : (
              <>
                <span className="text-white/50">${metrics.totalBorrowed.toLocaleString()}</span>
                {" "}currently borrowed across all pools
              </>
            )}
          </p>

          {/* Primary CTA */}
          <div className="mb-3">
            <Link
              to="/pools"
              className="btn-primary inline-flex items-center gap-2 text-lg"
            >
              Launch App
              <ArrowRightIcon />
            </Link>
          </div>

          {/* Trust line under CTA */}
          <p className="text-xs text-white/40 mb-6">
            Non-custodial · On-chain contracts · Variable rates
          </p>

          {/* Trust Bar - Consolidated with withdrawal policy */}
          <div className="flex flex-wrap justify-center gap-4 text-xs text-white/50">
            <div className="flex items-center gap-1.5">
              <VerifyIcon />
              <span>Verify on-chain</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CodePreviewIcon />
              <span>Preview tx before signing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <NoLockIcon />
              <span>No fixed lockup — withdrawals depend on liquidity</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pool Cards Section */}
      <section id="pool-cards" className="py-8 px-4 scroll-mt-24">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {pools.map((pool) => (
              <LandingPoolCard key={pool.id} pool={pool} />
            ))}
          </div>
        </div>
      </section>

      {/* Risks Section - Always visible */}
      <section className="py-8 px-4">
        <RisksSection />
      </section>

      {/* Transparency - Moved up for trust */}
      <TransparencySection />

      {/* Secondary CTA - Compare pools */}
      <section className="py-8 px-4">
        <div className="max-w-xl mx-auto text-center">
          <Link
            to="/pools"
            className="text-sm text-white/60 hover:text-white transition-colors inline-flex items-center gap-1.5 border border-white/10 rounded-full px-5 py-2.5 hover:border-white/20"
          >
            Compare pool rates & metrics
            <ArrowRightIcon />
          </Link>
        </div>
      </section>

      {/* Protocol Overview */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <GlobalMetricsPanel />
        </div>
      </section>

      {/* How It Works */}
      <HowItWorks />

      {/* Advanced Tools - Liquidations (demoted from main feature) */}
      <AdvancedToolsSection />

      {/* Bottom CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="card-surface-elevated p-10">
            <h2 className="text-3xl font-bold text-white mb-4">
              Built for the DeepBook Community
            </h2>
            <p className="text-white/60 mb-8">
              An open dashboard for exploring and participating in DeepBook Margin pools on Sui.
            </p>
            <Link
              to="/pools"
              className="btn-primary inline-flex items-center gap-2"
            >
              Start Earning
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function VerifyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function CodePreviewIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}

function NoLockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

// Advanced Tools Section - Demoted liquidations center
function AdvancedToolsSection() {
  return (
    <section className="py-12 px-4 border-t border-white/5">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-wider text-white/40 font-medium">
            Advanced Tools <span className="text-white/25">(for liquidators)</span>
          </span>
          <h3 className="text-xl font-semibold text-white mt-2">
            Liquidations Center
          </h3>
          <p className="text-white/50 text-sm mt-2 max-w-lg mx-auto">
            Monitor at-risk margin positions and execute liquidations. Built for bots and experienced traders — not required for depositors.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AdvancedFeature icon={<RiskIcon />} label="Risk Distribution" />
          <AdvancedFeature icon={<SimIcon />} label="Price Simulator" />
          <AdvancedFeature icon={<HistIcon />} label="Liquidation History" />
          <AdvancedFeature icon={<LeaderIcon />} label="Leaderboard" />
        </div>

        <div className="text-center mt-6">
          <Link
            to="/pools"
            className="text-sm text-white/50 hover:text-white/80 transition-colors inline-flex items-center gap-1"
          >
            Explore advanced tools →
          </Link>
        </div>
      </div>
    </section>
  );
}

function AdvancedFeature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center hover:bg-white/[0.05] transition-colors">
      <div className="text-white/40 mb-2 flex justify-center">{icon}</div>
      <span className="text-xs text-white/50">{label}</span>
    </div>
  );
}

function RiskIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="14" width="3" height="6" rx="0.5" />
      <rect x="10" y="10" width="3" height="10" rx="0.5" />
      <rect x="16" y="6" width="3" height="14" rx="0.5" />
    </svg>
  );
}

function SimIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function HistIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function LeaderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      <path d="M12 15v4M8 22h8" />
    </svg>
  );
}

// Risks disclosure section - always visible
function RisksSection() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-4">
        <h3 className="text-sm font-medium text-white/60">Things to Know</h3>
      </div>
      <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="grid sm:grid-cols-2 gap-4 text-xs text-white/50">
          <div className="flex items-start gap-2">
            <span className="text-white/30 mt-0.5">•</span>
            <span><strong className="text-white/60">Smart contracts</strong> — Protocol code is on-chain and auditable, but all smart contracts carry inherent risk.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-white/30 mt-0.5">•</span>
            <span><strong className="text-white/60">Withdrawals</strong> — If utilization is high, you may need to wait for borrowers to repay before withdrawing.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-white/30 mt-0.5">•</span>
            <span><strong className="text-white/60">Market conditions</strong> — Extreme volatility could affect liquidations and pool health.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-white/30 mt-0.5">•</span>
            <span><strong className="text-white/60">Variable rates</strong> — APY changes based on pool utilization. Past performance isn't predictive.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BorrowersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 11l-5-5-5 5M12 6v12" />
      <path d="M5 18h14" />
    </svg>
  );
}

