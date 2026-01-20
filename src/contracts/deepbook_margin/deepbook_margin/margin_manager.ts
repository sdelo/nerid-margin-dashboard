/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as object from './deps/sui/object.js';
import * as balance_manager from './deps/deepbook/balance_manager.js';
import * as tpsl from './tpsl.js';
import * as vec_map from './deps/sui/vec_map.js';
import * as type_name from './deps/std/type_name.js';
const $moduleName = '@local-pkg/deepbook-margin::margin_manager';
export const MarginApp = new MoveStruct({ name: `${$moduleName}::MarginApp`, fields: {
        dummy_field: bcs.bool()
    } });
export const MarginManager = new MoveStruct({ name: `${$moduleName}::MarginManager`, fields: {
        id: object.UID,
        owner: bcs.Address,
        deepbook_pool: bcs.Address,
        margin_pool_id: bcs.option(bcs.Address),
        balance_manager: balance_manager.BalanceManager,
        deposit_cap: balance_manager.DepositCap,
        withdraw_cap: balance_manager.WithdrawCap,
        trade_cap: balance_manager.TradeCap,
        borrowed_base_shares: bcs.u64(),
        borrowed_quote_shares: bcs.u64(),
        take_profit_stop_loss: tpsl.TakeProfitStopLoss,
        extra_fields: vec_map.VecMap(bcs.string(), bcs.u64())
    } });
export const ManagerInitializer = new MoveStruct({ name: `${$moduleName}::ManagerInitializer`, fields: {
        margin_manager_id: bcs.Address
    } });
export const MarginManagerCreatedEvent = new MoveStruct({ name: `${$moduleName}::MarginManagerCreatedEvent`, fields: {
        margin_manager_id: bcs.Address,
        balance_manager_id: bcs.Address,
        deepbook_pool_id: bcs.Address,
        owner: bcs.Address,
        timestamp: bcs.u64()
    } });
export const LoanBorrowedEvent = new MoveStruct({ name: `${$moduleName}::LoanBorrowedEvent`, fields: {
        margin_manager_id: bcs.Address,
        margin_pool_id: bcs.Address,
        loan_amount: bcs.u64(),
        loan_shares: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const LoanRepaidEvent = new MoveStruct({ name: `${$moduleName}::LoanRepaidEvent`, fields: {
        margin_manager_id: bcs.Address,
        margin_pool_id: bcs.Address,
        repay_amount: bcs.u64(),
        repay_shares: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const LiquidationEvent = new MoveStruct({ name: `${$moduleName}::LiquidationEvent`, fields: {
        margin_manager_id: bcs.Address,
        margin_pool_id: bcs.Address,
        liquidation_amount: bcs.u64(),
        pool_reward: bcs.u64(),
        pool_default: bcs.u64(),
        risk_ratio: bcs.u64(),
        remaining_base_asset: bcs.u64(),
        remaining_quote_asset: bcs.u64(),
        remaining_base_debt: bcs.u64(),
        remaining_quote_debt: bcs.u64(),
        base_pyth_price: bcs.u64(),
        base_pyth_decimals: bcs.u8(),
        quote_pyth_price: bcs.u64(),
        quote_pyth_decimals: bcs.u8(),
        timestamp: bcs.u64()
    } });
export const DepositCollateralEvent = new MoveStruct({ name: `${$moduleName}::DepositCollateralEvent`, fields: {
        margin_manager_id: bcs.Address,
        amount: bcs.u64(),
        asset: type_name.TypeName,
        pyth_price: bcs.u64(),
        pyth_decimals: bcs.u8(),
        timestamp: bcs.u64()
    } });
export const WithdrawCollateralEvent = new MoveStruct({ name: `${$moduleName}::WithdrawCollateralEvent`, fields: {
        margin_manager_id: bcs.Address,
        amount: bcs.u64(),
        asset: type_name.TypeName,
        withdraw_base_asset: bcs.bool(),
        remaining_base_asset: bcs.u64(),
        remaining_quote_asset: bcs.u64(),
        remaining_base_debt: bcs.u64(),
        remaining_quote_debt: bcs.u64(),
        base_pyth_price: bcs.u64(),
        base_pyth_decimals: bcs.u8(),
        quote_pyth_price: bcs.u64(),
        quote_pyth_decimals: bcs.u8(),
        timestamp: bcs.u64()
    } });
export interface AddConditionalOrderArguments {
    self: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    basePriceInfoObject: RawTransactionArgument<string>;
    quotePriceInfoObject: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    conditionalOrderId: RawTransactionArgument<number | bigint>;
    condition: RawTransactionArgument<string>;
    pendingOrder: RawTransactionArgument<string>;
}
export interface AddConditionalOrderOptions {
    package?: string;
    arguments: AddConditionalOrderArguments | [
        self: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        basePriceInfoObject: RawTransactionArgument<string>,
        quotePriceInfoObject: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        conditionalOrderId: RawTransactionArgument<number | bigint>,
        condition: RawTransactionArgument<string>,
        pendingOrder: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Add a conditional order. Specifies the conditions under which the order is
 * triggered and the pending order to be placed.
 */
export function addConditionalOrder(options: AddConditionalOrderOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        `${packageAddress}::margin_registry::MarginRegistry`,
        'u64',
        `${packageAddress}::tpsl::Condition`,
        `${packageAddress}::tpsl::PendingOrder`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "pool", "basePriceInfoObject", "quotePriceInfoObject", "registry", "conditionalOrderId", "condition", "pendingOrder"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'add_conditional_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelAllConditionalOrdersArguments {
    self: RawTransactionArgument<string>;
}
export interface CancelAllConditionalOrdersOptions {
    package?: string;
    arguments: CancelAllConditionalOrdersArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Cancel all conditional orders. */
export function cancelAllConditionalOrders(options: CancelAllConditionalOrdersOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'cancel_all_conditional_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelConditionalOrderArguments {
    self: RawTransactionArgument<string>;
    conditionalOrderId: RawTransactionArgument<number | bigint>;
}
export interface CancelConditionalOrderOptions {
    package?: string;
    arguments: CancelConditionalOrderArguments | [
        self: RawTransactionArgument<string>,
        conditionalOrderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Cancel a conditional order. */
export function cancelConditionalOrder(options: CancelConditionalOrderOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u64',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "conditionalOrderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'cancel_conditional_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteConditionalOrdersArguments {
    self: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    basePriceInfoObject: RawTransactionArgument<string>;
    quotePriceInfoObject: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    maxOrdersToExecute: RawTransactionArgument<number | bigint>;
}
export interface ExecuteConditionalOrdersOptions {
    package?: string;
    arguments: ExecuteConditionalOrdersArguments | [
        self: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        basePriceInfoObject: RawTransactionArgument<string>,
        quotePriceInfoObject: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        maxOrdersToExecute: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Execute conditional orders and return the order infos. This is a permissionless
 * function that can be called by anyone.
 */
export function executeConditionalOrders(options: ExecuteConditionalOrdersOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        `${packageAddress}::margin_registry::MarginRegistry`,
        'u64',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "pool", "basePriceInfoObject", "quotePriceInfoObject", "registry", "maxOrdersToExecute"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'execute_conditional_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface NewArguments {
    pool: RawTransactionArgument<string>;
    deepbookRegistry: RawTransactionArgument<string>;
    marginRegistry: RawTransactionArgument<string>;
}
export interface NewOptions {
    package?: string;
    arguments: NewArguments | [
        pool: RawTransactionArgument<string>,
        deepbookRegistry: RawTransactionArgument<string>,
        marginRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Creates a new margin manager and shares it. */
export function _new(options: NewOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::registry::Registry`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["pool", "deepbookRegistry", "marginRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'new',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface NewWithInitializerArguments {
    pool: RawTransactionArgument<string>;
    deepbookRegistry: RawTransactionArgument<string>;
    marginRegistry: RawTransactionArgument<string>;
}
export interface NewWithInitializerOptions {
    package?: string;
    arguments: NewWithInitializerArguments | [
        pool: RawTransactionArgument<string>,
        deepbookRegistry: RawTransactionArgument<string>,
        marginRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Creates a new margin manager and returns it along with an initializer. The
 * initializer is used to ensure the margin manager is shared after creation.
 */
export function newWithInitializer(options: NewWithInitializerOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::registry::Registry`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["pool", "deepbookRegistry", "marginRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'new_with_initializer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ShareArguments {
    manager: RawTransactionArgument<string>;
    initializer: RawTransactionArgument<string>;
}
export interface ShareOptions {
    package?: string;
    arguments: ShareArguments | [
        manager: RawTransactionArgument<string>,
        initializer: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Shares the margin manager. The initializer is dropped in the process. */
export function share(options: ShareOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_manager::ManagerInitializer`
    ] satisfies string[];
    const parameterNames = ["manager", "initializer"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnregisterMarginManagerArguments {
    self: RawTransactionArgument<string>;
    marginRegistry: RawTransactionArgument<string>;
}
export interface UnregisterMarginManagerOptions {
    package?: string;
    arguments: UnregisterMarginManagerArguments | [
        self: RawTransactionArgument<string>,
        marginRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Unregister the margin manager from the margin registry. */
export function unregisterMarginManager(options: UnregisterMarginManagerOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`
    ] satisfies string[];
    const parameterNames = ["self", "marginRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'unregister_margin_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetMarginManagerReferralArguments {
    self: RawTransactionArgument<string>;
    referralCap: RawTransactionArgument<string>;
}
export interface SetMarginManagerReferralOptions {
    package?: string;
    arguments: SetMarginManagerReferralArguments | [
        self: RawTransactionArgument<string>,
        referralCap: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Set the referral for the margin manager. */
export function setMarginManagerReferral(options: SetMarginManagerReferralOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::balance_manager::DeepBookPoolReferral`
    ] satisfies string[];
    const parameterNames = ["self", "referralCap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'set_margin_manager_referral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnsetMarginManagerReferralArguments {
    self: RawTransactionArgument<string>;
    poolId: RawTransactionArgument<string>;
}
export interface UnsetMarginManagerReferralOptions {
    package?: string;
    arguments: UnsetMarginManagerReferralArguments | [
        self: RawTransactionArgument<string>,
        poolId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Unset the referral for the margin manager. */
export function unsetMarginManagerReferral(options: UnsetMarginManagerReferralOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::object::ID'
    ] satisfies string[];
    const parameterNames = ["self", "poolId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'unset_margin_manager_referral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositArguments {
    self: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    baseOracle: RawTransactionArgument<string>;
    quoteOracle: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
}
export interface DepositOptions {
    package?: string;
    arguments: DepositArguments | [
        self: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        baseOracle: RawTransactionArgument<string>,
        quoteOracle: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Deposit a coin into the margin manager. The coin must be of the same type as
 * either the base, quote, or DEEP.
 */
export function deposit(options: DepositOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        `0x0000000000000000000000000000000000000000000000000000000000000002::coin::Coin<${options.typeArguments[2]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "registry", "baseOracle", "quoteOracle", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawArguments {
    self: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    baseMarginPool: RawTransactionArgument<string>;
    quoteMarginPool: RawTransactionArgument<string>;
    baseOracle: RawTransactionArgument<string>;
    quoteOracle: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    withdrawAmount: RawTransactionArgument<number | bigint>;
}
export interface WithdrawOptions {
    package?: string;
    arguments: WithdrawArguments | [
        self: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        baseMarginPool: RawTransactionArgument<string>,
        quoteMarginPool: RawTransactionArgument<string>,
        baseOracle: RawTransactionArgument<string>,
        quoteOracle: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        withdrawAmount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Withdraw a specified amount of an asset from the margin manager. The asset must
 * be of the same type as either the base, quote, or DEEP. The withdrawal is
 * subject to the risk ratio limit.
 */
export function withdraw(options: WithdrawOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[0]}>`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[1]}>`,
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u64',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "registry", "baseMarginPool", "quoteMarginPool", "baseOracle", "quoteOracle", "pool", "withdrawAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'withdraw',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowBaseArguments {
    self: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    baseMarginPool: RawTransactionArgument<string>;
    baseOracle: RawTransactionArgument<string>;
    quoteOracle: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    loanAmount: RawTransactionArgument<number | bigint>;
}
export interface BorrowBaseOptions {
    package?: string;
    arguments: BorrowBaseArguments | [
        self: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        baseMarginPool: RawTransactionArgument<string>,
        baseOracle: RawTransactionArgument<string>,
        quoteOracle: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        loanAmount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrow the base asset using the margin manager. */
export function borrowBase(options: BorrowBaseOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[0]}>`,
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u64',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "registry", "baseMarginPool", "baseOracle", "quoteOracle", "pool", "loanAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'borrow_base',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowQuoteArguments {
    self: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    quoteMarginPool: RawTransactionArgument<string>;
    baseOracle: RawTransactionArgument<string>;
    quoteOracle: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    loanAmount: RawTransactionArgument<number | bigint>;
}
export interface BorrowQuoteOptions {
    package?: string;
    arguments: BorrowQuoteArguments | [
        self: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        quoteMarginPool: RawTransactionArgument<string>,
        baseOracle: RawTransactionArgument<string>,
        quoteOracle: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        loanAmount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrow the quote asset using the margin manager. */
export function borrowQuote(options: BorrowQuoteOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[1]}>`,
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u64',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "registry", "quoteMarginPool", "baseOracle", "quoteOracle", "pool", "loanAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'borrow_quote',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RepayBaseArguments {
    self: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    marginPool: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint | null>;
}
export interface RepayBaseOptions {
    package?: string;
    arguments: RepayBaseArguments | [
        self: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        marginPool: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint | null>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Repay the base asset loan using the margin manager. Returns the total amount
 * repaid
 */
export function repayBase(options: RepayBaseOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[0]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000001::option::Option<u64>',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "registry", "marginPool", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'repay_base',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RepayQuoteArguments {
    self: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    marginPool: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint | null>;
}
export interface RepayQuoteOptions {
    package?: string;
    arguments: RepayQuoteArguments | [
        self: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        marginPool: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint | null>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Repay the quote asset loan using the margin manager. Returns the total amount
 * repaid
 */
export function repayQuote(options: RepayQuoteOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[1]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000001::option::Option<u64>',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "registry", "marginPool", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'repay_quote',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LiquidateArguments {
    self: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    baseOracle: RawTransactionArgument<string>;
    quoteOracle: RawTransactionArgument<string>;
    marginPool: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    repayCoin: RawTransactionArgument<string>;
}
export interface LiquidateOptions {
    package?: string;
    arguments: LiquidateArguments | [
        self: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        baseOracle: RawTransactionArgument<string>,
        quoteOracle: RawTransactionArgument<string>,
        marginPool: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        repayCoin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
export function liquidate(options: LiquidateOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[2]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `0x0000000000000000000000000000000000000000000000000000000000000002::coin::Coin<${options.typeArguments[2]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "registry", "baseOracle", "quoteOracle", "marginPool", "pool", "repayCoin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'liquidate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RiskRatioArguments {
    self: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    baseOracle: RawTransactionArgument<string>;
    quoteOracle: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    baseMarginPool: RawTransactionArgument<string>;
    quoteMarginPool: RawTransactionArgument<string>;
}
export interface RiskRatioOptions {
    package?: string;
    arguments: RiskRatioArguments | [
        self: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        baseOracle: RawTransactionArgument<string>,
        quoteOracle: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        baseMarginPool: RawTransactionArgument<string>,
        quoteMarginPool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function riskRatio(options: RiskRatioOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[0]}>`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[1]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "registry", "baseOracle", "quoteOracle", "pool", "baseMarginPool", "quoteMarginPool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'risk_ratio',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BalanceManagerArguments {
    self: RawTransactionArgument<string>;
}
export interface BalanceManagerOptions {
    package?: string;
    arguments: BalanceManagerArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function balanceManager(options: BalanceManagerOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'balance_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BaseBalanceArguments {
    self: RawTransactionArgument<string>;
}
export interface BaseBalanceOptions {
    package?: string;
    arguments: BaseBalanceArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function baseBalance(options: BaseBalanceOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'base_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface QuoteBalanceArguments {
    self: RawTransactionArgument<string>;
}
export interface QuoteBalanceOptions {
    package?: string;
    arguments: QuoteBalanceArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function quoteBalance(options: QuoteBalanceOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'quote_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DeepBalanceArguments {
    self: RawTransactionArgument<string>;
}
export interface DeepBalanceOptions {
    package?: string;
    arguments: DeepBalanceArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function deepBalance(options: DeepBalanceOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'deep_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CalculateAssetsArguments {
    self: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
}
export interface CalculateAssetsOptions {
    package?: string;
    arguments: CalculateAssetsArguments | [
        self: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Returns (base_asset, quote_asset) for margin manager. */
export function calculateAssets(options: CalculateAssetsOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self", "pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'calculate_assets',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CalculateDebtsArguments {
    self: RawTransactionArgument<string>;
    marginPool: RawTransactionArgument<string>;
}
export interface CalculateDebtsOptions {
    package?: string;
    arguments: CalculateDebtsArguments | [
        self: RawTransactionArgument<string>,
        marginPool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
export function calculateDebts(options: CalculateDebtsOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[2]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "marginPool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'calculate_debts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ManagerStateArguments {
    self: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    baseOracle: RawTransactionArgument<string>;
    quoteOracle: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    baseMarginPool: RawTransactionArgument<string>;
    quoteMarginPool: RawTransactionArgument<string>;
}
export interface ManagerStateOptions {
    package?: string;
    arguments: ManagerStateArguments | [
        self: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        baseOracle: RawTransactionArgument<string>,
        quoteOracle: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        baseMarginPool: RawTransactionArgument<string>,
        quoteMarginPool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Returns comprehensive state information for a margin manager. Returns
 * (manager_id, deepbook_pool_id, risk_ratio, base_asset, quote_asset, base_debt,
 * quote_debt, base_pyth_price, base_pyth_decimals, quote_pyth_price,
 * quote_pyth_decimals, current_price, lowest_trigger_above_price,
 * highest_trigger_below_price)
 */
export function managerState(options: ManagerStateOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_registry::MarginRegistry`,
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        '0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e::price_info::PriceInfoObject',
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[0]}>`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[1]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["self", "registry", "baseOracle", "quoteOracle", "pool", "baseMarginPool", "quoteMarginPool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'manager_state',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IdArguments {
    self: RawTransactionArgument<string>;
}
export interface IdOptions {
    package?: string;
    arguments: IdArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function id(options: IdOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OwnerArguments {
    self: RawTransactionArgument<string>;
}
export interface OwnerOptions {
    package?: string;
    arguments: OwnerArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function owner(options: OwnerOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'owner',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DeepbookPoolArguments {
    self: RawTransactionArgument<string>;
}
export interface DeepbookPoolOptions {
    package?: string;
    arguments: DeepbookPoolArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function deepbookPool(options: DeepbookPoolOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'deepbook_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarginPoolIdArguments {
    self: RawTransactionArgument<string>;
}
export interface MarginPoolIdOptions {
    package?: string;
    arguments: MarginPoolIdArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function marginPoolId(options: MarginPoolIdOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'margin_pool_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowedSharesArguments {
    self: RawTransactionArgument<string>;
}
export interface BorrowedSharesOptions {
    package?: string;
    arguments: BorrowedSharesArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowedShares(options: BorrowedSharesOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'borrowed_shares',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowedBaseSharesArguments {
    self: RawTransactionArgument<string>;
}
export interface BorrowedBaseSharesOptions {
    package?: string;
    arguments: BorrowedBaseSharesArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowedBaseShares(options: BorrowedBaseSharesOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'borrowed_base_shares',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowedQuoteSharesArguments {
    self: RawTransactionArgument<string>;
}
export interface BorrowedQuoteSharesOptions {
    package?: string;
    arguments: BorrowedQuoteSharesArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowedQuoteShares(options: BorrowedQuoteSharesOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'borrowed_quote_shares',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasBaseDebtArguments {
    self: RawTransactionArgument<string>;
}
export interface HasBaseDebtOptions {
    package?: string;
    arguments: HasBaseDebtArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function hasBaseDebt(options: HasBaseDebtOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'has_base_debt',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ConditionalOrderIdsArguments {
    self: RawTransactionArgument<string>;
}
export interface ConditionalOrderIdsOptions {
    package?: string;
    arguments: ConditionalOrderIdsArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function conditionalOrderIds(options: ConditionalOrderIdsOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'conditional_order_ids',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ConditionalOrderArguments {
    self: RawTransactionArgument<string>;
    conditionalOrderId: RawTransactionArgument<number | bigint>;
}
export interface ConditionalOrderOptions {
    package?: string;
    arguments: ConditionalOrderArguments | [
        self: RawTransactionArgument<string>,
        conditionalOrderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function conditionalOrder(options: ConditionalOrderOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u64'
    ] satisfies string[];
    const parameterNames = ["self", "conditionalOrderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'conditional_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LowestTriggerAbovePriceArguments {
    self: RawTransactionArgument<string>;
}
export interface LowestTriggerAbovePriceOptions {
    package?: string;
    arguments: LowestTriggerAbovePriceArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Returns the lowest trigger price for trigger_above orders Returns
 * constants::max_u64() if there are no trigger_above orders
 */
export function lowestTriggerAbovePrice(options: LowestTriggerAbovePriceOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'lowest_trigger_above_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HighestTriggerBelowPriceArguments {
    self: RawTransactionArgument<string>;
}
export interface HighestTriggerBelowPriceOptions {
    package?: string;
    arguments: HighestTriggerBelowPriceArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Returns the highest trigger price for trigger_below orders Returns 0 if there
 * are no trigger_below orders
 */
export function highestTriggerBelowPrice(options: HighestTriggerBelowPriceOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'margin_manager',
        function: 'highest_trigger_below_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}