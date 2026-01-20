import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircleIcon, DocumentDuplicateIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolidIcon } from "@heroicons/react/24/solid";

export type TransactionStatusState = "submitted" | "finalized" | "error";
export type TransactionActionType = "deposit" | "withdraw";

interface TransactionStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: TransactionStatusState;
  actionType: TransactionActionType;
  txDigest: string;
  explorerUrl: string;
  error?: string | null;
}

function truncateTxHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function TransactionStatusModal({
  isOpen,
  onClose,
  status,
  actionType,
  txDigest,
  explorerUrl,
  error,
}: TransactionStatusModalProps) {
  const [copied, setCopied] = useState(false);

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

  // Reset copied state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyTxHash = async () => {
    try {
      await navigator.clipboard.writeText(txDigest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  const explorerTxUrl = `${explorerUrl}/txblock/${txDigest}`;
  const actionLabel = actionType === "deposit" ? "Deposit" : "Withdrawal";

  const modal = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-[fadeIn_150ms_ease-out]"
        onClick={status === "finalized" ? onClose : undefined}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="border border-cyan-500/20 rounded-xl shadow-2xl w-full max-w-sm pointer-events-auto animate-[modalEnter_150ms_ease-out]"
          style={{ background: 'linear-gradient(180deg, #0c1a24 0%, #0a1419 100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Content based on status */}
          {status === "submitted" && (
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#2dd4bf]/10 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin" />
                </div>
                <h2 className="text-lg font-semibold text-white">
                  Transaction submitted
                </h2>
              </div>

              {/* Tx Hash */}
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Tx:</span>
                    <span className="text-sm font-mono text-white">
                      {truncateTxHash(txDigest)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopyTxHash}
                      className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors text-white/50 hover:text-white"
                      title="Copy transaction hash"
                    >
                      {copied ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={explorerTxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors text-white/50 hover:text-[#2dd4bf]"
                      title="View on explorer"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Subtext */}
              <p className="text-sm text-white/50 text-center">
                Waiting for finality…
              </p>
            </div>
          )}

          {status === "finalized" && (
            <div className="p-6 space-y-4">
              {/* Header with checkmark */}
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-500/10 flex items-center justify-center animate-[scaleIn_300ms_ease-out]">
                  <CheckCircleSolidIcon className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">
                  {actionLabel} complete
                </h2>
              </div>

              {/* Tx Hash */}
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Tx:</span>
                    <span className="text-sm font-mono text-white">
                      {truncateTxHash(txDigest)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCopyTxHash}
                      className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors text-white/50 hover:text-white"
                      title="Copy transaction hash"
                    >
                      {copied ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <DocumentDuplicateIcon className="w-4 h-4" />
                      )}
                    </button>
                    <a
                      href={explorerTxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors text-white/50 hover:text-[#2dd4bf]"
                      title="View on explorer"
                    >
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Done button */}
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-400 transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center">
                  <span className="text-2xl">❌</span>
                </div>
                <h2 className="text-lg font-semibold text-white">
                  Transaction failed
                </h2>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                  <p className="text-sm text-red-400 break-words">
                    {error}
                  </p>
                </div>
              )}

              {/* Tx Hash if available */}
              {txDigest && (
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">Tx:</span>
                      <span className="text-sm font-mono text-white">
                        {truncateTxHash(txDigest)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleCopyTxHash}
                        className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors text-white/50 hover:text-white"
                        title="Copy transaction hash"
                      >
                        {copied ? (
                          <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <DocumentDuplicateIcon className="w-4 h-4" />
                        )}
                      </button>
                      <a
                        href={explorerTxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors text-white/50 hover:text-[#2dd4bf]"
                        title="View on explorer"
                      >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Try again button */}
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-white/10 text-white font-semibold text-sm hover:bg-white/15 transition-colors border border-white/10"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
