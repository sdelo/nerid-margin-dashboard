import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { DocumentDuplicateIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";

export type TransactionToastState = "pending" | "submitted" | "finalized" | "error";
export type TransactionActionType = "deposit" | "withdraw" | "liquidate";

interface TransactionToastProps {
  isVisible: boolean;
  onDismiss: () => void;
  state: TransactionToastState;
  actionType: TransactionActionType;
  amount?: string;
  asset?: string;
  poolName?: string;
  txDigest?: string;
  explorerUrl: string;
  error?: string | null;
  onViewActivity?: () => void;
  /** When true, shows a special celebration treatment for the first-ever deposit */
  isFirstDeposit?: boolean;
}

function truncateTxHash(hash: string): string {
  if (!hash || hash.length <= 12) return hash || "";
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function TransactionToast({
  isVisible,
  onDismiss,
  state,
  actionType,
  amount,
  asset,
  poolName,
  txDigest,
  explorerUrl,
  error,
  onViewActivity,
  isFirstDeposit = false,
}: TransactionToastProps) {
  const [copied, setCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Whether this is a first-deposit celebration moment
  const isCelebration = isFirstDeposit && state === "finalized" && actionType === "deposit";

  // Auto-dismiss after 6 seconds when finalized (unless paused)
  useEffect(() => {
    if (state === "finalized" && isVisible && !isPaused) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onDismiss, 300); // Wait for exit animation
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [state, isVisible, isPaused, onDismiss]);

  // Reset exit state when visibility changes
  useEffect(() => {
    if (isVisible) {
      setIsExiting(false);
    }
  }, [isVisible]);

  const handleCopyTxHash = useCallback(async () => {
    if (!txDigest) return;
    try {
      await navigator.clipboard.writeText(txDigest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
  }, [txDigest]);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  if (!isVisible) return null;

  const explorerTxUrl = txDigest ? `${explorerUrl}/txblock/${txDigest}` : "";
  const actionLabel = actionType === "deposit" ? "Deposit" : actionType === "withdraw" ? "Withdrawal" : "Liquidation";
  const actionPastTense = actionType === "deposit" ? "deposited" : actionType === "withdraw" ? "withdrawn" : "liquidated";

  // Build description line
  const description = amount && asset 
    ? `${amount} ${asset} ${actionPastTense}${poolName ? ` • ${poolName}` : ""}`
    : poolName || "";

  const toast = (
    <div
      className={`fixed z-[100] transition-all duration-300 ease-out
        top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[380px]
        ${isExiting ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0"}
      `}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="relative overflow-hidden rounded-xl border shadow-2xl backdrop-blur-md"
        style={{
          background: isCelebration
            ? "linear-gradient(135deg, rgba(15, 23, 42, 0.97) 0%, rgba(20, 16, 8, 0.97) 100%)"
            : "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 20, 30, 0.95) 100%)",
          borderColor: state === "error" 
            ? "rgba(239, 68, 68, 0.3)" 
            : isCelebration
              ? "rgba(251, 191, 36, 0.4)"
              : state === "finalized" 
                ? "rgba(16, 185, 129, 0.3)" 
                : "rgba(45, 212, 191, 0.2)",
          boxShadow: isCelebration
            ? "0 0 30px rgba(251, 191, 36, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.5)"
            : undefined,
        }}
      >
        {/* Progress bar for auto-dismiss */}
        {state === "finalized" && !isPaused && (
          <div 
            className={`absolute top-0 left-0 h-0.5 animate-[shrink_6s_linear_forwards] ${
              isCelebration ? "bg-amber-400/60" : "bg-emerald-500/50"
            }`}
            style={{ width: "100%" }}
          />
        )}

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Status icon */}
              {state === "pending" && (
                <div className="w-5 h-5 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {state === "submitted" && (
                <div className="w-5 h-5 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {state === "finalized" && (
                isCelebration ? (
                  <span className="text-lg animate-[scaleIn_200ms_ease-out]" role="img" aria-label="trophy">🏆</span>
                ) : (
                  <CheckCircleIcon className="w-5 h-5 text-emerald-400 animate-[scaleIn_200ms_ease-out]" />
                )
              )}
              {state === "error" && (
                <XCircleIcon className="w-5 h-5 text-red-400" />
              )}

              {/* Status text */}
              <div>
                <span className={`text-sm font-medium ${isCelebration ? "text-amber-300" : "text-white"}`}>
                  {state === "pending" && "Submitting transaction…"}
                  {state === "submitted" && "Transaction submitted"}
                  {state === "finalized" && (isCelebration ? "First deposit — welcome!" : `${actionLabel} finalized`)}
                  {state === "error" && "Transaction failed"}
                </span>
                {isCelebration && (
                  <span className="block text-[11px] text-amber-400/60 mt-0.5 animate-[fadeIn_500ms_ease-out_300ms_both]">
                    You're officially a Leva supplier ✨
                  </span>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="text-white/40 hover:text-white/70 transition-colors p-0.5 -mr-1 -mt-0.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Description */}
          {description && state !== "pending" && (
            <p className="text-xs text-white/50 mt-1 ml-[30px]">
              {description}
            </p>
          )}

          {/* Error message */}
          {state === "error" && error && (
            <p className="text-xs text-red-400/80 mt-1.5 ml-[30px] line-clamp-2">
              {error}
            </p>
          )}

          {/* Tx hash row */}
          {txDigest && state !== "pending" && (
            <div className="flex items-center gap-1.5 mt-2.5 ml-[30px]">
              <span className="text-[11px] text-white/40 font-mono">
                Tx {truncateTxHash(txDigest)}
              </span>
              <button
                onClick={handleCopyTxHash}
                className="p-1 rounded hover:bg-white/[0.06] transition-colors text-white/40 hover:text-white/70"
                title="Copy transaction hash"
              >
                {copied ? (
                  <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                )}
              </button>
              <span className="text-white/20">·</span>
              <a
                href={explorerTxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-white/40 hover:text-[#2dd4bf] transition-colors flex items-center gap-0.5"
              >
                Explorer
                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* View in Activity link */}
          {state === "finalized" && onViewActivity && (
            <button
              onClick={() => {
                onViewActivity();
                handleDismiss();
              }}
              className="text-[11px] text-[#2dd4bf]/70 hover:text-[#2dd4bf] transition-colors mt-2 ml-[30px]"
            >
              View in Activity →
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(toast, document.body);
}
