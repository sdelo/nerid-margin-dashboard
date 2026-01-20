import React from "react";
import {
  fetchAssetSupplied,
  fetchAssetWithdrawn,
  fetchLiquidations,
} from "../api/events";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import type { PoolOverview } from "../types";

interface PoolHealthScoreProps {
  pool: PoolOverview;
  variant?: "badge" | "full";
}

interface HealthFactor {
  name: string;
  score: number; // 0-100
  weight: number;
  status: "excellent" | "good" | "moderate" | "warning" | "critical";
  description: string;
  icon: string;
}

type OverallGrade = "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";

const GRADE_COLORS: Record<OverallGrade, { bg: string; text: string; border: string; glow: string }> = {
  "A+": { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/50", glow: "shadow-emerald-500/30" },
  "A": { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/40", glow: "shadow-emerald-500/20" },
  "B+": { bg: "bg-teal-500/20", text: "text-teal-400", border: "border-teal-500/50", glow: "shadow-teal-500/30" },
  "B": { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/40", glow: "shadow-cyan-500/20" },
  "C+": { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/50", glow: "shadow-yellow-500/30" },
  "C": { bg: "bg-amber-500/15", text: "text-teal-400", border: "border-amber-500/40", glow: "shadow-amber-500/20" },
  "D": { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/50", glow: "shadow-orange-500/30" },
  "F": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50", glow: "shadow-red-500/30" },
};

const STATUS_COLORS = {
  excellent: "text-emerald-400",
  good: "text-teal-400",
  moderate: "text-yellow-400",
  warning: "text-orange-400",
  critical: "text-red-400",
};

export function PoolHealthScore({ pool, variant = "full" }: PoolHealthScoreProps) {
  const { serverUrl } = useAppNetwork();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [tvlTrend, setTvlTrend] = React.useState<number>(0); // -100 to 100
  const [liquidationCount, setLiquidationCount] = React.useState<number>(0);
  const [badDebtAmount, setBadDebtAmount] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState(true);

  const poolId = pool.contracts?.marginPoolId;
  const decimals = pool.contracts?.coinDecimals ?? 9;

  // Fetch additional data for scoring
  React.useEffect(() => {
    async function fetchHealthData() {
      if (!poolId) return;

      try {
        setIsLoading(true);

        // Fetch last 30 days of data
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const params = {
          margin_pool_id: poolId,
          start_time: thirtyDaysAgo,
          end_time: Date.now(),
          limit: 10000,
        };

        const [supplied, withdrawn, liquidations] = await Promise.all([
          fetchAssetSupplied(params),
          fetchAssetWithdrawn(params),
          fetchLiquidations(params),
        ]);

        // Calculate TVL trend (net flow as % of current TVL)
        const totalSupplied = supplied.reduce(
          (sum, e) => sum + parseFloat(e.amount) / 10 ** decimals,
          0
        );
        const totalWithdrawn = withdrawn.reduce(
          (sum, e) => sum + parseFloat(e.amount) / 10 ** decimals,
          0
        );
        const netFlow = totalSupplied - totalWithdrawn;
        const currentTVL = pool.state?.supply ?? 1;
        const trendPct = (netFlow / currentTVL) * 100;
        setTvlTrend(Math.max(-100, Math.min(100, trendPct)));

        // Count liquidations
        setLiquidationCount(liquidations.length);

        // Calculate bad debt
        const totalBadDebt = liquidations.reduce(
          (sum, e) => sum + parseFloat(e.pool_default) / 10 ** decimals,
          0
        );
        setBadDebtAmount(totalBadDebt);
      } catch (err) {
        console.error("Error fetching health data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHealthData();
  }, [poolId, decimals, serverUrl, pool.state?.supply]);

  // Calculate health factors
  const healthFactors = React.useMemo((): HealthFactor[] => {
    const factors: HealthFactor[] = [];

    // 1. Utilization Health (weight: 30%)
    const utilization = pool.state?.supply > 0 
      ? (pool.state.borrow / pool.state.supply) * 100 
      : 0;
    const optimalUtil = (pool.protocolConfig?.interest_config?.optimal_utilization ?? 0.7) * 100;
    const maxUtil = (pool.protocolConfig?.margin_pool_config?.max_utilization_rate ?? 0.9) * 100;
    
    let utilizationScore: number;
    let utilizationStatus: HealthFactor["status"];
    
    if (utilization <= optimalUtil * 0.8) {
      utilizationScore = 100;
      utilizationStatus = "excellent";
    } else if (utilization <= optimalUtil) {
      utilizationScore = 85;
      utilizationStatus = "good";
    } else if (utilization <= optimalUtil * 1.1) {
      utilizationScore = 70;
      utilizationStatus = "moderate";
    } else if (utilization <= maxUtil * 0.9) {
      utilizationScore = 50;
      utilizationStatus = "warning";
    } else {
      utilizationScore = 25;
      utilizationStatus = "critical";
    }

    factors.push({
      name: "Utilization",
      score: utilizationScore,
      weight: 30,
      status: utilizationStatus,
      description: `${utilization.toFixed(1)}% of pool is borrowed (optimal: ${optimalUtil.toFixed(0)}%)`,
      icon: "📊",
    });

    // 2. TVL Trend (weight: 20%)
    let tvlScore: number;
    let tvlStatus: HealthFactor["status"];
    
    if (tvlTrend > 10) {
      tvlScore = 100;
      tvlStatus = "excellent";
    } else if (tvlTrend > 0) {
      tvlScore = 80;
      tvlStatus = "good";
    } else if (tvlTrend > -5) {
      tvlScore = 60;
      tvlStatus = "moderate";
    } else if (tvlTrend > -20) {
      tvlScore = 40;
      tvlStatus = "warning";
    } else {
      tvlScore = 20;
      tvlStatus = "critical";
    }

    factors.push({
      name: "TVL Trend",
      score: tvlScore,
      weight: 20,
      status: tvlStatus,
      description: tvlTrend >= 0 
        ? `Growing: +${tvlTrend.toFixed(1)}% in 30 days`
        : `Shrinking: ${tvlTrend.toFixed(1)}% in 30 days`,
      icon: tvlTrend >= 0 ? "📈" : "📉",
    });

    // 3. Liquidation Activity (weight: 25%)
    let liqScore: number;
    let liqStatus: HealthFactor["status"];
    
    if (liquidationCount === 0) {
      liqScore = 100;
      liqStatus = "excellent";
    } else if (liquidationCount <= 2) {
      liqScore = 80;
      liqStatus = "good";
    } else if (liquidationCount <= 5) {
      liqScore = 60;
      liqStatus = "moderate";
    } else if (liquidationCount <= 10) {
      liqScore = 40;
      liqStatus = "warning";
    } else {
      liqScore = 20;
      liqStatus = "critical";
    }

    factors.push({
      name: "Liquidations",
      score: liqScore,
      weight: 25,
      status: liqStatus,
      description: liquidationCount === 0 
        ? "No liquidations in 30 days"
        : `${liquidationCount} liquidation${liquidationCount > 1 ? "s" : ""} in 30 days`,
      icon: liquidationCount === 0 ? "✅" : "⚡",
    });

    // 4. Bad Debt (weight: 25%)
    const badDebtRatio = pool.state?.supply > 0 
      ? (badDebtAmount / pool.state.supply) * 100 
      : 0;
    
    let badDebtScore: number;
    let badDebtStatus: HealthFactor["status"];
    
    if (badDebtAmount === 0) {
      badDebtScore = 100;
      badDebtStatus = "excellent";
    } else if (badDebtRatio < 0.1) {
      badDebtScore = 75;
      badDebtStatus = "good";
    } else if (badDebtRatio < 0.5) {
      badDebtScore = 50;
      badDebtStatus = "moderate";
    } else if (badDebtRatio < 1) {
      badDebtScore = 30;
      badDebtStatus = "warning";
    } else {
      badDebtScore = 10;
      badDebtStatus = "critical";
    }

    factors.push({
      name: "Bad Debt",
      score: badDebtScore,
      weight: 25,
      status: badDebtStatus,
      description: badDebtAmount === 0 
        ? "No bad debt recorded"
        : `${badDebtAmount.toFixed(2)} ${pool.asset} (${badDebtRatio.toFixed(3)}% of TVL)`,
      icon: badDebtAmount === 0 ? "🛡️" : "⚠️",
    });

    return factors;
  }, [pool, tvlTrend, liquidationCount, badDebtAmount]);

  // Calculate overall score and grade
  const { overallScore, grade } = React.useMemo(() => {
    const weightedScore = healthFactors.reduce(
      (sum, factor) => sum + (factor.score * factor.weight) / 100,
      0
    );

    let grade: OverallGrade;
    if (weightedScore >= 95) grade = "A+";
    else if (weightedScore >= 85) grade = "A";
    else if (weightedScore >= 78) grade = "B+";
    else if (weightedScore >= 70) grade = "B";
    else if (weightedScore >= 63) grade = "C+";
    else if (weightedScore >= 55) grade = "C";
    else if (weightedScore >= 40) grade = "D";
    else grade = "F";

    return { overallScore: weightedScore, grade };
  }, [healthFactors]);

  const gradeStyle = GRADE_COLORS[grade];

  // Badge variant (compact)
  if (variant === "badge") {
    return (
      <div 
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${gradeStyle.bg} border ${gradeStyle.border} cursor-pointer hover:scale-105 transition-transform`}
        onClick={() => setIsExpanded(!isExpanded)}
        title="Click to see health breakdown"
      >
        <span className={`text-lg font-bold ${gradeStyle.text}`}>{grade}</span>
        <span className="text-xs text-white/60">Health</span>
        {isLoading && (
          <div className="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`rounded-2xl p-5 border ${gradeStyle.border} ${gradeStyle.bg} shadow-lg ${gradeStyle.glow}`}>
      {/* Header with Grade */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-xl ${gradeStyle.bg} border ${gradeStyle.border} flex items-center justify-center`}>
            <span className={`text-3xl font-black ${gradeStyle.text}`}>{grade}</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Pool Health Score</h3>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${gradeStyle.text}`}>
                {overallScore.toFixed(0)}/100
              </span>
              {isLoading && (
                <div className="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-white/60 hover:text-white transition-colors"
        >
          <svg 
            className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Score Bar */}
      <div className="mb-4">
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              overallScore >= 70 ? "bg-gradient-to-r from-emerald-500 to-teal-400" :
              overallScore >= 50 ? "bg-gradient-to-r from-yellow-500 to-amber-400" :
              "bg-gradient-to-r from-orange-500 to-red-400"
            }`}
            style={{ width: `${overallScore}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-white/40">
          <span>Poor</span>
          <span>Fair</span>
          <span>Good</span>
          <span>Excellent</span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="space-y-3 pt-4 border-t border-white/10 animate-in slide-in-from-top-2 duration-300">
          {healthFactors.map((factor) => (
            <div key={factor.name} className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{factor.icon}</span>
                  <span className="font-medium text-white">{factor.name}</span>
                  <span className="text-xs text-white/40">({factor.weight}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${STATUS_COLORS[factor.status]}`}>
                    {factor.score}
                  </span>
                  <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        factor.score >= 70 ? "bg-emerald-500" :
                        factor.score >= 50 ? "bg-yellow-500" :
                        "bg-red-500"
                      }`}
                      style={{ width: `${factor.score}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/60">{factor.description}</p>
            </div>
          ))}

          {/* Interpretation */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-xs text-white/60">
              {grade === "A+" || grade === "A" ? (
                <>🌟 <span className="text-emerald-400 font-medium">Excellent!</span> This pool shows strong fundamentals with healthy utilization, growing TVL, and minimal risk events.</>
              ) : grade === "B+" || grade === "B" ? (
                <>👍 <span className="text-cyan-400 font-medium">Good.</span> This pool is performing well overall. Minor areas could be improved but no major concerns.</>
              ) : grade === "C+" || grade === "C" ? (
                <>⚠️ <span className="text-yellow-400 font-medium">Fair.</span> Some risk factors present. Review the breakdown above before depositing large amounts.</>
              ) : (
                <>🚨 <span className="text-red-400 font-medium">Caution.</span> Multiple risk factors detected. Consider waiting for conditions to improve.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Collapsed Summary */}
      {!isExpanded && (
        <div className="flex justify-between text-xs text-white/60">
          <span>Click to see breakdown</span>
          <span>
            {healthFactors.filter(f => f.status === "excellent" || f.status === "good").length}/
            {healthFactors.length} factors healthy
          </span>
        </div>
      )}
    </div>
  );
}






