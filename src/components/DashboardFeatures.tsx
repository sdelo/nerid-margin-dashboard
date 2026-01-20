import { Link } from "react-router-dom";

export function DashboardFeatures() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-400/10 border border-teal-400/30 text-teal-400 text-sm mb-6">
            <LightningIcon />
            Liquidations Center
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Your edge in DeFi liquidations
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Monitor at-risk positions in real-time, simulate price scenarios, 
            and execute liquidations with full visibility into rewards and rankings.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<RiskBarsIcon />}
            title="Risk Distribution"
            description="Visual breakdown of positions by risk ratio. Color-coded bands from liquidatable (red) to safe (cyan) so you can prioritize targets."
            highlight="amber"
          />
          <FeatureCard
            icon={<SimulatorIcon />}
            title="Price Sensitivity Simulator"
            description="Simulate price changes from -50% to +50% and see how many positions become liquidatable. Plan ahead for market moves."
            highlight="cyan"
          />
          <FeatureCard
            icon={<HistoryIcon />}
            title="Liquidation History"
            description="Complete record of past liquidations with timestamps, rewards paid, bad debt events, and links to on-chain transactions."
            highlight="amber"
          />
          <FeatureCard
            icon={<TrophyIcon />}
            title="Liquidator Leaderboard"
            description="Rankings of top liquidators by volume and count. Track your performance against other liquidators on the protocol."
            highlight="cyan"
          />
          <FeatureCard
            icon={<TargetIcon />}
            title="At-Risk Positions"
            description="Live feed sorted by proximity to liquidation. See manager IDs, risk ratios, total debt, and estimated rewards at a glance."
            highlight="amber"
          />
          <FeatureCard
            icon={<PulseIcon />}
            title="Real-Time Updates"
            description="Auto-refreshing data pulled directly from the blockchain. Position health updates as prices move — never miss an opportunity."
            highlight="cyan"
          />
        </div>

        {/* Liquidations Preview */}
        <div className="mt-12 card-surface-elevated p-8 rounded-2xl border border-teal-400/20">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4 animate-pulse">
                <LiveIcon />
                Live Positions Available
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Track positions ready for liquidation
              </h3>
              <p className="text-white/60 mb-6">
                View real-time metrics including risk ratios, distance to liquidation, 
                total debt at risk, and estimated rewards — all before connecting your wallet.
              </p>
              <Link
                to="/pools"
                className="btn-primary inline-flex items-center gap-2"
              >
                Open Liquidations Center
                <ArrowRightIcon />
              </Link>
            </div>
            
            {/* Mini liquidation stats */}
            <div className="flex-shrink-0 w-full lg:w-80">
              <div className="grid grid-cols-2 gap-3">
                <MiniMetric 
                  label="Risk Distribution" 
                  icon={<MiniRiskBars />} 
                  color="amber"
                />
                <MiniMetric 
                  label="Price Simulator" 
                  icon={<MiniSlider />} 
                  color="cyan"
                />
                <MiniMetric 
                  label="History & Rewards" 
                  icon={<MiniClock />} 
                  color="amber"
                />
                <MiniMetric 
                  label="Leaderboard" 
                  icon={<MiniTrophy />} 
                  color="cyan"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight: "cyan" | "amber";
}

function FeatureCard({ icon, title, description, highlight }: FeatureCardProps) {
  const colorClasses = highlight === "cyan" 
    ? "bg-cyan-400/10 border-cyan-400/30 text-cyan-400"
    : "bg-teal-400/10 border-teal-400/30 text-teal-400";

  return (
    <div className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all hover:bg-white/[0.07] group">
      <div className={`w-12 h-12 rounded-xl ${colorClasses} border flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed">{description}</p>
    </div>
  );
}

function MiniMetric({ label, icon, color }: { label: string; icon: React.ReactNode; color: "cyan" | "amber" }) {
  const colorClass = color === "cyan" ? "text-cyan-400" : "text-teal-400";
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center gap-2">
      <div className={colorClass}>{icon}</div>
      <span className="text-xs text-white/60 text-center">{label}</span>
    </div>
  );
}

// Icons
function LightningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function RiskBarsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="14" width="4" height="7" rx="1" />
      <rect x="10" y="10" width="4" height="11" rx="1" />
      <rect x="17" y="6" width="4" height="15" rx="1" />
      <path d="M3 5l6-2 6 2 6-2" />
    </svg>
  );
}

function SimulatorIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function LiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function MiniRiskBars() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="14" width="3" height="6" rx="0.5" />
      <rect x="10" y="10" width="3" height="10" rx="0.5" />
      <rect x="16" y="6" width="3" height="14" rx="0.5" />
    </svg>
  );
}

function MiniSlider() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

function MiniClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function MiniTrophy() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      <path d="M12 15v4M8 22h8" />
    </svg>
  );
}
