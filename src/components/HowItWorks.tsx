import React from "react";

export function HowItWorks() {
  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-6">
          How it works
        </h2>
        
        <p className="text-lg text-white/80 text-center max-w-2xl mx-auto mb-12">
          You deposit assets into a margin pool. Traders borrow your assets 
          to make leveraged trades on DeepBook. They pay interest on what they borrow, 
          and that interest goes directly to you. No fixed lockup — withdrawals 
          depend on available pool liquidity.
        </p>

        {/* Flow Diagram */}
        <div className="relative">
          {/* Desktop Flow - Horizontal */}
          <div className="hidden md:flex items-center justify-between gap-2">
            <FlowStep 
              number="1" 
              title="You Deposit" 
              description="Add assets to the pool"
              icon={<DepositIcon />}
            />
            <FlowArrow />
            <FlowStep 
              number="2" 
              title="Pool Grows" 
              description="Your assets join the liquidity pool"
              icon={<PoolIcon />}
            />
            <FlowArrow />
            <FlowStep 
              number="3" 
              title="Traders Borrow" 
              description="They pay interest on borrowed funds"
              icon={<TraderIcon />}
            />
            <FlowArrow />
            <FlowStep 
              number="4" 
              title="You Earn" 
              description="Interest flows back to you"
              icon={<EarnIcon />}
            />
          </div>

          {/* Mobile Flow - Vertical */}
          <div className="md:hidden flex flex-col gap-4">
            <FlowStep 
              number="1" 
              title="You Deposit" 
              description="Add assets to the pool"
              icon={<DepositIcon />}
              horizontal
            />
            <FlowArrowVertical />
            <FlowStep 
              number="2" 
              title="Pool Grows" 
              description="Your assets join the liquidity pool"
              icon={<PoolIcon />}
              horizontal
            />
            <FlowArrowVertical />
            <FlowStep 
              number="3" 
              title="Traders Borrow" 
              description="They pay interest on borrowed funds"
              icon={<TraderIcon />}
              horizontal
            />
            <FlowArrowVertical />
            <FlowStep 
              number="4" 
              title="You Earn" 
              description="Interest flows back to you"
              icon={<EarnIcon />}
              horizontal
            />
          </div>
        </div>

        {/* Withdraw callout */}
        <div className="mt-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm">
            <WithdrawIcon />
            No fixed lockup — withdrawals subject to pool liquidity
          </span>
        </div>
      </div>
    </section>
  );
}

interface FlowStepProps {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  horizontal?: boolean;
}

function FlowStep({ number, title, description, icon, horizontal }: FlowStepProps) {
  if (horizontal) {
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-400/10 border border-teal-400/30 flex items-center justify-center text-teal-400">
          {icon}
        </div>
        <div>
          <div className="text-sm text-teal-400 font-medium">Step {number}</div>
          <div className="text-white font-semibold">{title}</div>
          <div className="text-white/60 text-sm">{description}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 text-center p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-teal-400/10 border border-teal-400/30 flex items-center justify-center text-teal-400">
        {icon}
      </div>
      <div className="text-xs text-teal-400 font-medium mb-1">Step {number}</div>
      <div className="text-white font-semibold mb-1">{title}</div>
      <div className="text-white/60 text-sm">{description}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex-shrink-0 text-cyan-400/50">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function FlowArrowVertical() {
  return (
    <div className="flex justify-center text-cyan-400/50">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    </div>
  );
}

// Simple icons
function DepositIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M5 10l7 7 7-7" />
      <path d="M5 21h14" />
    </svg>
  );
}

function PoolIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function TraderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l7 7M21 3l-7 7M3 21l7-7M21 21l-7-7" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EarnIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function WithdrawIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21V9M5 14l7-7 7 7" />
      <path d="M5 3h14" />
    </svg>
  );
}






