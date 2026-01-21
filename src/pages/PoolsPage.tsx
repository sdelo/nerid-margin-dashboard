import React from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import NavBar from "../features/shared/components/NavBar";
import PoolCompareTable from "../features/lending/components/PoolCompareTable";
import StickyContextStrip from "../features/lending/components/StickyContextStrip";
import PoolSwitchToast from "../features/lending/components/PoolSwitchToast";
import PortfolioCard from "../features/lending/components/PortfolioCard";
import ActionPanel from "../features/lending/components/ActionPanel";
import { OverviewTiles } from "../features/lending/components/OverviewTiles";
import SlidePanel from "../features/shared/components/SlidePanel";
import DepositHistory from "../features/lending/components/DepositHistory";
import { LiquidationDashboard } from "../features/lending/components/LiquidationDashboard";
import { YieldTab } from "../features/lending/components/YieldTab";
import { RiskTab } from "../features/lending/components/RiskTab";
import { ActivityTab } from "../features/lending/components/ActivityTab";
import { AdminHistorySlidePanel } from "../features/lending/components/AdminHistorySlidePanel";
import { InterestRateHistoryPanel } from "../features/lending/components/InterestRateHistoryPanel";
import { DeepbookPoolHistoryPanel } from "../features/lending/components/DeepbookPoolHistoryPanel";
import { HowItWorksPanel } from "../features/lending/components/HowItWorksPanel";
import {
  TransactionToast,
  type TransactionToastState,
  type TransactionActionType,
} from "../components/TransactionToast";
import {
  SectionNav,
  type DashboardSection,
} from "../features/shared/components/SectionNav";
import { RailDivider } from "../features/shared/components/RailDivider";
import { useCoinBalance } from "../hooks/useCoinBalance";
import { useAllPools } from "../hooks/useAllPools";
import { useAppNetwork } from "../context/AppNetworkContext";
import {
  ONE_BILLION,
  GAS_AMOUNT_MIST,
  MIN_GAS_BALANCE_SUI,
} from "../constants";
import {
  buildDepositTransaction,
  buildWithdrawTransaction,
  buildWithdrawAllTransaction,
} from "../lib/suiTransactions";
import { Footer } from "../components/Footer";
import { useStickyHeader } from "../context/StickyHeaderContext";
import { usePoolActivityMetrics } from "../features/lending/hooks/usePoolActivityMetrics";

export function PoolsPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { network } = useSuiClientContext();
  const queryClient = useQueryClient();

  const [selectedSection, setSelectedSection] =
    React.useState<DashboardSection>("pools");

  const [overviewTab, setOverviewTab] = React.useState<
    | "overview"
    | "yield"
    | "risk"
    | "activity"
    | "howItWorks"
  >("overview");
  // Track which section within a tab to scroll to (for deep linking from tiles)
  const [initialSection, setInitialSection] = React.useState<string | null>(null);
  const [isDetailsGlowing, setIsDetailsGlowing] = React.useState(false);
  const detailsRef = React.useRef<HTMLDivElement>(null);
  
  const [pendingDepositAmount, setPendingDepositAmount] = React.useState<string>("");
  
  // Right rail collapse state
  const [isRailCollapsed, setIsRailCollapsed] = React.useState(false);

  // Sticky header context for dynamic positioning
  const { navbarHeight, setContextStripHeight } = useStickyHeader();
  const contextStripRef = React.useRef<HTMLDivElement>(null);

  // Measure context strip height and report to context
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

  const { pools, userPositions, isLoading, error: poolsError, refetch: refetchPools } = useAllPools(account?.address);

  // Protocol-level activity metrics for 7d flow
  const { metrics: poolActivityMetrics } = usePoolActivityMetrics(pools);

  // Compute protocol-level aggregated metrics
  const protocolMetrics = React.useMemo(() => {
    if (pools.length === 0) return null;

    // Aggregate TVL and borrowed across all pools
    const totalTVL = pools.reduce((sum, pool) => sum + (pool.state?.supply || 0), 0);
    const totalBorrowed = pools.reduce((sum, pool) => sum + (pool.state?.borrow || 0), 0);
    const utilization = totalTVL > 0 ? (totalBorrowed / totalTVL) * 100 : 0;

    // Sum 7d net flow across all pools
    let total7dFlow = 0;
    poolActivityMetrics.forEach((metric) => {
      total7dFlow += metric.netFlow7d;
    });

    return {
      tvl: totalTVL,
      borrowed: totalBorrowed,
      utilization,
      flow7d: total7dFlow,
    };
  }, [pools, poolActivityMetrics]);

  const userSupplierCapIds: string[] = React.useMemo(() => {
    const capIds = new Set(
      userPositions
        .map((pos) => pos.supplierCapId)
        .filter((id): id is string => !!id)
    );
    return Array.from(capIds);
  }, [userPositions]);

  const [selectedPoolId, setSelectedPoolId] = React.useState<string | null>(null);
  const [poolSwitchToast, setPoolSwitchToast] = React.useState<{
    visible: boolean;
    asset: string | null;
    iconUrl?: string;
  }>({ visible: false, asset: null });

  const selectedPool = React.useMemo(() => {
    if (pools.length === 0) return null;
    return pools.find((p) => p.id === selectedPoolId) ?? pools[0];
  }, [pools, selectedPoolId]);

  const selectedPoolDepositedBalance = React.useMemo(() => {
    if (!selectedPool || userPositions.length === 0) return 0;
    const position = userPositions.find((p) => p.asset === selectedPool.asset);
    if (!position) return 0;
    const match = position.balanceFormatted.match(/^([\d.,]+)/);
    if (match) {
      return parseFloat(match[1].replace(/,/g, '')) || 0;
    }
    return 0;
  }, [selectedPool, userPositions]);

  React.useEffect(() => {
    if (!selectedPoolId && pools.length > 0) {
      setSelectedPoolId(pools[0].id);
    }
  }, [pools, selectedPoolId]);

  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [adminHistoryOpen, setAdminHistoryOpen] = React.useState(false);
  const [adminHistoryPoolId, setAdminHistoryPoolId] = React.useState<string | null>(null);
  const [deepbookPoolHistoryOpen, setDeepbookPoolHistoryOpen] = React.useState(false);
  const [deepbookPoolHistoryPoolId, setDeepbookPoolHistoryPoolId] = React.useState<string | null>(null);
  const [interestRateHistoryOpen, setInterestRateHistoryOpen] = React.useState(false);
  const [interestRateHistoryPoolId, setInterestRateHistoryPoolId] = React.useState<string | null>(null);
  const [txStatus, setTxStatus] = React.useState<"idle" | "pending" | "success" | "error">("idle");
  const [txError, setTxError] = React.useState<string | null>(null);
  
  // Transaction toast state
  const [txToastVisible, setTxToastVisible] = React.useState(false);
  const [txToastState, setTxToastState] = React.useState<TransactionToastState>("pending");
  const [txDigest, setTxDigest] = React.useState<string>("");
  const [txActionType, setTxActionType] = React.useState<TransactionActionType>("deposit");
  const [txAmount, setTxAmount] = React.useState<string>("");
  const { explorerUrl } = useAppNetwork();
  
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: { showRawEffects: true, showObjectChanges: true },
      }),
  });

  const coinBalance = useCoinBalance(
    account?.address,
    selectedPool?.contracts?.coinType || "",
    selectedPool?.contracts?.coinDecimals || 9
  );

  const suiBalance = useCoinBalance(account?.address, "0x2::sui::SUI", 9);

  const handleDeposit = React.useCallback(
    async (amount: number) => {
      if (!account || !selectedPool) return;

      const suiBalanceNum = parseFloat(suiBalance?.raw || "0") / ONE_BILLION;
      if (suiBalanceNum < MIN_GAS_BALANCE_SUI) {
        setTxStatus("error");
        setTxError("Insufficient SUI for gas fees. You need at least 0.01 SUI.");
        return;
      }

      if (selectedPool.contracts.coinType === "0x2::sui::SUI") {
        try {
          const suiCoins = await suiClient.getCoins({
            owner: account.address,
            coinType: "0x2::sui::SUI",
          });
          const totalSuiBalance = suiCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), 0n);
          const gasAmount = BigInt(GAS_AMOUNT_MIST);
          const depositAmount = BigInt(Math.round(amount * ONE_BILLION));
          const totalNeeded = gasAmount + depositAmount;
          if (totalSuiBalance < totalNeeded) {
            setTxStatus("error");
            setTxError(`Insufficient SUI. Need ${Number(totalNeeded) / 1e9} SUI but have ${Number(totalSuiBalance) / 1e9} SUI.`);
            return;
          }
        } catch (error) {
          console.error("Error checking SUI coins:", error);
        }
      }

      const assetBalanceNum = parseFloat(coinBalance?.raw || "0") / Math.pow(10, selectedPool.contracts.coinDecimals);
      if (amount > assetBalanceNum) {
        setTxStatus("error");
        setTxError(`Insufficient ${selectedPool.asset} balance.`);
        return;
      }

      try {
        setTxStatus("pending");
        setTxError(null);
        
        // Show pending toast immediately
        setTxActionType("deposit");
        setTxAmount(amount.toLocaleString(undefined, { maximumFractionDigits: 4 }));
        setTxDigest("");
        setTxToastState("pending");
        setTxToastVisible(true);
        
        const poolContracts = selectedPool.contracts;
        const decimals = poolContracts.coinDecimals;
        const finalAmount = BigInt(Math.round(amount * 10 ** decimals));

        const tx = await buildDepositTransaction({
          amount: finalAmount,
          owner: account.address,
          coinType: poolContracts.coinType,
          poolId: poolContracts.marginPoolId,
          registryId: poolContracts.registryId,
          referralId: poolContracts.referralId,
          poolType: poolContracts.marginPoolType,
          suiClient,
        });

        const result = await signAndExecute({ transaction: tx, chain: `sui:${network}` });
        
        // Transition to submitted state with tx digest
        setTxDigest(result.digest);
        setTxToastState("submitted");
        
        const txResponse = await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showEffects: true, showEvents: true },
        });

        if (txResponse.effects?.status?.status !== "success") {
          setTxStatus("error");
          setTxError(txResponse.effects?.status?.error || "Transaction failed");
          setTxToastState("error");
          return;
        }

        // Transition to finalized state
        setTxToastState("finalized");
        setTxStatus("success");
        setPendingDepositAmount("");
        await Promise.all([refetchPools(), coinBalance.refetch(), suiBalance.refetch()]);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['assetSupplied'] });
          queryClient.invalidateQueries({ queryKey: ['assetWithdrawn'] });
        }, 3000);
      } catch (error) {
        setTxStatus("error");
        const errorMsg = error instanceof Error ? error.message : "Transaction failed";
        setTxError(errorMsg);
        setTxToastState("error");
      }
    },
    [account, selectedPool, signAndExecute, suiClient, network, suiBalance, coinBalance, queryClient, refetchPools]
  );

  const handleWithdraw = React.useCallback(
    async (amount: number) => {
      if (!account || !selectedPool) return;

      const suiBalanceNum = parseFloat(suiBalance?.raw || "0") / ONE_BILLION;
      if (suiBalanceNum < MIN_GAS_BALANCE_SUI) {
        setTxStatus("error");
        setTxError("Insufficient SUI for gas fees.");
        return;
      }

      try {
        setTxStatus("pending");
        setTxError(null);
        
        // Show pending toast immediately
        setTxActionType("withdraw");
        setTxAmount(amount.toLocaleString(undefined, { maximumFractionDigits: 4 }));
        setTxDigest("");
        setTxToastState("pending");
        setTxToastVisible(true);
        
        const poolContracts = selectedPool.contracts;
        const decimals = poolContracts.coinDecimals;
        const finalAmount = BigInt(Math.round(amount * 10 ** decimals));

        const tx = await buildWithdrawTransaction({
          amount: finalAmount,
          poolId: poolContracts.marginPoolId,
          registryId: poolContracts.registryId,
          poolType: poolContracts.marginPoolType,
          owner: account.address,
          suiClient,
        });
        
        const result = await signAndExecute({ transaction: tx, chain: `sui:${network}` });
        
        // Transition to submitted state with tx digest
        setTxDigest(result.digest);
        setTxToastState("submitted");
        
        const txResponse = await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showEffects: true, showEvents: true },
        });

        if (txResponse.effects?.status?.status !== "success") {
          setTxStatus("error");
          setTxError(txResponse.effects?.status?.error || "Transaction failed");
          setTxToastState("error");
          return;
        }

        // Transition to finalized state
        setTxToastState("finalized");
        setTxStatus("success");
        await Promise.all([refetchPools(), coinBalance.refetch(), suiBalance.refetch()]);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['assetSupplied'] });
          queryClient.invalidateQueries({ queryKey: ['assetWithdrawn'] });
        }, 3000);
      } catch (error) {
        setTxStatus("error");
        const errorMsg = error instanceof Error ? error.message : "Transaction failed";
        setTxError(errorMsg);
        setTxToastState("error");
      }
    },
    [account, selectedPool, signAndExecute, network, suiBalance, suiClient, queryClient, refetchPools, coinBalance]
  );

  const handleWithdrawAll = React.useCallback(
    async () => {
      if (!account || !selectedPool) return;

      const suiBalanceNum = parseFloat(suiBalance?.raw || "0") / ONE_BILLION;
      if (suiBalanceNum < MIN_GAS_BALANCE_SUI) {
        setTxStatus("error");
        setTxError("Insufficient SUI for gas fees.");
        return;
      }

      try {
        setTxStatus("pending");
        setTxError(null);
        
        // Show pending toast immediately
        setTxActionType("withdraw");
        setTxAmount("all");
        setTxDigest("");
        setTxToastState("pending");
        setTxToastVisible(true);
        
        const poolContracts = selectedPool.contracts;

        const tx = await buildWithdrawAllTransaction({
          poolId: poolContracts.marginPoolId,
          registryId: poolContracts.registryId,
          poolType: poolContracts.marginPoolType,
          owner: account.address,
          suiClient,
        });
        
        const result = await signAndExecute({ transaction: tx, chain: `sui:${network}` });
        
        // Transition to submitted state with tx digest
        setTxDigest(result.digest);
        setTxToastState("submitted");
        
        const txResponse = await suiClient.waitForTransaction({
          digest: result.digest,
          options: { showEffects: true, showEvents: true },
        });

        if (txResponse.effects?.status?.status !== "success") {
          setTxStatus("error");
          setTxError(txResponse.effects?.status?.error || "Transaction failed");
          setTxToastState("error");
          return;
        }

        // Transition to finalized state
        setTxToastState("finalized");
        setTxStatus("success");
        await Promise.all([refetchPools(), coinBalance.refetch(), suiBalance.refetch()]);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['assetSupplied'] });
          queryClient.invalidateQueries({ queryKey: ['assetWithdrawn'] });
        }, 3000);
      } catch (error) {
        setTxStatus("error");
        const errorMsg = error instanceof Error ? error.message : "Transaction failed";
        setTxError(errorMsg);
        setTxToastState("error");
      }
    },
    [account, selectedPool, signAndExecute, network, suiBalance, suiClient, queryClient, refetchPools, coinBalance]
  );

  const hasError = poolsError;

  // Tab configuration - consolidated to 3 main tabs + overview
  type TabKey = "overview" | "yield" | "risk" | "activity" | "howItWorks";
  const mainTabs: readonly { key: TabKey; label: string; description: string }[] = [
    { key: "yield", label: "Yield", description: "Rates, APY history & markets" },
    { key: "risk", label: "Risk", description: "Liquidity, concentration & liquidations" },
    { key: "activity", label: "Activity", description: "Deposits, withdrawals & flows" },
  ];
  
  const getTabLabel = (tab: TabKey): string => {
    if (tab === "overview") return "Overview";
    if (tab === "howItWorks") return "How It Works";
    return mainTabs.find(t => t.key === tab)?.label || tab;
  };

  const handleTabClick = (tab: TabKey, section?: string) => {
    setOverviewTab(tab);
    // Set section for deep navigation within the tab
    setInitialSection(section || null);
    
    if (!section) {
      // No specific section - just scroll to the details/tab content area
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setIsDetailsGlowing(true);
        setTimeout(() => setIsDetailsGlowing(false), 400);
      }, 50);
    } else {
      // Section navigation: First scroll to make sure tab content is visible,
      // then let the tab component handle scrolling to the specific section.
      // We scroll to detailsRef instantly (no smooth) to set up the right context,
      // then the tab component's useEffect will handle the smooth scroll to section.
      if (detailsRef.current) {
        const headerOffset = 180;
        const elementRect = detailsRef.current.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.scrollY;
        const targetScrollPosition = absoluteElementTop - headerOffset;
        
        // Instant scroll to position the tab content area in view
        window.scrollTo({
          top: Math.max(0, targetScrollPosition),
          behavior: 'auto' // instant, not smooth - the section scroll will be smooth
        });
      }
    }
  };

  const handlePoolSelect = (poolId: string) => {
    if (poolId !== selectedPoolId) {
      const newPool = pools.find((p) => p.id === poolId);
      setSelectedPoolId(poolId);
      setPendingDepositAmount("");
      
      // Show pool switch toast
      if (newPool) {
        setPoolSwitchToast({
          visible: true,
          asset: newPool.asset,
          iconUrl: newPool.ui.iconUrl || undefined,
        });
        // Auto-hide after animation completes
        setTimeout(() => {
          setPoolSwitchToast({ visible: false, asset: null });
        }, 2000);
      }
    }
  };

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
          <main className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6 pb-16">
            {selectedPool ? (
              <div 
                className={`grid transition-all duration-300 ${
                  isRailCollapsed 
                    ? "gap-0 grid-cols-1 lg:grid-cols-[1fr_auto]" 
                    : "gap-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_400px]"
                }`}
              >
                {/* ═══════════════════════════════════════════════════════════════
                    LEFT COLUMN: All main content
                    ═══════════════════════════════════════════════════════════════ */}
                <div className="min-w-0 space-y-6">
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
                                  ? (protocolMetrics.tvl / 1_000_000).toFixed(1) + 'M'
                                  : protocolMetrics.tvl >= 1_000 
                                    ? (protocolMetrics.tvl / 1_000).toFixed(0) + 'k'
                                    : protocolMetrics.tvl.toFixed(0)
                                }
                              </span>
                            </div>
                            <div className="w-px h-8 bg-white/[0.08]" />
                            <div className="text-center min-w-[60px]">
                              <span className="text-[10px] text-white/40 uppercase tracking-wider block mb-0.5">Borrowed</span>
                              <span className="text-base font-semibold text-white tabular-nums">
                                ${protocolMetrics.borrowed >= 1_000_000 
                                  ? (protocolMetrics.borrowed / 1_000_000).toFixed(1) + 'M'
                                  : protocolMetrics.borrowed >= 1_000 
                                    ? (protocolMetrics.borrowed / 1_000).toFixed(0) + 'k'
                                    : protocolMetrics.borrowed.toFixed(0)
                                }
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
                              <span className={`text-base font-semibold tabular-nums ${
                                protocolMetrics.flow7d >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {protocolMetrics.flow7d >= 0 ? '+' : ''}
                                ${Math.abs(protocolMetrics.flow7d) >= 1_000_000 
                                  ? (Math.abs(protocolMetrics.flow7d) / 1_000_000).toFixed(1) + 'M'
                                  : Math.abs(protocolMetrics.flow7d) >= 1_000 
                                    ? (Math.abs(protocolMetrics.flow7d) / 1_000).toFixed(0) + 'k'
                                    : Math.abs(protocolMetrics.flow7d).toFixed(0)
                                }
                              </span>
                            </div>
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
                              ${isActive
                                ? "bg-[#2dd4bf] text-[#0d1a1f] shadow-lg shadow-[#2dd4bf]/20"
                                : "bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]"
                              }
                            `}
                          >
                            <img 
                              src={pool.ui.iconUrl || `https://assets.coingecko.com/coins/images/26375/standard/sui-ocean-square.png`}
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
                      onShowHowItWorks={() => handleTabClick("howItWorks")}
                    />
                  </div>

                  {/* ═══════════════════════════════════════════════════════════════
                      STICKY CONTEXT STRIP + TABS
                      Sticks below navbar when scrolling.
                      ═══════════════════════════════════════════════════════════════ */}
                  <div 
                    ref={contextStripRef}
                    className="sticky z-40"
                    style={{ 
                      top: `${navbarHeight}px`,
                      background: 'rgba(13, 26, 31, 0.98)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                    }}
                  >
                    <div className="rounded-lg border border-white/[0.06] bg-[#0d1a1f]">
                      {/* Context Strip - Compact */}
                      <div className="px-2 sm:px-3 py-1 sm:py-1.5 border-b border-white/[0.04]">
                        <StickyContextStrip
                          pool={selectedPool}
                          pools={pools}
                          selectedPoolId={selectedPoolId}
                          onSelectPool={handlePoolSelect}
                        />
                      </div>
                      
                      {/* Main Tabs - Directly attached */}
                      {overviewTab !== "overview" && (
                        <div className="px-2 sm:px-3 py-1">
                          <div className="tab-bar relative">
                            {mainTabs.map((tab) => (
                              <button
                                key={tab.key}
                                onClick={() => handleTabClick(tab.key)}
                                className={`tab-item ${overviewTab === tab.key ? "active" : ""}`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Back button - Subtle, inline with content */}
                  {overviewTab !== "overview" && (
                    <div ref={detailsRef} className="flex items-center gap-2 pt-4 scroll-mt-sticky">
                      <button
                        onClick={() => setOverviewTab("overview")}
                        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Overview
                      </button>
                      <span className="text-white/20">·</span>
                      <span className="text-xs text-white/30">{selectedPool?.asset}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-xs text-[#2dd4bf]/70">{getTabLabel(overviewTab)}</span>
                    </div>
                  )}
                  
                  {/* Details anchor for overview */}
                  {overviewTab === "overview" && (
                    <div ref={detailsRef} className="scroll-mt-sticky" />
                  )}

                  {/* Tab Content - overflow-visible allows sticky children to work properly */}
                  <div className={`surface-elevated transition-all duration-300 overflow-visible ${
                    overviewTab === "overview" ? "p-6" : "pt-0 px-6 pb-6"
                  } ${isDetailsGlowing ? "ring-2 ring-[#2dd4bf]/50 shadow-lg shadow-[#2dd4bf]/10" : ""}`}>
                    {overviewTab === "overview" && (
                      <OverviewTiles
                        pool={selectedPool}
                        onSelectTab={(tab) => {
                          // Map old tab names to new consolidated tabs, preserving section for deep navigation
                          const tabMapping: Record<string, { tab: TabKey; section?: string }> = {
                            rates: { tab: "yield", section: "rates" },
                            history: { tab: "yield", section: "history" },
                            markets: { tab: "yield", section: "markets" },
                            liquidity: { tab: "risk", section: "liquidity" },
                            concentration: { tab: "risk", section: "concentration" },
                            liquidations: { tab: "risk", section: "liquidations" },
                            risk: { tab: "risk", section: "overview" },
                            activity: { tab: "activity" },
                          };
                          const mapping = tabMapping[tab];
                          if (mapping) {
                            handleTabClick(mapping.tab, mapping.section);
                          } else {
                            handleTabClick(tab as TabKey);
                          }
                        }}
                      />
                    )}
                    {overviewTab === "yield" && (
                      <YieldTab
                        pool={selectedPool}
                        pools={pools}
                        initialSection={initialSection}
                        onMarketClick={(id) => {
                          setDeepbookPoolHistoryPoolId(id);
                          setDeepbookPoolHistoryOpen(true);
                        }}
                      />
                    )}
                    {overviewTab === "risk" && (
                      <RiskTab pool={selectedPool} initialSection={initialSection} />
                    )}
                    {overviewTab === "activity" && (
                      <ActivityTab pool={selectedPool} initialSection={initialSection} />
                    )}
                    {overviewTab === "howItWorks" && (
                      <HowItWorksPanel />
                    )}
                  </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    SEAM DIVIDER
                    ═══════════════════════════════════════════════════════════════ */}
                <RailDivider
                  isCollapsed={isRailCollapsed}
                  onToggle={() => setIsRailCollapsed(!isRailCollapsed)}
                />

                {/* ═══════════════════════════════════════════════════════════════
                    RIGHT RAIL: Deposit + Portfolio (sticky)
                    ═══════════════════════════════════════════════════════════════ */}
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
                      onShowHowItWorks={() => handleTabClick("howItWorks")}
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

      <SlidePanel open={adminHistoryOpen} onClose={() => { setAdminHistoryOpen(false); setAdminHistoryPoolId(null); }} title="Admin Configuration History" width={"60vw"}>
        <AdminHistorySlidePanel poolId={adminHistoryPoolId || undefined} poolName={pools.find((p) => p.id === adminHistoryPoolId)?.asset} />
      </SlidePanel>

      <SlidePanel open={interestRateHistoryOpen} onClose={() => { setInterestRateHistoryOpen(false); setInterestRateHistoryPoolId(null); }} title="" width={"60vw"}>
        <InterestRateHistoryPanel
          poolId={interestRateHistoryPoolId || undefined}
          poolName={pools.find((p) => p.contracts?.marginPoolId === interestRateHistoryPoolId)?.asset}
          currentPool={pools.find((p) => p.contracts?.marginPoolId === interestRateHistoryPoolId)}
          onClose={() => { setInterestRateHistoryOpen(false); setInterestRateHistoryPoolId(null); }}
        />
      </SlidePanel>

      <SlidePanel open={deepbookPoolHistoryOpen} onClose={() => { setDeepbookPoolHistoryOpen(false); setDeepbookPoolHistoryPoolId(null); }} title="" width={"60vw"}>
        <DeepbookPoolHistoryPanel poolId={deepbookPoolHistoryPoolId || undefined} onClose={() => { setDeepbookPoolHistoryOpen(false); setDeepbookPoolHistoryPoolId(null); }} />
      </SlidePanel>

      {/* Transaction Toast */}
      <TransactionToast
        isVisible={txToastVisible}
        onDismiss={() => {
          setTxToastVisible(false);
          // Reset tx status when toast is dismissed
          if (txToastState === "finalized" || txToastState === "error") {
            setTxStatus("idle");
            setTxError(null);
            setTxDigest("");
            setTxAmount("");
          }
        }}
        state={txToastState}
        actionType={txActionType}
        amount={txAmount}
        asset={selectedPool?.asset}
        poolName={selectedPool ? `${selectedPool.asset} Margin Pool` : undefined}
        txDigest={txDigest}
        explorerUrl={explorerUrl}
        error={txError}
        onViewActivity={() => {
          setOverviewTab("activity");
          setHistoryOpen(true);
        }}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
