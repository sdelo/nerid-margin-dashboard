import { useState } from "react";
import { TransactionDetailsModal } from "./TransactionDetailsModal";
import type { TransactionInfo } from "./types";

export interface TransactionInfoIconProps {
  transactionInfo: TransactionInfo;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean; // New prop to disable the icon
}

/**
 * A button that opens the transaction details modal.
 * Shows users what the transaction will do before they approve it in their wallet.
 */
export function TransactionInfoIcon({
  transactionInfo,
  className = "",
  size = "md",
  disabled = false,
}: TransactionInfoIconProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const paddingClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2 text-sm",
  }[size];

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) {
            setIsModalOpen(true);
          }
        }}
        disabled={disabled}
        className={`inline-flex items-center gap-2 rounded-lg border transition-all font-medium ${
          disabled
            ? "border-gray-700 bg-gray-800/50 text-gray-500 cursor-not-allowed opacity-50"
            : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 hover:border-cyan-400/50"
        } ${paddingClasses} ${className}`}
        aria-label="Review transaction details"
        title={
          disabled
            ? "Enter an amount to review details"
            : "Review transaction details"
        }
        type="button"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span className="whitespace-nowrap">Review</span>
      </button>

      <TransactionDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onContinue={() => {
          // When opened from info icon, just close - user can click the main button to proceed
          setIsModalOpen(false);
        }}
        transactionInfo={transactionInfo}
        disabled={disabled}
      />
    </>
  );
}
