import { useState } from "react";
import { TransactionDetailsModal } from "./TransactionDetailsModal";
import type { TransactionButtonProps } from "./types";

export function TransactionButton({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  transactionInfo,
  onContinue,
}: TransactionButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleButtonClick = () => {
    if (!disabled) {
      setIsModalOpen(true);
    }
  };

  const handleContinue = () => {
    onContinue();
  };

  // Base button classes from your design system
  const baseClasses = "pill transition-all font-semibold";

  const variantClasses =
    variant === "primary"
      ? "bg-cyan-400 text-slate-900 hover:bg-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.4)]"
      : "bg-white/5 text-cyan-200 hover:bg-white/10 border border-white/20";

  const sizeClasses = {
    sm: "text-sm py-2 px-4",
    md: "text-base py-3 px-6",
    lg: "text-lg py-4 px-8",
  }[size];

  const disabledClasses = disabled
    ? "opacity-50 cursor-not-allowed"
    : "cursor-pointer";

  return (
    <>
      <button
        onClick={handleButtonClick}
        disabled={disabled}
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${disabledClasses} ${className}`}
      >
        {children}
      </button>

      <TransactionDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onContinue={handleContinue}
        transactionInfo={transactionInfo}
      />
    </>
  );
}






