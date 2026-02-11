import React from "react";
import { useAtRiskPositions, type AtRiskPosition } from "../../../hooks/useAtRiskPositions";
import { LiveRiskMonitor } from "./LiveRiskMonitor";
import { ProtocolProofSection } from "./ProtocolProofSection";
import { MarketOverview } from "./MarketOverview";
import { LiquidationHeatmap } from "./LiquidationHeatmap";
import { WalletDrawer } from "./WalletDrawer";
import { TransactionDetailsModal } from "../../../components/TransactionButton/TransactionDetailsModal";
import { CONTRACTS, type NetworkType } from "../../../config/contracts";
import { useSuiClientContext, useSuiClient, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { ScenarioProvider } from "../../../context/ScenarioContext";
import { buildLiquidateTransaction } from "../../../lib/suiTransactions";
import { TransactionToast, type TransactionToastState } from "../../../components/TransactionToast";
import { fetchLiquidations, type LiquidationEventResponse } from "../api/events";
import { LiveActivityFeed } from "./LiveActivityFeed";
import { getPositionDirection } from "../../../hooks/useAtRiskPositions";

/**
 * Liquidation Center — Spectator-first single-page scroll layout
 *
 * Redesign principles:
 * - Feel something in 3 seconds, not 30
 * - Hot positions with health bars are the hero
 * - Emotional read is immediate (danger meter, not buffer percentages)
 * - Analytical depth is one scroll deeper
 */

// ─── Section IDs for scroll nav ──────────────────────────────────────────────
const SECTIONS = [
  { id: 'market', label: 'Market' },
  { id: 'positions', label: 'Positions' },
  { id: 'risk', label: 'Risk Monitor' },
  { id: 'map', label: 'Liq Map' },
  { id: 'history', label: 'History' },
] as const;

function formatUsd(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatAddress(address: string): string {
  if (!address || address.length < 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function calculateNetProfit(position: AtRiskPosition): number {
  const grossReward = position.estimatedRewardUsd;
  const estimatedGasCost = 0.50;
  const estimatedSlippage = position.totalDebtUsd * 0.003;
  return grossReward - estimatedGasCost - estimatedSlippage;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return `${Math.floor(diff / 604_800_000)}w ago`;
}

export function LiquidationDashboard() {
  const { network } = useSuiClientContext();
  const suiClient = useSuiClient();
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const [selectedPosition, setSelectedPosition] = React.useState<AtRiskPosition | null>(null);
  const [showTxModal, setShowTxModal] = React.useState(false);

  // Global coin selector state
  const [selectedCoins, setSelectedCoins] = React.useState<string[]>([]);

  // Wallet drawer state
  const [drawerPosition, setDrawerPosition] = React.useState<AtRiskPosition | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const handleOpenWallet = React.useCallback((position: AtRiskPosition) => {
    setDrawerPosition(position);
    setIsDrawerOpen(true);
  }, []);

  const [isLiquidating, setIsLiquidating] = React.useState(false);
  const [liquidationError, setLiquidationError] = React.useState<string | null>(null);

  // Transaction toast state
  const [toastState, setToastState] = React.useState<TransactionToastState>("pending");
  const [toastVisible, setToastVisible] = React.useState(false);
  const [toastTxDigest, setToastTxDigest] = React.useState<string | undefined>();
  const [toastError, setToastError] = React.useState<string | null>(null);
  const [toastAmount, setToastAmount] = React.useState<string | undefined>();

  // Section scroll nav — active section tracking
  const [activeSection, setActiveSection] = React.useState<string>('market');

  // Last liquidation event
  const [lastLiquidation, setLastLiquidation] = React.useState<{ timestamp: number; amount: number } | null>(null);

  const contracts = network === 'mainnet' ? CONTRACTS.mainnet : CONTRACTS.testnet;

  // At-risk positions hook
  const {
    positions,
    liquidatableCount,
    atRiskCount,
    totalDebtAtRiskUsd,
    isLoading: positionsLoading,
    error: positionsError,
    refetch: refetchPositions,
    lastUpdated,
  } = useAtRiskPositions();

  // ─── Fetch last liquidation event ──────────────────────────────────────────
  React.useEffect(() => {
    async function fetchLastLiq() {
      try {
        const liqs = await fetchLiquidations({ limit: 1, start_time: 0 });
        if (liqs.length > 0) {
          const liq = liqs.sort((a: LiquidationEventResponse, b: LiquidationEventResponse) =>
            b.checkpoint_timestamp_ms - a.checkpoint_timestamp_ms
          )[0];
          setLastLiquidation({
            timestamp: liq.checkpoint_timestamp_ms,
            amount: parseFloat(liq.liquidation_amount) / 1e9,
          });
        }
      } catch {
        // silently fail — this is supplementary data
      }
    }
    fetchLastLiq();
  }, []);

  // ─── Intersection observer for scroll nav ─────────────────────────────────
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // ─── Discover available base assets ────────────────────────────────────────
  const availableCoins = React.useMemo(() => {
    const coins = new Set<string>();
    positions.forEach(p => {
      if (p.baseAssetSymbol && p.totalDebtUsd > 0.001) {
        coins.add(p.baseAssetSymbol);
      }
    });
    return Array.from(coins).sort();
  }, [positions]);

  // ─── Filter positions by selected coins ────────────────────────────────────
  const filteredPositions = React.useMemo(() => {
    if (selectedCoins.length === 0) return positions; // all coins
    return positions.filter(p => selectedCoins.includes(p.baseAssetSymbol));
  }, [positions, selectedCoins]);

  // ─── Coin selector helpers ─────────────────────────────────────────────────
  const toggleCoin = React.useCallback((coin: string) => {
    setSelectedCoins(prev => {
      if (prev.includes(coin)) {
        return prev.filter(c => c !== coin);
      } else {
        return [...prev, coin];
      }
    });
  }, []);

  const selectAllCoins = React.useCallback(() => {
    setSelectedCoins([]);
  }, []);

  // ─── Danger Metrics ────────────────────────────────────────────────────────
  const dangerMetrics = React.useMemo(() => {
    const liquidatable = filteredPositions.filter(p => p.isLiquidatable);
    const critical = filteredPositions.filter(p => !p.isLiquidatable && p.distanceToLiquidation < 10);
    const watching = filteredPositions.filter(p => !p.isLiquidatable && p.distanceToLiquidation >= 10 && p.distanceToLiquidation < 25);

    const inDanger = liquidatable.length + critical.length;
    const totalDebtInDanger = [...liquidatable, ...critical].reduce((s, p) => s + p.totalDebtUsd, 0);

    return {
      inDanger,
      totalDebtInDanger,
      liquidatableCount: liquidatable.length,
      criticalCount: critical.length,
      watchingCount: watching.length,
      totalPositions: filteredPositions.length,
    };
  }, [filteredPositions]);

  // System status
  const systemStatus = dangerMetrics.liquidatableCount > 0
    ? 'critical'
    : dangerMetrics.criticalCount > 0
      ? 'stressed'
      : 'healthy';

  // ─── Dynamic Narrative One-Liner ──────────────────────────────────────────
  const narrativeLine = React.useMemo(() => {
    if (filteredPositions.length === 0) return null;

    // Compute positioning for narrative
    let longCount = 0;
    let shortCount = 0;
    filteredPositions.forEach(p => {
      const { direction } = getPositionDirection(p);
      if (direction === 'LONG') longCount++;
      else shortCount++;
    });
    const total = longCount + shortCount;
    const longPct = total > 0 ? Math.round((longCount / total) * 100) : 50;
    const isCrowded = longPct > 70 || longPct < 30;
    const crowdedSide = longPct > 50 ? 'long' : 'short';

    const parts: string[] = [];

    // Crowdedness
    if (isCrowded) {
      parts.push(`${Math.max(longPct, 100 - longPct)}% ${crowdedSide}`);
    } else {
      parts.push('balanced positioning');
    }

    // Danger
    if (dangerMetrics.liquidatableCount > 0) {
      parts.push(`${dangerMetrics.liquidatableCount} liquidatable now`);
    } else if (dangerMetrics.inDanger > 0) {
      parts.push(`${dangerMetrics.inDanger} in danger`);
    } else {
      parts.push('all positions safe');
    }

    // Recency
    if (lastLiquidation) {
      parts.push(`last rekt ${timeAgo(lastLiquidation.timestamp)}`);
    }

    return parts.join(' · ');
  }, [filteredPositions, dangerMetrics, lastLiquidation]);

  const handleLiquidate = (position: AtRiskPosition) => {
    setSelectedPosition(position);
    setShowTxModal(true);
    setLiquidationError(null);
  };

  const executeLiquidation = React.useCallback(async () => {
    if (!selectedPosition || !account) {
      setLiquidationError("No position selected or wallet not connected");
      return;
    }

    setIsLiquidating(true);
    setLiquidationError(null);

    // Show pending toast immediately
    setToastState("pending");
    setToastVisible(true);
    setToastTxDigest(undefined);
    setToastError(null);

    try {
      const hasQuoteDebt = selectedPosition.quoteDebt > 0;
      const decimals = hasQuoteDebt ? 6 : 9;
      const debtAmount = hasQuoteDebt ? selectedPosition.quoteDebt : selectedPosition.baseDebt;
      const repayAmount = BigInt(Math.ceil(debtAmount * Math.pow(10, decimals)));

      const tx = await buildLiquidateTransaction({
        position: selectedPosition,
        repayAmount,
        owner: account.address,
        network: network as NetworkType,
        suiClient,
      });

      const result = await signAndExecute({
        transaction: tx,
        chain: `sui:${network}`
      });

      const txResult = await suiClient.waitForTransaction({
        digest: result.digest,
        options: { showEffects: true },
      });

      const status = txResult.effects?.status?.status;
      if (status === 'failure') {
        const error = txResult.effects?.status?.error || 'Transaction failed';
        throw new Error(error);
      }

      setShowTxModal(false);
      setSelectedPosition(null);
      refetchPositions();

      setToastState("finalized");
      setToastTxDigest(result.digest);
      setToastAmount(formatUsd(selectedPosition.totalDebtUsd));

      console.log(`Liquidation successful! TX: ${result.digest}`);
    } catch (error: any) {
      console.error("Liquidation failed:", error);

      let errorMessage = error.message || "Liquidation failed";

      if (errorMessage.includes('MoveAbort') && errorMessage.includes('9')) {
        errorMessage = "Position is no longer liquidatable. The price may have moved or another liquidator got there first.";
      } else if (errorMessage.includes('MoveAbort') && errorMessage.includes('13')) {
        errorMessage = "Repay amount too low. Try with a larger amount.";
      } else if (errorMessage.includes('InsufficientGas')) {
        errorMessage = "Insufficient gas. Make sure you have enough SUI for transaction fees.";
      } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        errorMessage = "Transaction was rejected by wallet.";
      }

      setLiquidationError(errorMessage);

      setToastState("error");
      setToastError(errorMessage);
    } finally {
      setIsLiquidating(false);
    }
  }, [selectedPosition, account, network, suiClient, signAndExecute, refetchPositions]);

  const transactionInfo = selectedPosition ? {
    action: 'Attempt Liquidation',
    packageId: contracts.MARGIN_PACKAGE_ID,
    module: 'margin_manager',
    function: 'liquidate',
    summary: `Attempt to liquidate position with ${formatUsd(selectedPosition.totalDebtUsd)} debt. Est. profit: ${formatUsd(calculateNetProfit(selectedPosition))}. ⚠️ May fail if price moves.`,
    sourceCodeUrl: `https://suivision.xyz/package/${contracts.MARGIN_PACKAGE_ID}`,
    arguments: [
      { name: 'Position', value: formatAddress(selectedPosition.marginManagerId) },
      { name: 'Health', value: selectedPosition.riskRatio.toFixed(4) },
      { name: 'Debt', value: formatUsd(selectedPosition.totalDebtUsd) },
      { name: 'Est. Net Profit', value: formatUsd(calculateNetProfit(selectedPosition)) },
    ],
  } : null;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <ScenarioProvider>
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ═══════════════════════════════════════════════════════════════════
          PAGE HEADER — Title + Coin Selector (accented)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Liquidation Center</h1>
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
            systemStatus === 'healthy'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
              : systemStatus === 'stressed'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-400/30 animate-pulse'
          }`}>
            {systemStatus === 'healthy' ? 'Healthy' : systemStatus === 'stressed' ? 'Stressed' : 'Critical'}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* ── Accented Coin Selector ─────────────────────────────── */}
          {availableCoins.length > 1 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-500/[0.08] border border-teal-400/20 shadow-[0_0_12px_-4px_rgba(45,212,191,0.15)]">
              <span className="text-[10px] text-teal-400/70 uppercase tracking-wider font-semibold">Assets</span>
              <div className="flex gap-0.5">
                <button
                  onClick={selectAllCoins}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    selectedCoins.length === 0
                      ? 'bg-teal-400 text-slate-900 shadow-sm'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]'
                  }`}
                >
                  All
                </button>
                {availableCoins.map(coin => (
                  <button
                    key={coin}
                    onClick={() => toggleCoin(coin)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                      selectedCoins.includes(coin)
                        ? 'bg-teal-400 text-slate-900 shadow-sm'
                        : selectedCoins.length === 0
                          ? 'text-teal-300/60 hover:text-teal-300 hover:bg-teal-500/10'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
                    }`}
                  >
                    {coin}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live indicator + refresh */}
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] text-white/30">
                {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70 bg-emerald-500/[0.06] px-2 py-1 rounded-full border border-emerald-500/10">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              Live
            </span>
            <button
              onClick={refetchPositions}
              disabled={positionsLoading}
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg
                className={`w-3.5 h-3.5 text-white/40 ${positionsLoading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          NARRATIVE ONE-LINER — Instant vibe read
      ═══════════════════════════════════════════════════════════════════ */}
      {narrativeLine && (
        <div className="text-sm text-white/40 -mt-2 mb-1 pl-0.5 tracking-wide">
          <span className={`${
            systemStatus === 'critical' ? 'text-rose-300/70' :
            systemStatus === 'stressed' ? 'text-amber-300/60' :
            'text-white/30'
          }`}>
            {narrativeLine}
          </span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          HERO STATS — Two things a spectator cares about
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Positions in Danger */}
        <div className={`rounded-xl p-5 border transition-all ${
          dangerMetrics.inDanger > 0
            ? 'bg-gradient-to-br from-rose-500/[0.08] to-amber-500/[0.04] border-rose-500/20'
            : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {dangerMetrics.inDanger > 0 && (
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                )}
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">
                  {dangerMetrics.inDanger > 0 ? 'Positions in Danger' : 'All Positions Safe'}
                </span>
              </div>
              <div className={`text-4xl font-bold tabular-nums leading-none ${
                dangerMetrics.inDanger > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {positionsLoading && dangerMetrics.totalPositions === 0 ? (
                  <div className="h-10 w-8 bg-white/10 rounded animate-pulse" />
                ) : dangerMetrics.inDanger > 0 ? (
                  dangerMetrics.inDanger
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                )}
              </div>
              {dangerMetrics.inDanger > 0 && (
                <div className="text-xs text-white/40 mt-1.5">
                  {dangerMetrics.liquidatableCount > 0 && (
                    <span className="text-rose-300">{dangerMetrics.liquidatableCount} liquidatable</span>
                  )}
                  {dangerMetrics.liquidatableCount > 0 && dangerMetrics.criticalCount > 0 && ' · '}
                  {dangerMetrics.criticalCount > 0 && (
                    <span className="text-amber-300">{dangerMetrics.criticalCount} critical</span>
                  )}
                  {dangerMetrics.totalDebtInDanger > 0 && (
                    <span className="text-white/30"> · {formatUsd(dangerMetrics.totalDebtInDanger)} at risk</span>
                  )}
                </div>
              )}
              {dangerMetrics.inDanger === 0 && (
                <div className="text-xs text-white/30 mt-1.5">
                  {dangerMetrics.totalPositions} positions monitored
                  {dangerMetrics.watchingCount > 0 && ` · ${dangerMetrics.watchingCount} on watch`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Last Rekt */}
        <div className="bg-white/[0.03] rounded-xl p-5 border border-white/[0.06]">
          <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1">
            Last Liquidation
          </div>
          {lastLiquidation ? (
            <div>
              <div className="text-2xl font-bold text-white tabular-nums leading-none">
                {timeAgo(lastLiquidation.timestamp)}
              </div>
              <div className="text-xs text-white/40 mt-1.5">
                <span className="text-rose-300">{formatUsd(lastLiquidation.amount)}</span> rekt
              </div>
            </div>
          ) : (
            <div>
              <div className="text-2xl font-bold text-white/20 leading-none">—</div>
              <div className="text-xs text-white/30 mt-1.5">No recent liquidations</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LIVE ACTIVITY FEED — Recent margin events
      ═══════════════════════════════════════════════════════════════════ */}
      <LiveActivityFeed positions={filteredPositions} />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION NAV — Sticky pill navigation
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-[56px] z-30 -mx-4 px-4 py-2" style={{ background: 'rgba(13,26,31,0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.05] w-fit">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all ${
                activeSection === id
                  ? 'bg-teal-500/20 text-teal-300 shadow-sm'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ERROR STATE
      ═══════════════════════════════════════════════════════════════════ */}
      {positionsError && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center">
          <p className="text-rose-400">
            Error loading positions: {positionsError.message}
          </p>
          <button
            onClick={refetchPositions}
            className="mt-3 px-4 py-2 text-sm bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: MARKET — Net Positioning + Gravity + Hot Positions
      ═══════════════════════════════════════════════════════════════════ */}
      <div id="market" className="scroll-mt-[120px]">
        <MarketOverview
          positions={filteredPositions}
          isLoading={positionsLoading}
          onOpenWallet={handleOpenWallet}
          selectedCoins={selectedCoins}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PROFIT OPPORTUNITY BANNER
      ═══════════════════════════════════════════════════════════════════ */}
      {dangerMetrics.liquidatableCount > 0 && (
        <div className="bg-gradient-to-r from-orange-500/15 to-orange-500/5 rounded-xl border border-orange-500/30 p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-orange-200">
                  {dangerMetrics.liquidatableCount} Position{dangerMetrics.liquidatableCount > 1 ? 's' : ''} Ready to Liquidate
                </h3>
                <p className="text-sm text-white/60">
                  Total debt: {formatUsd(dangerMetrics.totalDebtInDanger)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: POSITIONS — Positioned here as anchor but content
          is inside MarketOverview (hot positions are the hero there)
      ═══════════════════════════════════════════════════════════════════ */}
      <div id="positions" className="scroll-mt-[120px]" />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: RISK MONITOR
      ═══════════════════════════════════════════════════════════════════ */}
      {!positionsError && (
        <div id="risk" className="scroll-mt-[120px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-cyan-400 to-cyan-600" />
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              Risk Monitor
            </h2>
            <span className="text-[10px] text-white/20">Analyst view · Stress testing</span>
          </div>
          <LiveRiskMonitor
            positions={filteredPositions}
            isLoading={positionsLoading}
            onLiquidate={handleLiquidate}
            onOpenWallet={handleOpenWallet}
            lastUpdated={lastUpdated}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: LIQUIDATION MAP
      ═══════════════════════════════════════════════════════════════════ */}
      <div id="map" className="scroll-mt-[120px]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-violet-600" />
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            Liquidation Map
          </h2>
        </div>
        <LiquidationHeatmap
          positions={filteredPositions}
          isLoading={positionsLoading}
          selectedCoins={selectedCoins}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION: HISTORY
      ═══════════════════════════════════════════════════════════════════ */}
      <div id="history" className="scroll-mt-[120px]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" />
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            Protocol History
          </h2>
          <span className="text-[10px] text-white/20">Analytics · Research</span>
        </div>
        <ProtocolProofSection />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS & OVERLAYS
      ═══════════════════════════════════════════════════════════════════ */}

      {/* Transaction Modal */}
      {transactionInfo && (
        <TransactionDetailsModal
          isOpen={showTxModal}
          onClose={() => {
            setShowTxModal(false);
            setSelectedPosition(null);
            setLiquidationError(null);
          }}
          onContinue={executeLiquidation}
          transactionInfo={{
            ...transactionInfo,
            summary: liquidationError
              ? `Error: ${liquidationError}`
              : isLiquidating
                ? "Updating oracle prices & executing liquidation..."
                : transactionInfo.summary,
          }}
          disabled={!selectedPosition?.isLiquidatable || isLiquidating || !account}
        />
      )}

      {/* Transaction Toast */}
      <TransactionToast
        isVisible={toastVisible}
        onDismiss={() => setToastVisible(false)}
        state={toastState}
        actionType="liquidate"
        amount={toastAmount}
        asset="debt"
        poolName="Position liquidated"
        txDigest={toastTxDigest}
        explorerUrl={`https://suivision.xyz`}
        error={toastError}
      />

      {/* Wallet Detail Drawer */}
      <WalletDrawer
        position={drawerPosition}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
    </ScenarioProvider>
  );
}
