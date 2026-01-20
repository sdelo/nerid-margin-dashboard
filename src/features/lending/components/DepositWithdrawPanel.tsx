import type { FC } from "react";
import React from "react";
import { ConnectModal, useCurrentAccount } from "@mysten/dapp-kit";
import { MIN_DEPOSIT_AMOUNT } from "../../../constants";
import { TransactionInfoIcon } from "../../../components/TransactionButton";
import { useAppNetwork } from "../../../context/AppNetworkContext";
import {
  createSupplyTransactionInfo,
  createWithdrawTransactionInfo,
} from "../../../utils/transactionInfo";
import { InfoTooltip } from "../../../components/InfoTooltip";

type Props = {
  asset: "DBUSDC" | "SUI";
  apy?: number; // Added APY for earnings projection
  onDeposit?: (amount: number) => void;
  onWithdrawAll?: () => void;
  onWithdraw?: (amount: number) => void;
  minBorrow?: number;
  supplyCap?: number;
  balance?: string;  // Wallet balance (for deposit)
  suiBalance?: string;  // SUI balance (for gas)
  depositedBalance?: number;  // User's deposited position balance (for withdraw max)
  txStatus?: "idle" | "pending" | "success" | "error";
  txError?: string | null;
};

export interface DepositWithdrawPanelHandle {
  focusDepositInput: () => void;
}

const DepositWithdrawPanelComponent: React.ForwardRefRenderFunction<
  DepositWithdrawPanelHandle,
  Props
> = (
  {
    asset,
    apy = 0,
    onDeposit,
    onWithdrawAll,
    onWithdraw,
    minBorrow = 0,
    supplyCap = 0,
    balance,
    suiBalance,
    depositedBalance = 0,
    txStatus = "idle",
    txError,
  },
  ref
) => {
  const [tab, setTab] = React.useState<"deposit" | "withdraw">("deposit");
  const account = useCurrentAccount();
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [inputAmount, setInputAmount] = React.useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = React.useState<string>("");
  const [isWithdrawMax, setIsWithdrawMax] = React.useState(false);
  const [isFlashing, setIsFlashing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { network } = useAppNetwork();

  // Clear inputs on successful transaction (after wallet confirmation completes)
  React.useEffect(() => {
    if (txStatus === "success") {
      setInputAmount("");
      setWithdrawAmount("");
      setIsWithdrawMax(false);
    }
  }, [txStatus]);

  // Expose focus method to parent component
  React.useImperativeHandle(ref, () => ({
    focusDepositInput: () => {
      setTab("deposit");
      setTimeout(() => {
        inputRef.current?.focus();
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 600);
      }, 100);
    },
  }));

  // Parse balances for validation (rounded down to nearest 0.01)
  const assetBalanceNum = React.useMemo(() => {
    if (!balance) return 0;
    const num = parseFloat(balance.split(" ")[0].replace(/,/g, "")) || 0;
    return Math.floor(num * 100) / 100; // Round down to nearest 0.01
  }, [balance]);

  const suiBalanceNum = React.useMemo(() => {
    if (!suiBalance) return 0;
    return parseFloat(suiBalance.split(" ")[0].replace(/,/g, "")) || 0;
  }, [suiBalance]);

  // Format rounded balance for display
  const roundedAssetBalance = React.useMemo(() => {
    return assetBalanceNum.toFixed(2);
  }, [assetBalanceNum]);

  // Calculate estimated earnings
  const earnings = React.useMemo(() => {
    const amount = parseFloat(inputAmount) || 0;
    const daily = (amount * (apy / 100)) / 365;
    const yearly = amount * (apy / 100);
    return { daily, yearly };
  }, [inputAmount, apy]);

  return (
    <div className="w-full card-surface p-4 flex flex-col relative min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="stat-label mb-0.5">Deposit / Withdraw</div>
          <h2 className="text-base font-bold text-white">{asset} Pool</h2>
        </div>
        <span className="badge-live">Live</span>
      </div>
      <div className="section-divider mb-3"></div>

      <div className="flex items-center gap-1.5 mb-4">
        <button
          className={`px-3 py-2 rounded-lg text-xs font-medium flex-1 transition-all duration-200 ${
            tab === "deposit"
              ? "bg-teal-400 text-[#0c1a24] shadow-sm"
              : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/8"
          }`}
          onClick={() => setTab("deposit")}
        >
          Deposit
        </button>
        <button
          className={`px-3 py-2 rounded-lg text-xs font-medium flex-1 transition-all duration-200 ${
            tab === "withdraw"
              ? "bg-white/10 text-white border border-white/15"
              : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/8"
          }`}
          onClick={() => setTab("withdraw")}
        >
          Withdraw
        </button>
      </div>

      {/* Deposit */}
      <div className={`flex-1 ${tab === "deposit" ? "block" : "hidden"}`}>
        <div className="space-y-4">
          {/* Input with inline MAX button */}
          <div className="relative">
            <input
              ref={inputRef}
              type="number"
              min={MIN_DEPOSIT_AMOUNT}
              max={assetBalanceNum}
              step="0.000001"
              placeholder={`Enter ${asset} amount`}
              className={`input-surface w-full text-base pl-4 pr-20 py-3 rounded-lg transition-all ${isFlashing ? "ring-4 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]" : ""}`}
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              id="deposit-amount"
            />
            {balance && assetBalanceNum > 0 && (
              <button
                type="button"
                onClick={() => setInputAmount(roundedAssetBalance)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-bold bg-teal-400/20 hover:bg-teal-400/30 text-teal-300 hover:text-amber-200 rounded border border-teal-400/30 transition-all"
              >
                MAX
              </button>
            )}
          </div>
          
          {/* Available balance - compact inline display */}
          {balance && (
            <div className="text-[10px] text-slate-400 flex items-center justify-between px-0.5">
              <span>Available: <span className="text-slate-300">{roundedAssetBalance} {asset}</span></span>
            </div>
          )}

          {/* Earnings Projection */}
          {inputAmount &&
            !isNaN(parseFloat(inputAmount)) &&
            parseFloat(inputAmount) > 0 && (
              <div className="surface-inset rounded-lg p-3">
                <h4 className="stat-label mb-2">
                  Estimated Earnings
                </h4>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] text-white/50 mb-0.5">Daily</div>
                    <div className="stat-value-sm text-teal-400 text-sm">
                      +
                      {earnings.daily.toLocaleString(undefined, {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      })}{" "}
                      {asset}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-white/50 mb-0.5">
                      Yearly ({apy.toFixed(2)}%)
                    </div>
                    <div className="stat-value-sm text-teal-400 text-sm">
                      +
                      {earnings.yearly.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      {asset}
                    </div>
                  </div>
                </div>
              </div>
            )}

          <div className="flex items-center justify-between text-xs text-indigo-200/80">
            <span>Quick %</span>
            <div className="flex gap-1.5">
              {([25, 50, 75, 100] as const).map((p) => (
                <button
                  key={p}
                  className="pill px-3 py-1.5 text-xs hover:scale-105 transition-transform"
                  onClick={() => {
                    if (balance) {
                      const bal = assetBalanceNum;
                      const amount = (bal * p) / 100;
                      const roundedAmount = Math.floor(amount * 100) / 100;
                      setInputAmount(roundedAmount.toFixed(2));
                    }
                  }}
                >
                  {`${p}%`}
                </button>
              ))}
            </div>
          </div>


          <div className="text-[10px] text-slate-400 px-2 py-1.5 flex items-center gap-3">
            <span className="flex items-center">
              Min Borrow<InfoTooltip tooltip="minBorrow" />: <span className="text-slate-300 ml-0.5">{minBorrow}</span>
            </span>
            <span className="flex items-center">
              Supply Cap<InfoTooltip tooltip="supplyCap" />: <span className="text-slate-300 ml-0.5">{supplyCap.toLocaleString()}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {account ? (
              <>
                <button
                  className={`btn-primary text-sm py-3 flex-1 ${
                    txStatus === "pending"
                      ? "opacity-50 cursor-not-allowed"
                      : "animate-[pulse_2.2s_ease-in-out_infinite] hover:opacity-95"
                  }`}
                  disabled={txStatus === "pending" || suiBalanceNum < 0.01}
                  onClick={() => {
                    if (txStatus === "pending") return;
                    let v = Number(inputAmount || 0);
                    if (!Number.isFinite(v) || v <= 0) return;
                    if (v < 0) v = 0;
                    onDeposit?.(v);
                  }}
                >
                  <span className="relative z-10 font-bold">
                    {txStatus === "pending"
                      ? "Depositing..."
                      : suiBalanceNum < 0.01
                        ? "Insufficient SUI"
                        : "Deposit"}
                  </span>
                </button>
                <TransactionInfoIcon
                  transactionInfo={createSupplyTransactionInfo(
                    asset,
                    inputAmount ? `${inputAmount} ${asset}` : `0 ${asset}`,
                    network
                  )}
                  size="lg"
                  className="p-1.5"
                  disabled={!inputAmount || Number(inputAmount || 0) <= 0}
                />
              </>
            ) : (
              <ConnectModal
                open={connectOpen}
                onOpenChange={setConnectOpen}
                trigger={
                  <button
                    onClick={() => setConnectOpen(true)}
                    className="btn-primary text-sm py-3 hover:opacity-95 flex-1"
                  >
                    <span className="relative z-10 font-bold">
                      Connect Wallet
                    </span>
                  </button>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Withdraw */}
      <div className={`flex-1 ${tab === "withdraw" ? "block" : "hidden"}`}>
        <h3 className="text-base font-semibold text-cyan-200 mb-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_12px_2px_rgba(34,211,238,0.6)]"></span>
          Withdraw
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={depositedBalance}
              step="0.000001"
              placeholder={`Enter ${asset} amount`}
              className={`input-surface flex-1 text-base px-4 py-3 ${
                Number(withdrawAmount) > depositedBalance ? 'ring-2 ring-red-400' : ''
              }`}
              id="withdraw-amount"
              value={withdrawAmount}
              onChange={(e) => {
                const value = e.target.value;
                // Allow empty or valid numbers
                if (value === '' || !isNaN(Number(value))) {
                  setWithdrawAmount(value);
                  // Clear the MAX flag when user manually edits
                  setIsWithdrawMax(false);
                }
              }}
            />
          </div>

          {/* Percentage Quick Select */}
          <div className="flex items-center justify-between text-xs text-indigo-200/80">
            <span>Quick %</span>
            <div className="flex gap-1.5">
              {([25, 50, 75, 100] as const).map((p) => (
                <button
                  key={p}
                  className="pill px-3 py-1.5 text-xs hover:scale-105 transition-transform"
                  onClick={() => {
                    if (depositedBalance > 0) {
                      const amount = (depositedBalance * p) / 100;
                      // Round down to avoid exceeding balance
                      const roundedAmount = Math.floor(amount * 1000000) / 1000000;
                      setWithdrawAmount(roundedAmount.toString());
                      // Track if MAX (100%) was selected
                      setIsWithdrawMax(p === 100);
                    }
                  }}
                  disabled={depositedBalance <= 0}
                >
                  {`${p}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Withdrawable Balance Info (includes interest) */}
          <p className="text-xs text-cyan-100/80 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
            Withdrawable:{" "}
            <span className="text-teal-300 font-bold">
              {depositedBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset}
            </span>
          </p>

          {/* Validation Warning */}
          {Number(withdrawAmount) > depositedBalance && depositedBalance > 0 && (
            <p className="text-xs text-red-300 bg-red-900/20 px-3 py-2 rounded-lg border border-red-400/30">
              ⚠️ Exceeds balance
            </p>
          )}

          <div className="flex gap-1.5">
            {account ? (
              <>
                <TransactionInfoIcon
                  transactionInfo={createWithdrawTransactionInfo(
                    asset,
                    withdrawAmount
                      ? `${withdrawAmount} ${asset}`
                      : `0 ${asset}`,
                    network
                  )}
                  size="md"
                  className="p-1.5"
                  disabled={!withdrawAmount || Number(withdrawAmount || 0) <= 0 || Number(withdrawAmount) > depositedBalance}
                />
                <button
                  className={`pill flex-1 text-sm py-2.5 ${
                    txStatus === "pending" || Number(withdrawAmount) > depositedBalance
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  disabled={
                    txStatus === "pending" || 
                    suiBalanceNum < 0.01 || 
                    Number(withdrawAmount) > depositedBalance ||
                    Number(withdrawAmount) <= 0
                  }
                  onClick={() => {
                    if (txStatus === "pending") return;
                    const v = Number(withdrawAmount || 0);
                    if (!Number.isFinite(v) || v <= 0) return;
                    // Use onWithdrawAll when MAX was selected to avoid precision issues
                    if (isWithdrawMax && onWithdrawAll) {
                      onWithdrawAll();
                    } else {
                      if (v > depositedBalance) return;
                      onWithdraw?.(v);
                    }
                  }}
                >
                  {txStatus === "pending"
                    ? "Withdrawing..."
                    : suiBalanceNum < 0.01
                      ? "Insufficient SUI"
                      : Number(withdrawAmount) > depositedBalance
                        ? "Exceeds Balance"
                        : "Withdraw"}
                </button>
              </>
            ) : (
              <ConnectModal
                open={connectOpen}
                onOpenChange={setConnectOpen}
                trigger={
                  <button
                    onClick={() => setConnectOpen(true)}
                    className="pill flex-1 text-sm py-2.5"
                  >
                    Connect Wallet
                  </button>
                }
              />
            )}
          </div>
        </div>
        {/* Balance Information */}
        <div className="mt-3 space-y-1.5">
          {balance && (
            <p className="text-xs text-cyan-100/80 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
              {asset}: <span className="text-teal-300 font-bold">{balance}</span>
            </p>
          )}
          {suiBalance && (
            <p className="text-xs text-cyan-100/80 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
              SUI:{" "}
              <span
                className={`font-bold ${
                  suiBalanceNum < 0.01 ? "text-red-300" : "text-teal-300"
                }`}
              >
                {suiBalance}
              </span>
            </p>
          )}
          {suiBalanceNum < 0.01 && (
            <p className="text-xs text-red-300 bg-red-900/20 px-3 py-2 rounded-lg border border-red-400/30">
              ⚠️ Need 0.01+ SUI for gas
            </p>
          )}
        </div>
      </div>

      {/* Transaction Status Feedback */}
      {txStatus === "error" && txError && (
        <div className="mt-3 p-2 bg-red-500/20 border border-red-500/50 rounded">
          <p className="text-red-300 text-xs">
            <span className="font-semibold">Failed:</span> {txError}
          </p>
        </div>
      )}

      {txStatus === "success" && (
        <div className="mt-3 p-2 bg-green-500/20 border border-green-500/50 rounded">
          <p className="text-green-300 text-xs">
            <span className="font-semibold">Success!</span> Check wallet.
          </p>
        </div>
      )}
    </div>
  );
};

export const DepositWithdrawPanel = React.forwardRef(
  DepositWithdrawPanelComponent
);

export default DepositWithdrawPanel;
