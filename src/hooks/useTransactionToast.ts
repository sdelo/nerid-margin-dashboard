import { useState, useCallback } from "react";
import type {
  TransactionToastState,
  TransactionActionType,
} from "../components/TransactionToast";

export type UseTransactionToastReturn = {
  /** Whether the toast is currently visible */
  isVisible: boolean;
  /** Current toast lifecycle state */
  state: TransactionToastState;
  /** Transaction digest (set after submission) */
  digest: string;
  /** The action type (deposit / withdraw) */
  actionType: TransactionActionType;
  /** Formatted amount string shown in the toast */
  amount: string;
  /** Show the toast in pending state for a new transaction */
  show: (action: TransactionActionType, amount: string) => void;
  /** Update the transaction digest (transitions to submitted) */
  setSubmitted: (digest: string) => void;
  /** Mark the transaction as finalized (success) */
  setFinalized: () => void;
  /** Mark the transaction as failed */
  setError: () => void;
  /** Dismiss the toast and optionally reset status */
  dismiss: () => { shouldResetTxStatus: boolean };
};

/**
 * Manages the TransactionToast lifecycle state.
 *
 * Lifecycle: show() → setSubmitted(digest) → setFinalized() | setError()
 *
 * Keeps toast state isolated from the transaction execution logic so
 * PoolsPage doesn't need 5+ useState calls for toast management.
 */
export function useTransactionToast(): UseTransactionToastReturn {
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<TransactionToastState>("pending");
  const [digest, setDigest] = useState("");
  const [actionType, setActionType] = useState<TransactionActionType>("deposit");
  const [amount, setAmount] = useState("");

  const show = useCallback(
    (action: TransactionActionType, amt: string) => {
      setActionType(action);
      setAmount(amt);
      setDigest("");
      setState("pending");
      setIsVisible(true);
    },
    []
  );

  const setSubmitted = useCallback((txDigest: string) => {
    setDigest(txDigest);
    setState("submitted");
  }, []);

  const setFinalized = useCallback(() => {
    setState("finalized");
  }, []);

  const setError = useCallback(() => {
    setState("error");
  }, []);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    // Tell caller whether tx status should be reset
    const shouldReset = state === "finalized" || state === "error";
    return { shouldResetTxStatus: shouldReset };
  }, [state]);

  return {
    isVisible,
    state,
    digest,
    actionType,
    amount,
    show,
    setSubmitted,
    setFinalized,
    setError,
    dismiss,
  };
}
