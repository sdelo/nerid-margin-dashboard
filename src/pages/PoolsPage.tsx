import React from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import NavBar from "../features/shared/components/NavBar";
import PoolCompareTable from "../features/lending/components/PoolCompareTable";
import StickyContextStrip from "../features/lending/components/StickyContextStrip";
import PoolSwitchToast from "../features/lending/components/PoolSwitchToast";
import PortfolioCard from "../features/lending/components/PortfolioCard";
import ActionPanel from "../features/lending/components/ActionPanel";
import { PoolAnalytics, ANALYTICS_SECTIONS, type ScrollCommand } from "../features/lending/components/PoolAnalytics";
import { SectionChips } from "../components/SectionChips";
import SlidePanel from "../features/shared/components/SlidePanel";
import DepositHistory from "../features/lending/components/DepositHistory";
import { LiquidationDashboard } from "../features/lending/components/LiquidationDashboard";
import { AdminHistorySlidePanel } from "../features/lending/components/AdminHistorySlidePanel";
import { InterestRateHistoryPanel } from "../features/lending/components/InterestRateHistoryPanel";
import { DeepbookPoolHistoryPanel } from "../features/lending/components/DeepbookPoolHistoryPanel";
import { HowItWorksPanel } from "../features/lending/components/HowItWorksPanel";
import { TransactionToast } from "../components/TransactionToast";
import {
  SectionNav,
  type DashboardSection,
} from "../features/shared/components/SectionNav";
import { RailDivider } from "../features/shared/components/RailDivider";
import { useCoinBalance } from "../hooks/useCoinBalance";
import { useAllPools } from "../hooks/useAllPools";
import { useAppNetwork } from "../context/AppNetworkContext";
import { Footer } from "../components/Footer";
import { useStickyHeader } from "../context/StickyHeaderContext";
import { usePoolActivityMetrics } from "../features/lending/hooks/usePoolActivityMetrics";
import { useProtocolTopline } from "../hooks/useProtocolTopline";
import { InfoTooltip } from "../components/InfoTooltip";

// ── Extracted hooks ────────────────────────────────────────────────────
import { useTransactionToast } from "../hooks/useTransactionToast";
import { useTransactionFlow } from "../hooks/useTransactionFlow";
import { usePoolSelection } from "../hooks/usePoolSelection";
import { usePoolsUrlState } from "../hooks/usePoolsUrlState";

export function PoolsPage() {
  const account = useCurrentAccount();
  const { explorerUrl } = useAppNetwork();

  // ── Section nav (hidden for now) ───────────────────────────────────
  const [selectedSection, setSelectedSection] =
    React.useState<DashboardSection>("pools");

  // ── Pool data ──────────────────────────────────────────────────────
  const { pools, userPositions, isLoading, error: poolsError, refetch: refetchPools } =
    useAllPools(account?.address);

  // ── URL state (pool + section synced to ?pool=SUI&section=risk) ─
  const {
    urlPoolId,
    urlSection,
    setUrlPool,
    setUrlSection,
  } = usePoolsUrlState(pools);

  // ── Pool selection ─────────────────────────────────────────────────
  const {
    selectedPoolId,
    selectedPool,
    selectedPoolDepositedBalance,
    pendingDepositAmount,
    setPendingDepositAmount,
    handlePoolSelect: rawHandlePoolSelect,
    poolSwitchToast,
  } = usePoolSelection(pools, userPositions, urlPoolId);

  // Wrap pool selection to also update URL
  const handlePoolSelect = React.useCallback(
    (poolId: string) => {
      rawHandlePoolSelect(poolId);
      const pool = pools.find((p) => p.id === poolId);
      if (pool) {
        setUrlPool(pool);
      }
    },
    [rawHandlePoolSelect, pools, setUrlPool]
  );

  // ── Right rail collapse ────────────────────────────────────────────
  const [isRailCollapsed, setIsRailCollapsed] = React.useState(false);

  // ── How It Works slide panel ─────────────────────────────────────
  const [howItWorksOpen, setHowItWorksOpen] = React.useState(false);

  // ── Sticky header context ──────────────────────────────────────────
  const { navbarHeight, setContextStripHeight } = useStickyHeader();
  const contextStripRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = contextStripRef.current;
    if (!element) return;

    const updateHeight = () => {
      const height = element.getBoundingClientRect().height;
      setContextStripHeight(height);
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(element);
    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [setContextStripHeight]);

  // ── Section chips state ──────────────────────────────────────────────
  const [activeSection, setActiveSection] = React.useState<string>(urlSection || "health");
  const [scrollCommand, setScrollCommand] = React.useState<ScrollCommand | null>(
    urlSection ? { id: urlSection, n: 0 } : null,
  );

  // When chip is clicked → update active + tell PoolAnalytics to scroll
  const handleChipClick = React.useCallback(
    (sectionId: string) => {
      setActiveSection(sectionId);
      setScrollCommand((prev) => ({ id: sectionId, n: (prev?.n ?? 0) + 1 }));
      setUrlSection(sectionId);
    },
    [setUrlSection],
  );

  // Scrollspy callback from PoolAnalytics
  const handleActiveSectionChange = React.useCallback(
    (sectionId: string) => {
      setActiveSection(sectionId);
    },
    [],
  );

  // ── Protocol metrics ───────────────────────────────────────────────
  const { metrics: poolActivityMetrics } = usePoolActivityMetrics(pools);
  const protocolTopline = useProtocolTopline(pools, poolActivityMetrics);

  const protocolMetrics = React.useMemo(() => {
    if (pools.length === 0) return null;
    return {
      tvl: protocolTopline.tvlUsd,
      borrowed: protocolTopline.borrowedUsd,
      utilization: protocolTopline.utilization,
      flow7d: protocolTopline.flow7dUsd,
      referralRevenueUsd: protocolTopline.totalReferralFeesUsd,
    };
  }, [pools.length, protocolTopline]);

  // ── User supplier cap IDs (for history panel) ─────────────────────
  const userSupplierCapIds: string[] = React.useMemo(() => {
    const capIds = new Set(
      userPositions
        .map((pos) => pos.supplierCapId)
        .filter((id): id is string => !!id)
    );
    return Array.from(capIds);
  }, [userPositions]);

  // ── Balances ───────────────────────────────────────────────────────
  const coinBalance = useCoinBalance(
    account?.address,
    selectedPool?.contracts?.coinType || "",
    selectedPool?.contracts?.coinDecimals || 9
  );
  const suiBalance = useCoinBalance(account?.address, "0x2::sui::SUI", 9);

  // ── Transaction toast + flow ───────────────────────────────────────
  const toast = useTransactionToast();
  const {
    txStatus,
    txError,
    handleDeposit,
    handleWithdraw,
    handleWithdrawAll,
    resetTxStatus,
  } = useTransactionFlow({
    selectedPool,
    coinBalance,
    suiBalance,
    refetchPools,
    toast,
  });

  // Clear pending deposit amount on successful tx
  React.useEffect(() => {
    if (txStatus === "success") {
      setPendingDepositAmount("");
    }
  }, [txStatus, setPendingDepositAmount]);

  // ── Slide panels ───────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [adminHistoryOpen, setAdminHistoryOpen] = React.useState(false);
  const [adminHistoryPoolId, setAdminHistoryPoolId] = React.useState<string | null>(null);
  const [deepbookPoolHistoryOpen, setDeepbookPoolHistoryOpen] = React.useState(false);
  const [deepbookPoolHistoryPoolId, setDeepbookPoolHistoryPoolId] = React.useState<string | null>(null);
  const [interestRateHistoryOpen, setInterestRateHistoryOpen] = React.useState(false);
  const [interestRateHistoryPoolId, setInterestRateHistoryPoolId] = React.useState<string | null>(null);

  const hasError = poolsError;


  return (
    <div className="min-h-screen text-white">
      {/* Section Navigation - Hidden for now */}
      <div className="hidden">
        <SectionNav selectedSection={selectedSection} onSelectSection={setSelectedSection} />
      </div>

      {/* Pools Section */}
      {selectedSection === "pools" && (
        <>
          {/* ═══════════════════════════════════════════════════════════════════
              STICKY HEADER: Nav only
              ═══════════════════════════════════════════════════════════════════ */}
          <header className="sticky-stack">
            <NavBar />
          </header>

          {/* Status Messages */}
          {(isLoading || hasError) && (
            <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-3">
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <div className="w-2 h-2 rounded-full bg-[#2dd4bf] animate-pulse" />
                  Loading pool data...
                </div>
              )}
              {hasError && (
                <div className="text-sm text-red-400">Error: {poolsError?.message}</div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              MAIN CONTENT: Unified layout with sticky headers
              ═══════════════════════════════════════════════════════════════════ */}
          <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 pb-16 overflow-visible">
            {selectedPool ? (
              <div
                className={`grid transition-all duration-300 overflow-visible ${
                  isRailCollapsed
                    ? "gap-0 grid-cols-1 lg:grid-cols-[1fr_auto]"
                    : "gap-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_400px]"
                }`}
              >
                {/* ═══════════════════════════════════════════════════════════
                    LEFT COLUMN: All main content
                    ═══════════════════════════════════════════════════════════ */}
                <div className="min-w-0 space-y-6 overflow-visible">
                  {/* Pool Selection + Quick Compare */}
                  <div className="surface-elevated p-4">
                    {/* Step Indicator + Header + Protocol Topline */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-semibold text-[#2dd4bf] bg-[#2dd4bf]/10 px-2 py-1 rounded-full uppercase tracking-wider">
                          Step 1 of 2
                        </span>
                        <div>
                          <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Choose Asset</span>
                          <p className="text-xs text-white/50 mt-0.5">Pick a market to supply liquidity</p>
                        </div>
                      </div>

                      {/* Protocol Topline Metrics */}
                      {protocolMetrics && (
                        <div className="hidden sm:flex items-center gap-6 bg-white/[0.02] rounded-xl px-5 py-3 border border-white/[0.06]">
                          <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Protocol Topline</span>
                          <div className="flex items-center gap-6">
                            <div className="text-center min-w-[60px]">
                              <span className="text-[10px] text-white/40 uppercase tracking-wider block mb-0.5">TVL</span>
                              <span className="text-base font-semibold text-white tabular-nums">
                                ${protocolMetrics.tvl >= 1_000_000
                                  ? (protocolMetrics.tvl / 1_000_000).toFixed(1) + "M"
                                  : protocolMetrics.tvl >= 1_000
                                    ? (protocolMetrics.tvl / 1_000).toFixed(0) + "k"
                                    : protocolMetrics.tvl.toFixed(0)}
                              </span>
                            </div>
                            <div className="w-px h-8 bg-white/[0.08]" />
                            <div className="text-center min-w-[60px]">
                              <span className="text-[10px] text-white/40 uppercase tracking-wider block mb-0.5">Borrowed</span>
                              <span className="text-base font-semibold text-white tabular-nums">
                                ${protocolMetrics.borrowed >= 1_000_000
                                  ? (protocolMetrics.borrowed / 1_000_000).toFixed(1) + "M"
                                  : protocolMetrics.borrowed >= 1_000
                                    ? (protocolMetrics.borrowed / 1_000).toFixed(0) + "k"
                                    : protocolMetrics.borrowed.toFixed(0)}
                              </span>
                            </div>
                            <div className="w-px h-8 bg-white/[0.08]" />
                            <div className="text-center min-w-[50px]">
                              <span className="text-[10px] text-white/40 uppercase tracking-wider block mb-0.5">Util</span>
                              <span className="text-base font-semibold text-white tabular-nums">
                                {protocolMetrics.utilization.toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-px h-8 bg-white/[0.08]" />
                            <div className="text-center min-w-[70px]">
                              <span className="text-[10px] text-white/40 uppercase tracking-wider block mb-0.5">7d Flow</span>
                              <span
                                className={`text-base font-semibold tabular-nums ${
                                  protocolMetrics.flow7d >= 0 ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {protocolMetrics.flow7d >= 0 ? "+" : ""}
                                ${Math.abs(protocolMetrics.flow7d) >= 1_000_000
                                  ? (Math.abs(protocolMetrics.flow7d) / 1_000_000).toFixed(1) + "M"
                                  : Math.abs(protocolMetrics.flow7d) >= 1_000
                                    ? (Math.abs(protocolMetrics.flow7d) / 1_000).toFixed(0) + "k"
                                    : Math.abs(protocolMetrics.flow7d).toFixed(0)}
                              </span>
                            </div>
                            {protocolMetrics.referralRevenueUsd > 0 && (
                              <>
                                <div className="w-px h-8 bg-white/[0.08]" />
                                <div className="text-center min-w-[85px] relative">
                                  <span className="text-[10px] text-white/40 uppercase tracking-wider block mb-0.5 whitespace-nowrap">
                                    Ref. Revenue
                                  </span>
                                  <span className="text-base font-semibold text-emerald-400 tabular-nums">
                                    ${protocolMetrics.referralRevenueUsd >= 1_000
                                      ? (protocolMetrics.referralRevenueUsd / 1_000).toFixed(1) + "k"
                                      : protocolMetrics.referralRevenueUsd >= 1
                                        ? protocolMetrics.referralRevenueUsd.toFixed(2)
                                        : protocolMetrics.referralRevenueUsd.toFixed(4)}
                                  </span>
                                  <div className="absolute -top-0.5 -right-2">
                                    <InfoTooltip tooltip="Supply referrals earn 50% of protocol fees proportional to their referred shares." size="sm" />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pool Pills */}
                    <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-white/[0.06]">
                      {pools.map((pool) => {
                        const isActive = pool.id === selectedPoolId;
                        return (
                          <button
                            key={pool.id}
                            onClick={() => handlePoolSelect(pool.id)}
                            className={`
                              flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                              transition-all duration-200
                              ${
                                isActive
                                  ? "bg-[#2dd4bf] text-[#0d1a1f] shadow-lg shadow-[#2dd4bf]/20"
                                  : "bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                              }
                            `}
                          >
                            <img
                              src={
                                pool.ui.iconUrl ||
                                `https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png`
                              }
                              alt={pool.asset}
                              className="w-5 h-5 rounded-full"
                            />
                            <span className="font-semibold">{pool.asset}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Compare Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Quick Compare</span>
                        <span className="text-[10px] text-white/30 italic">Click a row to switch market</span>
                      </div>
                      <PoolCompareTable
                        pools={pools}
                        selectedPoolId={selectedPoolId}
                        onSelectPool={handlePoolSelect}
                        userPositions={userPositions}
                      />
                    </div>
                  </div>

                  {/* Mobile Only: Deposit Card */}
                  <div className="lg:hidden">
                    <ActionPanel
                      pool={selectedPool}
                      onDeposit={handleDeposit}
                      onWithdraw={handleWithdraw}
                      onWithdrawAll={handleWithdrawAll}
                      walletBalance={coinBalance?.formatted}
                      depositedBalance={selectedPoolDepositedBalance}
                      suiBalance={suiBalance?.formatted}
                      txStatus={txStatus}
                      onAmountChange={setPendingDepositAmount}
                      currentPositionBalance={selectedPoolDepositedBalance}
                      onShowHowItWorks={() => setHowItWorksOpen(true)}
                    />
                  </div>

                  {/* ═══════════════════════════════════════════════════════════
                      STICKY CONTEXT STRIP + SECTION CHIPS
                      Both live in ONE sticky container so they always stay visible.
                      No backdrop-filter here — that was breaking sticky for children.
                      ═══════════════════════════════════════════════════════════ */}
                  <div
                    ref={contextStripRef}
                    className="sticky z-40"
                    style={{
                      top: `${navbarHeight}px`,
                      /* Use opaque bg instead of backdrop-filter to avoid
                         creating a containing block that breaks sticky for
                         sibling elements */
                      background: "rgb(13, 26, 31)",
                    }}
                  >
                    {/* Context strip (pool selector + key metrics) */}
                    <div className="rounded-t-lg border border-b-0 border-white/[0.06] bg-[#0d1a1f]">
                      <div className="px-2 sm:px-3 py-1 sm:py-1.5">
                        <StickyContextStrip
                          pool={selectedPool}
                          pools={pools}
                          selectedPoolId={selectedPoolId}
                          onSelectPool={handlePoolSelect}
                        />
                      </div>
                    </div>

                    {/* Section chips — every sub-section is a clickable tab */}
                    <div className="rounded-b-lg border border-t-0 border-white/[0.06] bg-[#0d1a1f] px-2 sm:px-3 py-1.5">
                      <SectionChips
                        groups={ANALYTICS_SECTIONS}
                        activeSection={activeSection}
                        onSectionClick={handleChipClick}
                      />
                    </div>
                  </div>

                  {/* ═══════════════════════════════════════════════════════════
                      UNIFIED ANALYTICS — single scrollable page
                      ═══════════════════════════════════════════════════════════ */}
                  <PoolAnalytics
                    pool={selectedPool}
                    pools={pools}
                    scrollCommand={scrollCommand}
                    onActiveSectionChange={handleActiveSectionChange}
                    onMarketClick={(id) => {
                      setDeepbookPoolHistoryPoolId(id);
                      setDeepbookPoolHistoryOpen(true);
                    }}
                  />
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    SEAM DIVIDER
                    ═══════════════════════════════════════════════════════════ */}
                <RailDivider
                  isCollapsed={isRailCollapsed}
                  onToggle={() => setIsRailCollapsed(!isRailCollapsed)}
                />

                {/* ═══════════════════════════════════════════════════════════
                    RIGHT RAIL: Deposit + Portfolio (sticky)
                    ═══════════════════════════════════════════════════════════ */}
                {!isRailCollapsed && (
                  <aside
                    className="sticky self-start space-y-4 pl-4 hidden lg:block"
                    style={{ top: `${navbarHeight + 16}px` }}
                  >
                    <ActionPanel
                      pool={selectedPool}
                      onDeposit={handleDeposit}
                      onWithdraw={handleWithdraw}
                      onWithdrawAll={handleWithdrawAll}
                      walletBalance={coinBalance?.formatted}
                      depositedBalance={selectedPoolDepositedBalance}
                      suiBalance={suiBalance?.formatted}
                      txStatus={txStatus}
                      onAmountChange={setPendingDepositAmount}
                      currentPositionBalance={selectedPoolDepositedBalance}
                      onShowHowItWorks={() => setHowItWorksOpen(true)}
                    />
                    <PortfolioCard
                      userAddress={account?.address}
                      pools={pools}
                      positions={userPositions}
                      onViewAllHistory={() => setHistoryOpen(true)}
                      onSelectPool={handlePoolSelect}
                    />
                  </aside>
                )}
              </div>
            ) : (
              <div className="py-20 text-center">
                {isLoading ? (
                  <div className="h-72 surface-card animate-pulse" />
                ) : (
                  <div className="surface-card p-16">
                    <h3 className="text-lg font-semibold text-white/70 mb-2">No Pools Available</h3>
                    <p className="text-sm text-white/40">Check network connection or try again later.</p>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* Pool Switch Toast */}
          <PoolSwitchToast
            asset={poolSwitchToast.asset}
            iconUrl={poolSwitchToast.iconUrl}
            isVisible={poolSwitchToast.visible}
          />
        </>
      )}

      {/* Liquidations Section */}
      {selectedSection === "liquidations" && (
        <div className="space-y-8 px-6 lg:px-8">
          <LiquidationDashboard />
        </div>
      )}

      {/* Slide Panels */}
      <SlidePanel open={historyOpen} onClose={() => setHistoryOpen(false)} title="Deposit / Withdraw History" width={"50vw"}>
        <DepositHistory address={account?.address} supplierCapIds={userSupplierCapIds} />
      </SlidePanel>

      <SlidePanel
        open={adminHistoryOpen}
        onClose={() => {
          setAdminHistoryOpen(false);
          setAdminHistoryPoolId(null);
        }}
        title="Admin Configuration History"
        width={"60vw"}
      >
        <AdminHistorySlidePanel poolId={adminHistoryPoolId || undefined} poolName={pools.find((p) => p.id === adminHistoryPoolId)?.asset} />
      </SlidePanel>

      <SlidePanel
        open={interestRateHistoryOpen}
        onClose={() => {
          setInterestRateHistoryOpen(false);
          setInterestRateHistoryPoolId(null);
        }}
        title=""
        width={"60vw"}
      >
        <InterestRateHistoryPanel
          poolId={interestRateHistoryPoolId || undefined}
          poolName={pools.find((p) => p.contracts?.marginPoolId === interestRateHistoryPoolId)?.asset}
          currentPool={pools.find((p) => p.contracts?.marginPoolId === interestRateHistoryPoolId)}
          onClose={() => {
            setInterestRateHistoryOpen(false);
            setInterestRateHistoryPoolId(null);
          }}
        />
      </SlidePanel>

      <SlidePanel
        open={deepbookPoolHistoryOpen}
        onClose={() => {
          setDeepbookPoolHistoryOpen(false);
          setDeepbookPoolHistoryPoolId(null);
        }}
        title=""
        width={"60vw"}
      >
        <DeepbookPoolHistoryPanel
          poolId={deepbookPoolHistoryPoolId || undefined}
          onClose={() => {
            setDeepbookPoolHistoryOpen(false);
            setDeepbookPoolHistoryPoolId(null);
          }}
        />
      </SlidePanel>

      {/* How It Works */}
      <SlidePanel
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        title="How It Works"
        width={"50vw"}
      >
        <HowItWorksPanel />
      </SlidePanel>

      {/* Transaction Toast */}
      <TransactionToast
        isVisible={toast.isVisible}
        onDismiss={() => {
          const { shouldResetTxStatus } = toast.dismiss();
          if (shouldResetTxStatus) {
            resetTxStatus();
          }
        }}
        state={toast.state}
        actionType={toast.actionType}
        amount={toast.amount}
        asset={selectedPool?.asset}
        poolName={selectedPool ? `${selectedPool.asset} Margin Pool` : undefined}
        txDigest={toast.digest}
        explorerUrl={explorerUrl}
        error={txError}
        onViewActivity={() => {
          setUrlSection("supply-withdraw");
          setHistoryOpen(true);
        }}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
