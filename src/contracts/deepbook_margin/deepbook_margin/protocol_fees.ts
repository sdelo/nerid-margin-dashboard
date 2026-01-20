/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as table from './deps/sui/table.js';
import * as vec_map from './deps/sui/vec_map.js';
import * as object from './deps/sui/object.js';
const $moduleName = '@local-pkg/deepbook-margin::protocol_fees';
export const ProtocolFees = new MoveStruct({ name: `${$moduleName}::ProtocolFees`, fields: {
        referrals: table.Table,
        total_shares: bcs.u64(),
        fees_per_share: bcs.u64(),
        maintainer_fees: bcs.u64(),
        protocol_fees: bcs.u64(),
        extra_fields: vec_map.VecMap(bcs.string(), bcs.u64())
    } });
export const ReferralTracker = new MoveStruct({ name: `${$moduleName}::ReferralTracker`, fields: {
        current_shares: bcs.u64(),
        last_fees_per_share: bcs.u64(),
        unclaimed_fees: bcs.u64()
    } });
export const SupplyReferral = new MoveStruct({ name: `${$moduleName}::SupplyReferral`, fields: {
        id: object.UID,
        owner: bcs.Address
    } });
export const ProtocolFeesIncreasedEvent = new MoveStruct({ name: `${$moduleName}::ProtocolFeesIncreasedEvent`, fields: {
        margin_pool_id: bcs.Address,
        total_shares: bcs.u64(),
        referral_fees: bcs.u64(),
        maintainer_fees: bcs.u64(),
        protocol_fees: bcs.u64()
    } });
export const ReferralFeesClaimedEvent = new MoveStruct({ name: `${$moduleName}::ReferralFeesClaimedEvent`, fields: {
        referral_id: bcs.Address,
        owner: bcs.Address,
        fees: bcs.u64()
    } });
export interface MaintainerFeesArguments {
    self: RawTransactionArgument<string>;
}
export interface MaintainerFeesOptions {
    package?: string;
    arguments: MaintainerFeesArguments | [
        self: RawTransactionArgument<string>
    ];
}
/** Get the maintainer fees. */
export function maintainerFees(options: MaintainerFeesOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::protocol_fees::ProtocolFees`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'protocol_fees',
        function: 'maintainer_fees',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ProtocolFeesArguments {
    self: RawTransactionArgument<string>;
}
export interface ProtocolFeesOptions {
    package?: string;
    arguments: ProtocolFeesArguments | [
        self: RawTransactionArgument<string>
    ];
}
/** Get the protocol fees. */
export function protocolFees(options: ProtocolFeesOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::protocol_fees::ProtocolFees`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'protocol_fees',
        function: 'protocol_fees',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ReferralTrackerArguments {
    self: RawTransactionArgument<string>;
    referral: RawTransactionArgument<string>;
}
export interface ReferralTrackerOptions {
    package?: string;
    arguments: ReferralTrackerArguments | [
        self: RawTransactionArgument<string>,
        referral: RawTransactionArgument<string>
    ];
}
export function referralTracker(options: ReferralTrackerOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::protocol_fees::ProtocolFees`,
        '0x0000000000000000000000000000000000000000000000000000000000000002::object::ID'
    ] satisfies string[];
    const parameterNames = ["self", "referral"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'protocol_fees',
        function: 'referral_tracker',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TotalSharesArguments {
    self: RawTransactionArgument<string>;
}
export interface TotalSharesOptions {
    package?: string;
    arguments: TotalSharesArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function totalShares(options: TotalSharesOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::protocol_fees::ProtocolFees`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'protocol_fees',
        function: 'total_shares',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FeesPerShareArguments {
    self: RawTransactionArgument<string>;
}
export interface FeesPerShareOptions {
    package?: string;
    arguments: FeesPerShareArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function feesPerShare(options: FeesPerShareOptions) {
    const packageAddress = options.package ?? '@local-pkg/deepbook-margin';
    const argumentsTypes = [
        `${packageAddress}::protocol_fees::ProtocolFees`
    ] satisfies string[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'protocol_fees',
        function: 'fees_per_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}