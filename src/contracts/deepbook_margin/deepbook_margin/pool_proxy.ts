/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { type Transaction } from '@mysten/sui/transactions';
import { normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
export interface PlaceLimitOrderArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    clientOrderId: RawTransactionArgument<number | bigint>;
    orderType: RawTransactionArgument<number>;
    selfMatchingOption: RawTransactionArgument<number>;
    price: RawTransactionArgument<number | bigint>;
    quantity: RawTransactionArgument<number | bigint>;
    isBid: RawTransactionArgument<boolean>;
    payWithDeep: RawTransactionArgument<boolean>;
    expireTimestamp: RawTransactionArgument<number | bigint>;
}
export interface PlaceLimitOrderOptions {
    package?: string;
    arguments: PlaceLimitOrderArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        clientOrderId: RawTransactionArgument<number | bigint>,
        orderType: RawTransactionArgument<number>,
        selfMatchingOption: RawTransactionArgument<number>,
        price: RawTransactionArgument<number | bigint>,
        quantity: RawTransactionArgument<number | bigint>,
        isBid: RawTransactionArgument<boolean>,
        payWithDeep: RawTransactionArgument<boolean>,
        expireTimestamp: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Places a limit order in the pool. */
export function placeLimitOrder(options: PlaceLimitOrderOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u64',
        'u8',
        'u8',
        'u64',
        'u64',
        'bool',
        'bool',
        'u64',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "clientOrderId", "orderType", "selfMatchingOption", "price", "quantity", "isBid", "payWithDeep", "expireTimestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'place_limit_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PlaceMarketOrderArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    clientOrderId: RawTransactionArgument<number | bigint>;
    selfMatchingOption: RawTransactionArgument<number>;
    quantity: RawTransactionArgument<number | bigint>;
    isBid: RawTransactionArgument<boolean>;
    payWithDeep: RawTransactionArgument<boolean>;
}
export interface PlaceMarketOrderOptions {
    package?: string;
    arguments: PlaceMarketOrderArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        clientOrderId: RawTransactionArgument<number | bigint>,
        selfMatchingOption: RawTransactionArgument<number>,
        quantity: RawTransactionArgument<number | bigint>,
        isBid: RawTransactionArgument<boolean>,
        payWithDeep: RawTransactionArgument<boolean>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Places a market order in the pool. */
export function placeMarketOrder(options: PlaceMarketOrderOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u64',
        'u8',
        'u64',
        'bool',
        'bool',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "clientOrderId", "selfMatchingOption", "quantity", "isBid", "payWithDeep"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'place_market_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PlaceReduceOnlyLimitOrderArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    marginPool: RawTransactionArgument<string>;
    clientOrderId: RawTransactionArgument<number | bigint>;
    orderType: RawTransactionArgument<number>;
    selfMatchingOption: RawTransactionArgument<number>;
    price: RawTransactionArgument<number | bigint>;
    quantity: RawTransactionArgument<number | bigint>;
    isBid: RawTransactionArgument<boolean>;
    payWithDeep: RawTransactionArgument<boolean>;
    expireTimestamp: RawTransactionArgument<number | bigint>;
}
export interface PlaceReduceOnlyLimitOrderOptions {
    package?: string;
    arguments: PlaceReduceOnlyLimitOrderArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        marginPool: RawTransactionArgument<string>,
        clientOrderId: RawTransactionArgument<number | bigint>,
        orderType: RawTransactionArgument<number>,
        selfMatchingOption: RawTransactionArgument<number>,
        price: RawTransactionArgument<number | bigint>,
        quantity: RawTransactionArgument<number | bigint>,
        isBid: RawTransactionArgument<boolean>,
        payWithDeep: RawTransactionArgument<boolean>,
        expireTimestamp: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** Places a reduce-only order in the pool. Used when margin trading is disabled. */
export function placeReduceOnlyLimitOrder(options: PlaceReduceOnlyLimitOrderOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[2]}>`,
        'u64',
        'u8',
        'u8',
        'u64',
        'u64',
        'bool',
        'bool',
        'u64',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "marginPool", "clientOrderId", "orderType", "selfMatchingOption", "price", "quantity", "isBid", "payWithDeep", "expireTimestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'place_reduce_only_limit_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PlaceReduceOnlyMarketOrderArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    marginPool: RawTransactionArgument<string>;
    clientOrderId: RawTransactionArgument<number | bigint>;
    selfMatchingOption: RawTransactionArgument<number>;
    quantity: RawTransactionArgument<number | bigint>;
    isBid: RawTransactionArgument<boolean>;
    payWithDeep: RawTransactionArgument<boolean>;
}
export interface PlaceReduceOnlyMarketOrderOptions {
    package?: string;
    arguments: PlaceReduceOnlyMarketOrderArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        marginPool: RawTransactionArgument<string>,
        clientOrderId: RawTransactionArgument<number | bigint>,
        selfMatchingOption: RawTransactionArgument<number>,
        quantity: RawTransactionArgument<number | bigint>,
        isBid: RawTransactionArgument<boolean>,
        payWithDeep: RawTransactionArgument<boolean>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Places a reduce-only market order in the pool. Used when margin trading is
 * disabled.
 */
export function placeReduceOnlyMarketOrder(options: PlaceReduceOnlyMarketOrderOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::margin_pool::MarginPool<${options.typeArguments[2]}>`,
        'u64',
        'u8',
        'u64',
        'bool',
        'bool',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "marginPool", "clientOrderId", "selfMatchingOption", "quantity", "isBid", "payWithDeep"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'place_reduce_only_market_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ModifyOrderArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    newQuantity: RawTransactionArgument<number | bigint>;
}
export interface ModifyOrderOptions {
    package?: string;
    arguments: ModifyOrderArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        newQuantity: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Modifies an order */
export function modifyOrder(options: ModifyOrderOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u128',
        'u64',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "orderId", "newQuantity"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'modify_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelOrderArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface CancelOrderOptions {
    package?: string;
    arguments: CancelOrderArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Cancels an order */
export function cancelOrder(options: CancelOrderOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u128',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'cancel_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelOrdersArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    orderIds: RawTransactionArgument<number | bigint[]>;
}
export interface CancelOrdersOptions {
    package?: string;
    arguments: CancelOrdersArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        orderIds: RawTransactionArgument<number | bigint[]>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Cancel multiple orders within a vector. */
export function cancelOrders(options: CancelOrdersOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'vector<u128>',
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "orderIds"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'cancel_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelAllOrdersArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
}
export interface CancelAllOrdersOptions {
    package?: string;
    arguments: CancelAllOrdersArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Cancels all orders for the given account. */
export function cancelAllOrders(options: CancelAllOrdersOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::clock::Clock'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'cancel_all_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawSettledAmountsArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
}
export interface WithdrawSettledAmountsOptions {
    package?: string;
    arguments: WithdrawSettledAmountsArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Withdraw settled amounts to balance_manager. */
export function withdrawSettledAmounts(options: WithdrawSettledAmountsOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'withdraw_settled_amounts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawSettledAmountsPermissionlessArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
}
export interface WithdrawSettledAmountsPermissionlessOptions {
    package?: string;
    arguments: WithdrawSettledAmountsPermissionlessArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Withdraw settled amounts to balance_manager permissionlessly. Anyone can call
 * this function to settle balances for a margin manager.
 */
export function withdrawSettledAmountsPermissionless(options: WithdrawSettledAmountsPermissionlessOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'withdraw_settled_amounts_permissionless',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface StakeArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface StakeOptions {
    package?: string;
    arguments: StakeArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Stake DEEP tokens to the pool. */
export function stake(options: StakeOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u64'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'stake',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnstakeArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
}
export interface UnstakeOptions {
    package?: string;
    arguments: UnstakeArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Unstake DEEP tokens from the pool. */
export function unstake(options: UnstakeOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'unstake',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SubmitProposalArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    takerFee: RawTransactionArgument<number | bigint>;
    makerFee: RawTransactionArgument<number | bigint>;
    stakeRequired: RawTransactionArgument<number | bigint>;
}
export interface SubmitProposalOptions {
    package?: string;
    arguments: SubmitProposalArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        takerFee: RawTransactionArgument<number | bigint>,
        makerFee: RawTransactionArgument<number | bigint>,
        stakeRequired: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Submit proposal using the margin manager. */
export function submitProposal(options: SubmitProposalOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        'u64',
        'u64',
        'u64'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "takerFee", "makerFee", "stakeRequired"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'submit_proposal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface VoteArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    proposalId: RawTransactionArgument<string>;
}
export interface VoteOptions {
    package?: string;
    arguments: VoteArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        proposalId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Vote on a proposal using the margin manager. */
export function vote(options: VoteOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::object::ID'
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool", "proposalId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'vote',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClaimRebatesArguments {
    registry: RawTransactionArgument<string>;
    marginManager: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
}
export interface ClaimRebatesOptions {
    package?: string;
    arguments: ClaimRebatesArguments | [
        registry: RawTransactionArgument<string>,
        marginManager: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function claimRebates(options: ClaimRebatesOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::margin_registry::MarginRegistry`,
        `${packageAddress}::margin_manager::MarginManager<${options.typeArguments[0]}, ${options.typeArguments[1]}>`,
        `${packageAddress}::pool::Pool<${options.typeArguments[0]}, ${options.typeArguments[1]}>`
    ] satisfies string[];
    const parameterNames = ["registry", "marginManager", "pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pool_proxy',
        function: 'claim_rebates',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}