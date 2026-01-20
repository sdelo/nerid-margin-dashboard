import type { TransactionInfo } from "../components/TransactionButton/types";
import type { AppNetwork } from "../config/networks";
import { CONTRACTS } from "../config/contracts";
import { NETWORK_CONFIGS } from "../config/networks";

interface CreateTransactionInfoParams {
  action: string;
  module: string;
  functionName: string;
  summary: string;
  network: AppNetwork;
  arguments?: Array<{
    name: string;
    value: string;
  }>;
}

/**
 * Helper to generate TransactionInfo for DeepBook Margin transactions
 */
export function createMarginTransactionInfo({
  action,
  module,
  functionName,
  summary,
  network,
  arguments: args,
}: CreateTransactionInfoParams): TransactionInfo {
  const packageId = CONTRACTS[network].MARGIN_PACKAGE_ID;
  const explorerUrl = NETWORK_CONFIGS[network].explorerUrl;
  
  return {
    action,
    packageId,
    module,
    function: functionName,
    summary,
    sourceCodeUrl: `${explorerUrl}/package/${packageId}?tab=Code`,
    arguments: args,
  };
}

/**
 * Pre-defined transaction summaries for common operations
 */
export const TRANSACTION_SUMMARIES = {
  deposit: (asset: string) =>
    `Transfers your ${asset} tokens into the margin pool where they will earn interest. ` +
    `You'll receive a SupplierCap that represents your deposit and allows you to withdraw later. ` +
    `Your deposited funds will be available for borrowing by other users and will earn yield based on utilization.`,

  supply: (asset: string) =>
    `Deposits your ${asset} tokens into the margin pool to earn yield. ` +
    `You'll receive or update your SupplierCap token that tracks your position. ` +
    `You can withdraw your principal plus earned interest at any time.`,

  withdraw: (asset: string) =>
    `Burns your SupplierCap and withdraws your ${asset} tokens from the margin pool. ` +
    `You'll receive your deposited principal plus any earned interest. ` +
    `The withdrawn amount is based on your share of the pool.`,

  withdrawAll: (asset: string) =>
    `Withdraws all of your ${asset} tokens from the margin pool by burning your SupplierCap. ` +
    `You'll receive your entire deposited balance plus all earned interest. ` +
    `Your SupplierCap will be destroyed after this transaction.`,
} as const;

/**
 * Convenience functions for common margin pool operations
 */
export function createSupplyTransactionInfo(
  asset: string,
  amount: string,
  network: AppNetwork
): TransactionInfo {
  return createMarginTransactionInfo({
    action: `Supply ${asset}`,
    module: "margin_pool",
    functionName: "supply",
    summary: TRANSACTION_SUMMARIES.supply(asset),
    network,
    arguments: [
      { name: "Asset", value: asset },
      { name: "Amount", value: amount },
    ],
  });
}

export function createWithdrawTransactionInfo(
  asset: string,
  amount: string,
  network: AppNetwork
): TransactionInfo {
  return createMarginTransactionInfo({
    action: `Withdraw ${asset}`,
    module: "margin_pool",
    functionName: "withdraw",
    summary: TRANSACTION_SUMMARIES.withdraw(asset),
    network,
    arguments: [
      { name: "Asset", value: asset },
      { name: "Amount", value: amount },
    ],
  });
}

export function createWithdrawAllTransactionInfo(
  asset: string,
  network: AppNetwork
): TransactionInfo {
  return createMarginTransactionInfo({
    action: `Withdraw All ${asset}`,
    module: "margin_pool",
    functionName: "withdraw",
    summary: TRANSACTION_SUMMARIES.withdrawAll(asset),
    network,
  });
}







