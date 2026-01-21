import React from 'react';

export type ShockAsset = 'SUI' | 'DEEP' | 'ALL';

export interface ScenarioRange {
  min: number;
  max: number;
}

export interface ScenarioState {
  // Whether scenario mode is active
  isActive: boolean;
  // The asset being shocked
  shockAsset: ShockAsset;
  // The shock percentage (e.g., -12 for 12% drop)
  shockPct: number;
  // Optional range selection for brushing
  range: ScenarioRange | null;
}

export interface ScenarioContextValue extends ScenarioState {
  // Actions
  setShockAsset: (asset: ShockAsset) => void;
  setShockPct: (pct: number) => void;
  setRange: (range: ScenarioRange | null) => void;
  activateScenario: (pct: number) => void;
  resetScenario: () => void;
  toggleScenarioMode: () => void;
}

const defaultState: ScenarioState = {
  isActive: false,
  shockAsset: 'SUI',
  shockPct: 0,
  range: null,
};

const ScenarioContext = React.createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ScenarioState>(defaultState);

  const setShockAsset = React.useCallback((asset: ShockAsset) => {
    setState(prev => ({ ...prev, shockAsset: asset }));
  }, []);

  const setShockPct = React.useCallback((pct: number) => {
    setState(prev => ({ ...prev, shockPct: pct, isActive: pct !== 0 }));
  }, []);

  const setRange = React.useCallback((range: ScenarioRange | null) => {
    setState(prev => ({ ...prev, range }));
  }, []);

  const activateScenario = React.useCallback((pct: number) => {
    setState(prev => ({ ...prev, isActive: true, shockPct: pct, range: null }));
  }, []);

  const resetScenario = React.useCallback(() => {
    setState(prev => ({ ...prev, isActive: false, shockPct: 0, range: null }));
  }, []);

  const toggleScenarioMode = React.useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isActive: !prev.isActive,
      shockPct: prev.isActive ? 0 : prev.shockPct,
      range: prev.isActive ? null : prev.range,
    }));
  }, []);

  const value = React.useMemo(() => ({
    ...state,
    setShockAsset,
    setShockPct,
    setRange,
    activateScenario,
    resetScenario,
    toggleScenarioMode,
  }), [state, setShockAsset, setShockPct, setRange, activateScenario, resetScenario, toggleScenarioMode]);

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario(): ScenarioContextValue {
  const context = React.useContext(ScenarioContext);
  if (!context) {
    throw new Error('useScenario must be used within a ScenarioProvider');
  }
  return context;
}

/**
 * Simulate a position at a given price shock
 */
export interface SimulatedPosition {
  // Original position values
  originalBuffer: number;
  originalHealthFactor: number;
  // Simulated values at shock
  simulatedBuffer: number;
  simulatedHealthFactor: number;
  // Impact assessment
  wouldLiquidate: boolean;
  impact: 'SAFE' | 'WATCH' | 'LIQ';
  bufferDelta: number;
  healthFactorDelta: number;
}

/**
 * Simulate what happens to a position if price changes
 */
export function simulatePositionAtShock(
  position: {
    baseAssetUsd: number;
    quoteAssetUsd: number;
    baseDebtUsd: number;
    quoteDebtUsd: number;
    riskRatio: number;
    liquidationThreshold: number;
    distanceToLiquidation: number;
    isLiquidatable: boolean;
    baseAssetSymbol: string;
  },
  shockPct: number,
  shockAsset: ShockAsset
): SimulatedPosition {
  // Determine which asset(s) to shock
  const shouldShockBase = 
    shockAsset === 'ALL' || 
    shockAsset === position.baseAssetSymbol;

  const basePriceMultiplier = shouldShockBase ? 1 + shockPct / 100 : 1;
  
  // Calculate new values
  const newBaseAssetUsd = position.baseAssetUsd * basePriceMultiplier;
  const newQuoteAssetUsd = position.quoteAssetUsd;
  const newBaseDebtUsd = position.baseDebtUsd * basePriceMultiplier;
  const newQuoteDebtUsd = position.quoteDebtUsd;

  const newCollateralValueUsd = newBaseAssetUsd + newQuoteAssetUsd;
  const newDebtValueUsd = newBaseDebtUsd + newQuoteDebtUsd;

  const newRiskRatio = newDebtValueUsd > 0 ? newCollateralValueUsd / newDebtValueUsd : 999;
  const newDistanceToLiquidation = ((newRiskRatio - position.liquidationThreshold) / position.liquidationThreshold) * 100;
  const wouldLiquidate = newRiskRatio <= position.liquidationThreshold;

  // Determine impact category
  let impact: 'SAFE' | 'WATCH' | 'LIQ';
  if (wouldLiquidate) {
    impact = 'LIQ';
  } else if (newDistanceToLiquidation < 15) {
    impact = 'WATCH';
  } else {
    impact = 'SAFE';
  }

  return {
    originalBuffer: position.distanceToLiquidation,
    originalHealthFactor: position.riskRatio,
    simulatedBuffer: newDistanceToLiquidation,
    simulatedHealthFactor: newRiskRatio,
    wouldLiquidate,
    impact,
    bufferDelta: newDistanceToLiquidation - position.distanceToLiquidation,
    healthFactorDelta: newRiskRatio - position.riskRatio,
  };
}

/**
 * Aggregate simulation results for multiple positions
 */
export interface ScenarioSummary {
  liquidatableCount: number;
  debtAtRiskUsd: number;
  collateralAtRiskUsd: number;
  firstLiquidationAt: number | null;
  newLiquidations: number; // positions that weren't liquidatable but would be
}

export function simulateAllPositions(
  positions: Array<{
    baseAssetUsd: number;
    quoteAssetUsd: number;
    baseDebtUsd: number;
    quoteDebtUsd: number;
    totalDebtUsd: number;
    riskRatio: number;
    liquidationThreshold: number;
    distanceToLiquidation: number;
    isLiquidatable: boolean;
    baseAssetSymbol: string;
  }>,
  shockPct: number,
  shockAsset: ShockAsset
): ScenarioSummary {
  let liquidatableCount = 0;
  let debtAtRiskUsd = 0;
  let collateralAtRiskUsd = 0;
  let newLiquidations = 0;

  positions.forEach((position) => {
    const simulation = simulatePositionAtShock(position, shockPct, shockAsset);
    
    if (simulation.wouldLiquidate) {
      liquidatableCount++;
      
      // Calculate simulated collateral value
      const shouldShockBase = shockAsset === 'ALL' || shockAsset === position.baseAssetSymbol;
      const basePriceMultiplier = shouldShockBase ? 1 + shockPct / 100 : 1;
      const newBaseDebtUsd = position.baseDebtUsd * basePriceMultiplier;
      const debtValue = newBaseDebtUsd + position.quoteDebtUsd;
      const newBaseAssetUsd = position.baseAssetUsd * basePriceMultiplier;
      const collateralValue = newBaseAssetUsd + position.quoteAssetUsd;
      
      debtAtRiskUsd += debtValue;
      collateralAtRiskUsd += collateralValue;
      
      if (!position.isLiquidatable) {
        newLiquidations++;
      }
    }
  });

  // Calculate first liquidation point
  let firstLiquidationAt: number | null = null;
  positions.forEach((position) => {
    if (position.isLiquidatable) return;
    
    // Simple estimation - find the price change that would trigger liquidation
    const netBaseExposure = position.baseAssetUsd - position.baseDebtUsd;
    if (Math.abs(netBaseExposure) > 0.01) {
      const collateral = position.baseAssetUsd + position.quoteAssetUsd;
      const debt = position.baseDebtUsd + position.quoteDebtUsd;
      const targetCollateral = position.liquidationThreshold * debt;
      const changeNeeded = (targetCollateral - collateral) / netBaseExposure;
      const pctChange = changeNeeded * 100;
      
      if (pctChange < 0 && (firstLiquidationAt === null || pctChange > firstLiquidationAt)) {
        firstLiquidationAt = pctChange;
      }
    }
  });

  return {
    liquidatableCount,
    debtAtRiskUsd,
    collateralAtRiskUsd,
    firstLiquidationAt,
    newLiquidations,
  };
}
