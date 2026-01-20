import React from "react";

export function HowItWorksPanel() {
  return (
    <div className="surface-elevated p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2dd4bf]/20 to-cyan-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-[#2dd4bf]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">How DeepBook Margin Works</h2>
          <p className="text-xs text-white/50">Earn yield by supplying liquidity</p>
        </div>
      </div>

      {/* Flow Steps */}
      <div className="space-y-3">
        {/* Step 1 */}
        <div className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-[#2dd4bf]/20 flex items-center justify-center text-[#2dd4bf] font-bold border border-[#2dd4bf]/30 text-[10px]">
              1
            </div>
            <div className="flex-1 w-px bg-gradient-to-b from-[#2dd4bf]/30 to-transparent my-1" />
          </div>
          <div className="flex-1 pb-1">
            <h3 className="font-semibold text-white mb-0.5 text-xs">Supply Assets</h3>
            <p className="text-[10px] text-white/60 leading-relaxed">
              Deposit tokens to provide liquidity for margin traders. Assets are held in a secure smart contract vault.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold border border-violet-500/30 text-[10px]">
              2
            </div>
            <div className="flex-1 w-px bg-gradient-to-b from-violet-500/30 to-transparent my-1" />
          </div>
          <div className="flex-1 pb-1">
            <h3 className="font-semibold text-white mb-0.5 text-xs">Traders Borrow & Trade</h3>
            <p className="text-[10px] text-white/60 leading-relaxed">
              Margin traders borrow your assets for leveraged positions. They pay interest which accrues to the pool.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/30 text-[10px]">
              3
            </div>
            <div className="flex-1 w-px bg-gradient-to-b from-emerald-500/30 to-transparent my-1" />
          </div>
          <div className="flex-1 pb-1">
            <h3 className="font-semibold text-white mb-0.5 text-xs">Earn Variable APY</h3>
            <p className="text-[10px] text-white/60 leading-relaxed">
              Your share of the pool grows from interest. APY increases with pool utilization.
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold border border-amber-500/30 text-[10px]">
              4
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-0.5 text-xs">Withdraw Anytime</h3>
            <p className="text-[10px] text-white/60 leading-relaxed">
              No lockup period. Instant when liquidity is available.
            </p>
          </div>
        </div>
      </div>

      {/* Risk Section */}
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <h3 className="font-semibold text-amber-400 mb-2 flex items-center gap-1.5 text-xs">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Understand the Risks
        </h3>
        <div className="space-y-2">
          <div className="p-2 rounded bg-black/20 border border-amber-500/10">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-white text-[10px] mb-0.5">Liquidity Risk</h4>
                <p className="text-[9px] text-white/50 leading-relaxed">
                  High utilization may require waiting for borrowers to repay.
                </p>
              </div>
            </div>
          </div>

          <div className="p-2 rounded bg-black/20 border border-red-500/10">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-white text-[10px] mb-0.5">Bad Debt Risk</h4>
                <p className="text-[9px] text-white/50 leading-relaxed">
                  Shortfall from insolvent positions is shared across suppliers.
                </p>
              </div>
            </div>
          </div>

          <div className="p-2 rounded bg-black/20 border border-white/[0.06]">
            <div className="flex items-start gap-2">
              <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
                <svg className="w-2.5 h-2.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-white text-[10px] mb-0.5">Smart Contract Risk</h4>
                <p className="text-[9px] text-white/50 leading-relaxed">
                  Audited contracts, but DeFi carries inherent risks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Facts */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <div className="text-[8px] text-white/40 uppercase tracking-wider mb-0.5">No Lockup</div>
          <div className="text-[10px] font-medium text-white">Anytime</div>
        </div>
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <div className="text-[8px] text-white/40 uppercase tracking-wider mb-0.5">Yield</div>
          <div className="text-[10px] font-medium text-white">Variable</div>
        </div>
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <div className="text-[8px] text-white/40 uppercase tracking-wider mb-0.5">Protocol</div>
          <div className="text-[10px] font-medium text-white">DeepBook</div>
        </div>
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <div className="text-[8px] text-white/40 uppercase tracking-wider mb-0.5">Network</div>
          <div className="text-[10px] font-medium text-white">Sui</div>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-[9px] text-white/30 text-center pt-2 border-t border-white/[0.06]">
        DeepBook is the native order book on Sui. Margin pools power leveraged trading.
      </p>
    </div>
  );
}

export default HowItWorksPanel;
