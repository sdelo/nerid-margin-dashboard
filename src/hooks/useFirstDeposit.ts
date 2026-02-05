import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "leva_first_deposit_completed";

/**
 * Reads the set of wallet addresses that have completed at least one deposit
 * from localStorage.
 */
function getCompletedAddresses(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistAddresses(addresses: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...addresses]));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export type UseFirstDepositReturn = {
  /**
   * True when the connected wallet has *never* completed a deposit before.
   * Becomes `false` after `markDepositComplete()` is called.
   */
  isFirstDeposit: boolean;
  /** Call this when a deposit is finalized to record the achievement. */
  markDepositComplete: () => void;
  /** Whether confetti should currently be displayed */
  showConfetti: boolean;
  /** Call when confetti animation ends */
  onConfettiComplete: () => void;
};

/**
 * Tracks whether the current wallet address has ever completed a deposit.
 * Uses localStorage so the celebration only fires once per wallet, ever.
 */
export function useFirstDeposit(
  walletAddress: string | undefined
): UseFirstDepositReturn {
  const [isFirstDeposit, setIsFirstDeposit] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Re-evaluate whenever wallet changes
  useEffect(() => {
    if (!walletAddress) {
      setIsFirstDeposit(false);
      return;
    }
    const completed = getCompletedAddresses();
    setIsFirstDeposit(!completed.has(walletAddress));
  }, [walletAddress]);

  const markDepositComplete = useCallback(() => {
    if (!walletAddress) return;

    const completed = getCompletedAddresses();
    const wasFirst = !completed.has(walletAddress);

    if (wasFirst) {
      // Trigger confetti!
      setShowConfetti(true);

      // Persist so it never fires again for this wallet
      completed.add(walletAddress);
      persistAddresses(completed);
      setIsFirstDeposit(false);
    }
  }, [walletAddress]);

  const onConfettiComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  return {
    isFirstDeposit,
    markDepositComplete,
    showConfetti,
    onConfettiComplete,
  };
}
