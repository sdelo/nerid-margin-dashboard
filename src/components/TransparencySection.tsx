import React from "react";

export function TransparencySection() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Built for transparency
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Nerid is a web3-native dashboard. Verify everything before you sign.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left side - Feature bullets */}
          <div className="space-y-4">
            <TransparencyFeature
              icon={<CodeIcon />}
              title="Preview exact contract calls"
              description="See the Move function that will be executed before you confirm any transaction."
            />
            <TransparencyFeature
              icon={<ExplorerIcon />}
              title="Verify source code on-chain"
              description="Direct links to the block explorer so you can inspect the actual smart contract code."
            />
            <TransparencyFeature
              icon={<ShieldIcon />}
              title="Understand wallet permissions"
              description="Clear breakdown of what you're approving — no hidden capabilities."
            />
            <TransparencyFeature
              icon={<ChainIcon />}
              title="On-chain data sources"
              description="All metrics pulled directly from blockchain events. No off-chain black boxes."
            />
          </div>

          {/* Right side - Verification flow visual */}
          <div className="card-surface p-6">
            <div className="text-sm font-medium text-white/60 mb-4">Verification Flow</div>
            
            <div className="space-y-3">
              <FlowItem 
                step="1"
                from="Dashboard"
                action="Click action button"
                highlight={false}
              />
              <FlowConnector />
              <FlowItem 
                step="2"
                from="Transaction Preview"
                action="Review contract method & parameters"
                highlight={true}
              />
              <FlowConnector />
              <FlowItem 
                step="3"
                from="Block Explorer"
                action="Verify Move source code"
                highlight={true}
              />
              <FlowConnector />
              <FlowItem 
                step="4"
                from="Wallet"
                action="Confirm matching transaction"
                highlight={false}
              />
              <FlowConnector />
              <FlowItem 
                step="5"
                from="Blockchain"
                action="Transaction executed on-chain"
                highlight={false}
              />
            </div>

            <div className="mt-6 p-3 rounded-lg bg-cyan-400/5 border border-cyan-400/20">
              <div className="flex items-start gap-2">
                <CheckIcon className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-white/70">
                  Every step is verifiable. What you see in the dashboard matches what 
                  the wallet requests matches what executes on-chain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface TransparencyFeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function TransparencyFeature({ icon, title, description }: TransparencyFeatureProps) {
  return (
    <div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-cyan-400/10 flex items-center justify-center text-cyan-400">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-white/60">{description}</p>
      </div>
    </div>
  );
}

interface FlowItemProps {
  step: string;
  from: string;
  action: string;
  highlight: boolean;
}

function FlowItem({ step, from, action, highlight }: FlowItemProps) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${highlight ? 'bg-teal-400/10 border border-teal-400/30' : 'bg-white/5'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${highlight ? 'bg-teal-400 text-[#0c1a24]' : 'bg-white/20 text-white'}`}>
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${highlight ? 'text-teal-400' : 'text-white/80'}`}>{from}</div>
        <div className="text-xs text-white/50 truncate">{action}</div>
      </div>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flex justify-start pl-6">
      <div className="w-px h-4 bg-white/20" />
    </div>
  );
}

// Icons
function CodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}

function ExplorerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function ChainIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}






