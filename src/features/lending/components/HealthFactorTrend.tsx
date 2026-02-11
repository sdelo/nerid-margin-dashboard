import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  useAtRiskPositions,
  type AtRiskPosition,
} from "../../../hooks/useAtRiskPositions";
import { fetchOHLCV, parseCandles } from "../api/marketData";
import type { PoolOverview } from "../types";
import {
  useChartFirstRender,
  useStableGradientId,
} from "../../../components/charts/StableChart";
import { type TimeRange } from "../api/types";
import TimeRangeSelector from "../../../components/TimeRangeSelector";
import { ErrorIcon } from "../../../components/ThemedIcons";

interface HealthFactorTrendProps {
  pool: PoolOverview;
}

interface StressTestPoint {
  price: number;
  pctChange: number;
  worstHF: number;
  medianHF: number;
  positionsAtRisk: number;
}

/**
 * Liquidation Stress Test: simulate current positions at different
 * price levels to show how sensitive the pool is to price moves.
 *
 * X-axis = base-asset price, Y-axis = health factor.
 * Answers: "At what price do positions start getting liquidated?"
 */
export function HealthFactorTrend({ pool }: HealthFactorTrendProps) {
  const baseMarginPoolId = pool.contracts?.marginPoolId;
  const { positions: allPositions, isLoading: positionsLoading } =
    useAtRiskPositions();

  const [timeRange, setTimeRange] = React.useState<TimeRange>("1M");
  const [chartData, setChartData] = React.useState<StressTestPoint[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { animationProps } = useChartFirstRender(chartData.length > 0);
  const hfGradientId = useStableGradientId("hfStressGradient");

  // Filter positions for this pool
  const poolPositions = React.useMemo(() => {
    if (!baseMarginPoolId) return allPositions;
    return allPositions.filter(
      (p) =>
        p.baseMarginPoolId === baseMarginPoolId ||
        p.quoteMarginPoolId === baseMarginPoolId
    );
  }, [allPositions, baseMarginPoolId]);

  const liquidationThreshold = poolPositions[0]?.liquidationThreshold ?? 1.05;

  const debtPositions = React.useMemo(
    () => poolPositions.filter((p) => p.totalDebtUsd > 0),
    [poolPositions]
  );

  // Get current base price
  const currentPrice = React.useMemo(() => {
    const first = poolPositions[0];
    if (!first?.basePythPrice) return 0;
    return (
      first.basePythPrice /
      Math.pow(10, Math.abs(first.basePythDecimals || 0))
    );
  }, [poolPositions]);

  // Direct computation of current worst HF (not dependent on chart data)
  const currentWorstHF = React.useMemo(() => {
    if (debtPositions.length === 0) return 0;
    return Math.min(
      ...debtPositions.map(
        (p) => (p.baseAssetUsd + p.quoteAssetUsd) / p.totalDebtUsd
      )
    );
  }, [debtPositions]);

  // Fetch historical prices to get realistic price range, then compute stress test
  React.useEffect(() => {
    const isStable = pool.asset === "USDC" || pool.asset === "DBUSDC";
    if (poolPositions.length === 0 || isStable || currentPrice === 0) {
      setIsLoading(false);
      setChartData([]);
      return;
    }

    let cancelled = false;

    async function computeStressTest() {
      try {
        setIsLoading(true);
        setError(null);

        const limitMap: Record<string, number> = {
          "1W": 7,
          "1M": 30,
          "3M": 90,
          YTD: 180,
          ALL: 365,
        };
        const limit = limitMap[timeRange] || 30;

        // Fetch historical candles to determine realistic price range
        let candles: Awaited<ReturnType<typeof fetchOHLCV>> = [];
        const pairName = `${pool.asset}_USDC`;
        try {
          candles = await fetchOHLCV(pairName, { interval: "1d", limit });
        } catch {
          try {
            candles = await fetchOHLCV(`${pool.asset}_SUI`, {
              interval: "1d",
              limit,
            });
          } catch {
            // Neither pair exists
          }
        }
        if (cancelled) return;

        const parsed = parseCandles(candles);
        if (parsed.length === 0) {
          setChartData([]);
          return;
        }

        const positions = poolPositions.filter((p) => p.totalDebtUsd > 0);
        if (positions.length === 0) {
          setChartData([]);
          return;
        }

        // Determine price range from historical data
        const historicalPrices = parsed.map((c) => c.close);
        const minHistorical = Math.min(...historicalPrices);
        const maxHistorical = Math.max(...historicalPrices);

        // Extend range beyond historical for scenario planning
        const lowerBound = Math.min(minHistorical * 0.7, currentPrice * 0.5);
        const upperBound = Math.max(maxHistorical, currentPrice) * 1.3;
        const numPoints = 80;
        const step = (upperBound - lowerBound) / (numPoints - 1);
        const cap = 5;

        const data: StressTestPoint[] = [];
        for (let i = 0; i < numPoints; i++) {
          const price = lowerBound + i * step;
          const priceRatio = price / currentPrice;
          const pctChange = ((price - currentPrice) / currentPrice) * 100;

          const simulatedHFs = positions.map((pos) => {
            const newBaseAssetUsd = pos.baseAssetUsd * priceRatio;
            const newBaseDebtUsd = pos.baseDebtUsd * priceRatio;
            const newCollateral = newBaseAssetUsd + pos.quoteAssetUsd;
            const newDebt = newBaseDebtUsd + pos.quoteDebtUsd;
            return newDebt > 0 ? newCollateral / newDebt : 999;
          });

          const sorted = [...simulatedHFs].sort((a, b) => a - b);
          data.push({
            price: parseFloat(price.toFixed(4)),
            pctChange: parseFloat(pctChange.toFixed(1)),
            worstHF: Math.min(sorted[0], cap),
            medianHF: Math.min(
              sorted[Math.floor(sorted.length / 2)],
              cap
            ),
            positionsAtRisk: simulatedHFs.filter(
              (hf) => hf <= liquidationThreshold
            ).length,
          });
        }

        if (!cancelled) setChartData(data);
      } catch (err) {
        console.warn("Error computing stress test:", err);
        if (!cancelled) {
          setError("Could not fetch price data for stress testing");
          setChartData([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    computeStressTest();
    return () => {
      cancelled = true;
    };
  }, [poolPositions, pool.asset, timeRange, currentPrice, liquidationThreshold]);

  // Stress test stats
  const stats = React.useMemo(() => {
    if (chartData.length === 0 || currentPrice === 0) {
      return {
        liquidationPrice: null as number | null,
        buffer: null as number | null,
        atRisk20: 0,
        atRisk30: 0,
      };
    }

    // Find liquidation price: where worst HF crosses above the threshold
    // (data sorted by price ascending, so we scan left-to-right)
    let liquidationPrice: number | null = null;
    for (let i = 0; i < chartData.length - 1; i++) {
      if (
        chartData[i].worstHF < liquidationThreshold &&
        chartData[i + 1].worstHF >= liquidationThreshold
      ) {
        // Linear interpolation for precise crossing point
        const ratio =
          (liquidationThreshold - chartData[i].worstHF) /
          (chartData[i + 1].worstHF - chartData[i].worstHF);
        liquidationPrice =
          chartData[i].price +
          ratio * (chartData[i + 1].price - chartData[i].price);
        break;
      }
    }

    const buffer =
      liquidationPrice !== null
        ? ((currentPrice - liquidationPrice) / currentPrice) * 100
        : null;

    // Scenario analysis: how many positions at risk at given % drops
    const findAtRisk = (pctDrop: number) => {
      const targetPrice = currentPrice * (1 - pctDrop / 100);
      const closest = chartData.reduce((c, d) =>
        Math.abs(d.price - targetPrice) < Math.abs(c.price - targetPrice)
          ? d
          : c
      );
      return closest.positionsAtRisk;
    };

    return {
      liquidationPrice,
      buffer,
      atRisk20: findAtRisk(20),
      atRisk30: findAtRisk(30),
    };
  }, [chartData, currentPrice, liquidationThreshold]);

  // ─── Early returns ────────────────────────────────────────────────────

  const isStable = pool.asset === "USDC" || pool.asset === "DBUSDC";

  if (isStable) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Liquidation Stress Test
          </h2>
          <p className="text-sm text-white/60">
            Price sensitivity analysis for {pool.asset} positions
          </p>
        </div>
        <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center">
          <div className="text-4xl mb-3">📊</div>
          <div className="text-white/60 text-sm">
            Stress tests are driven by base-asset price volatility. Since{" "}
            {pool.asset} is a stablecoin, HFs remain stable relative to price.
          </div>
        </div>
      </div>
    );
  }

  if (positionsLoading && poolPositions.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Liquidation Stress Test
          </h2>
        </div>
        <div className="h-72 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full" />
            <div className="text-white/60">Loading positions...</div>
          </div>
        </div>
      </div>
    );
  }

  if (poolPositions.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Liquidation Stress Test
          </h2>
          <p className="text-sm text-white/60">
            Price sensitivity analysis for {pool.asset} positions
          </p>
        </div>
        <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-white font-semibold text-lg mb-1">
            No Open Positions
          </div>
          <div className="text-white/60 text-sm">
            Stress testing requires active borrowing positions. Currently zero
            counterparty risk.
          </div>
        </div>
      </div>
    );
  }

  const formatHF = (v: number) => (v >= 5 ? "5+" : v.toFixed(2));
  const formatPrice = (v: number) =>
    v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">
            Liquidation Stress Test
          </h2>
          <p className="text-sm text-white/60">
            How do current positions' HFs respond to {pool.asset} price changes?
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Current Worst HF */}
        <div
          className={`bg-white/5 rounded-2xl p-4 border ${
            currentWorstHF <= liquidationThreshold
              ? "border-rose-500/30"
              : currentWorstHF <= liquidationThreshold * 1.15
                ? "border-amber-500/30"
                : "border-emerald-500/30"
          }`}
        >
          <div className="text-sm text-white/60 mb-1">Worst HF Now</div>
          <div
            className={`text-xl font-bold font-mono ${
              currentWorstHF <= liquidationThreshold
                ? "text-rose-400"
                : currentWorstHF <= liquidationThreshold * 1.15
                  ? "text-amber-400"
                  : "text-emerald-400"
            }`}
          >
            {formatHF(currentWorstHF)}
          </div>
          <div className="text-xs text-white/40 mt-1">
            liq @ {liquidationThreshold.toFixed(2)}
          </div>
        </div>

        {/* Liquidation Price */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">Liq Price</div>
          <div className="text-xl font-bold font-mono text-rose-400">
            {stats.liquidationPrice
              ? formatPrice(stats.liquidationPrice)
              : currentWorstHF <= liquidationThreshold
                ? "Now"
                : "—"}
          </div>
          <div className="text-xs text-white/40 mt-1">
            {stats.liquidationPrice
              ? `${pool.asset} triggers liq`
              : currentWorstHF <= liquidationThreshold
                ? "already at risk"
                : "safe in range"}
          </div>
        </div>

        {/* Price Buffer */}
        <div
          className={`bg-white/5 rounded-2xl p-4 border ${
            stats.buffer === null
              ? currentWorstHF <= liquidationThreshold
                ? "border-rose-500/30"
                : "border-emerald-500/30"
              : stats.buffer < 10
                ? "border-rose-500/30"
                : stats.buffer < 25
                  ? "border-amber-500/30"
                  : "border-emerald-500/30"
          }`}
        >
          <div className="text-sm text-white/60 mb-1">Price Buffer</div>
          <div
            className={`text-xl font-bold font-mono ${
              stats.buffer === null
                ? currentWorstHF <= liquidationThreshold
                  ? "text-rose-400"
                  : "text-emerald-400"
                : stats.buffer < 10
                  ? "text-rose-400"
                  : stats.buffer < 25
                    ? "text-amber-400"
                    : "text-emerald-400"
            }`}
          >
            {stats.buffer !== null
              ? `${stats.buffer.toFixed(0)}%`
              : currentWorstHF <= liquidationThreshold
                ? "0%"
                : "Safe"}
          </div>
          <div className="text-xs text-white/40 mt-1">drop to liquidation</div>
        </div>

        {/* At -20% */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">If −20%</div>
          <div
            className={`text-xl font-bold ${
              stats.atRisk20 > 0 ? "text-amber-400" : "text-emerald-400"
            }`}
          >
            {stats.atRisk20}
            <span className="text-sm font-normal text-white/40">
              /{debtPositions.length}
            </span>
          </div>
          <div className="text-xs text-white/40 mt-1">positions at risk</div>
        </div>

        {/* At -30% */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-sm text-white/60 mb-1">If −30%</div>
          <div
            className={`text-xl font-bold ${
              stats.atRisk30 > 0
                ? stats.atRisk30 > debtPositions.length / 2
                  ? "text-rose-400"
                  : "text-amber-400"
                : "text-emerald-400"
            }`}
          >
            {stats.atRisk30}
            <span className="text-sm font-normal text-white/40">
              /{debtPositions.length}
            </span>
          </div>
          <div className="text-xs text-white/40 mt-1">positions at risk</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-cyan-200 mb-4">
          Health Factor vs {pool.asset} Price
        </h3>

        {isLoading && chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin h-8 w-8 border-3 border-cyan-500 border-t-transparent rounded-full" />
              <div className="text-white/60">Computing stress test...</div>
            </div>
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-2 flex justify-center">
                <ErrorIcon size={32} />
              </div>
              <div className="text-red-300 font-semibold mb-1">{error}</div>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">📉</div>
              <div className="text-white/60 text-sm">
                No price data available for stress testing.
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
            >
              <defs>
                <linearGradient
                  id={hfGradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.1)"
              />
              <XAxis
                dataKey="price"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatPrice}
                tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickCount={8}
                label={{
                  value: `${pool.asset} Price`,
                  position: "insideBottom",
                  fill: "rgba(255,255,255,0.4)",
                  fontSize: 12,
                  offset: -10,
                }}
              />
              <YAxis
                yAxisId="hf"
                orientation="left"
                tickFormatter={formatHF}
                tick={{ fill: "#22d3ee", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
                domain={[0, "auto"]}
                label={{
                  value: "Health Factor",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#22d3ee",
                  fontSize: 12,
                  fontWeight: 500,
                  offset: 5,
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0].payload as StressTestPoint;
                  return (
                    <div
                      style={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "12px",
                        padding: "12px",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                      }}
                    >
                      <div
                        style={{
                          color: "#fff",
                          fontWeight: "bold",
                          marginBottom: 6,
                        }}
                      >
                        {pool.asset} at {formatPrice(d.price)}
                      </div>
                      <div
                        style={{
                          color: d.pctChange >= 0 ? "#4ade80" : "#f87171",
                          fontSize: 12,
                          marginBottom: 8,
                        }}
                      >
                        {d.pctChange >= 0 ? "+" : ""}
                        {d.pctChange.toFixed(1)}% from current
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#f59e0b",
                          marginBottom: 2,
                        }}
                      >
                        Worst HF: {formatHF(d.worstHF)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#22d3ee",
                          marginBottom: 2,
                        }}
                      >
                        Median HF: {formatHF(d.medianHF)}
                      </div>
                      {d.positionsAtRisk > 0 && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#f43f5e",
                            marginTop: 4,
                          }}
                        >
                          ⚠ {d.positionsAtRisk} position
                          {d.positionsAtRisk > 1 ? "s" : ""} at risk
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "16px" }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    worstHF: "Worst HF",
                    medianHF: "Median HF",
                  };
                  return (
                    <span className="text-white/80 text-sm">
                      {labels[value] || value}
                    </span>
                  );
                }}
              />

              {/* Danger zone below liquidation threshold */}
              <ReferenceArea
                yAxisId="hf"
                y1={0}
                y2={liquidationThreshold}
                fill="#f43f5e"
                fillOpacity={0.06}
              />

              {/* Liquidation threshold line */}
              <ReferenceLine
                yAxisId="hf"
                y={liquidationThreshold}
                stroke="#f43f5e"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `Liq ${liquidationThreshold.toFixed(2)}`,
                  position: "right",
                  fill: "#f43f5e",
                  fontSize: 10,
                }}
              />

              {/* Current price marker */}
              <ReferenceLine
                yAxisId="hf"
                x={currentPrice}
                stroke="rgba(255,255,255,0.5)"
                strokeDasharray="4 3"
                strokeWidth={1}
                label={{
                  value: `Now ${formatPrice(currentPrice)}`,
                  position: "top",
                  fill: "rgba(255,255,255,0.7)",
                  fontSize: 10,
                }}
              />

              {/* Liquidation price marker */}
              {stats.liquidationPrice && (
                <ReferenceLine
                  yAxisId="hf"
                  x={stats.liquidationPrice}
                  stroke="#f43f5e"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: `Liq ${formatPrice(stats.liquidationPrice)}`,
                    position: "insideTopLeft",
                    fill: "#f43f5e",
                    fontSize: 10,
                  }}
                />
              )}

              {/* Median HF (area fill) */}
              <Area
                yAxisId="hf"
                type="monotone"
                dataKey="medianHF"
                stroke="#22d3ee"
                strokeWidth={1.5}
                fill={`url(#${hfGradientId})`}
                name="medianHF"
                {...animationProps}
              />

              {/* Worst HF line */}
              <Line
                yAxisId="hf"
                type="monotone"
                dataKey="worstHF"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="worstHF"
                {...animationProps}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Insight Box */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
          What This Tells You
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-white/60">
          <div>
            <span className="text-white/80 font-medium">Stress Test</span>
            <p className="mt-1">
              Simulates today's {debtPositions.length} open position
              {debtPositions.length > 1 ? "s" : ""} at different {pool.asset}{" "}
              prices. Shows what health factors <em>would be</em> if{" "}
              {pool.asset} moved to each price level. The price range covers{" "}
              {timeRange} of historical prices, extended ±30%.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">
              Reading the Chart
            </span>
            <p className="mt-1">
              The white dashed line marks today's price. To its left: what
              happens if {pool.asset} drops. The red shaded zone shows where
              positions get liquidated. The gap between worst (amber) and median
              (blue) HF reveals concentration risk — a large gap means one
              position is much riskier than the rest.
            </p>
          </div>
          <div>
            <span className="text-white/80 font-medium">Key Risk</span>
            <p className="mt-1">
              {stats.buffer !== null && stats.buffer < 30 ? (
                <>
                  The worst position is only a{" "}
                  <strong className="text-rose-400">
                    {stats.buffer.toFixed(0)}%
                  </strong>{" "}
                  price drop away from liquidation
                  {stats.liquidationPrice && (
                    <>
                      {" "}
                      (at {formatPrice(stats.liquidationPrice)})
                    </>
                  )}
                  . {pool.asset} has moved more than this in the selected
                  period.
                </>
              ) : stats.buffer !== null ? (
                <>
                  A {stats.buffer.toFixed(0)}% price drop would trigger the
                  first liquidation. This is a comfortable buffer for typical{" "}
                  {pool.asset} volatility.
                </>
              ) : currentWorstHF <= liquidationThreshold ? (
                <>
                  The worst position is <em>already</em> below the liquidation
                  threshold. Liquidation is imminent or in progress.
                </>
              ) : (
                <>
                  All positions remain above the liquidation threshold across
                  the entire tested price range. Current positions are
                  well-collateralized.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
