import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { TransactionDetailsModalProps } from "./types";

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function TransactionDetailsModal({
  isOpen,
  onClose,
  onContinue,
  transactionInfo,
  disabled = false,
}: TransactionDetailsModalProps) {
  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleContinue = () => {
    onClose();
    onContinue();
  };

  const modal = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
      />

      {/* Modal - More compact */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="border border-cyan-500/20 rounded-xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pointer-events-auto animate-[modalEnter_150ms_ease-out]"
          style={{ background: 'linear-gradient(180deg, #0c1a24 0%, #0a1419 100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Compact */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20">
            <h2 className="text-sm font-medium text-cyan-100 flex items-center gap-1.5">
              🔍 Review Transaction
            </h2>
            <button
              onClick={onClose}
              className="text-cyan-200/50 hover:text-cyan-100 transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-cyan-500/10"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Action Summary - Compact */}
            <div className="bg-cyan-900/30 rounded-lg p-3 border border-cyan-500/20">
              <div className="text-xs text-cyan-200/50 mb-1">Action</div>
              <div className="text-sm font-medium text-cyan-300">{transactionInfo.action}</div>
              {transactionInfo.arguments && transactionInfo.arguments.length > 0 && (
                <div className="mt-2 pt-2 border-t border-cyan-500/20 space-y-1">
                  {transactionInfo.arguments.map((arg, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-cyan-200/50">{arg.name}</span>
                      <span className="text-cyan-100 font-mono">{arg.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contract Info - Compact grid */}
            <div className="bg-cyan-900/30 rounded-lg p-3 border border-cyan-500/20">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-cyan-200/50 mb-0.5">Package</div>
                  <div className="font-mono text-cyan-100">{truncateAddress(transactionInfo.packageId)}</div>
                </div>
                <div>
                  <div className="text-cyan-200/50 mb-0.5">Function</div>
                  <div className="font-mono text-cyan-400">{transactionInfo.module}::{transactionInfo.function}</div>
                </div>
              </div>
              <p className="text-xs text-cyan-200/60 mt-2 leading-relaxed">{transactionInfo.summary}</p>
              <a
                href={transactionInfo.sourceCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 mt-2 inline-flex items-center gap-1"
              >
                View source ↗
              </a>
            </div>

            {/* Verify - Compact */}
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3">
              <div className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1">
                ✓ Verify in wallet
              </div>
              <div className="text-xs text-cyan-200 space-y-1">
                <div className="flex gap-2"><span className="text-emerald-500">1.</span> Package: <span className="font-mono text-cyan-100">{truncateAddress(transactionInfo.packageId)}</span></div>
                <div className="flex gap-2"><span className="text-emerald-500">2.</span> Function: <span className="font-mono text-cyan-400">{transactionInfo.function}</span></div>
                {transactionInfo.arguments?.slice(0, 2).map((arg, idx) => (
                  <div key={idx} className="flex gap-2"><span className="text-emerald-500">{idx + 3}.</span> {arg.name}: <span className="font-mono text-cyan-100">{arg.value}</span></div>
                ))}
              </div>
            </div>

            {/* Warning - Compact */}
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-teal-400 text-sm">⚠️</span>
              <p className="text-xs text-amber-200">If details don't match your wallet, reject the transaction.</p>
            </div>
          </div>

          {/* Footer - Compact */}
          <div className="flex gap-2 p-4 pt-0">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-cyan-500/20 text-cyan-200/60 hover:bg-cyan-500/10 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={disabled}
              className={`flex-1 px-4 py-2 rounded-lg transition-all text-sm font-semibold ${
                disabled
                  ? "bg-cyan-900/30 text-cyan-200/40 cursor-not-allowed"
                  : "bg-cyan-500 text-slate-900 hover:bg-cyan-400"
              }`}
            >
              {disabled ? "Enter Amount" : "Continue →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
