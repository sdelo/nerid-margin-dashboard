/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct } from '../utils/index.js';
import { bcs } from '@mysten/sui/bcs';
import * as table from './deps/sui/table.js';
import * as vec_map from './deps/sui/vec_map.js';
import * as object from './deps/sui/object.js';
const $moduleName = '@local-pkg/deepbook-margin::referral_fees';
export const ReferralFees = new MoveStruct({ name: `${$moduleName}::ReferralFees`, fields: {
        referrals: table.Table,
        total_shares: bcs.u64(),
        fees_per_share: bcs.u64(),
        extra_fields: vec_map.VecMap(bcs.string(), bcs.u64())
    } });
export const ReferralTracker = new MoveStruct({ name: `${$moduleName}::ReferralTracker`, fields: {
        current_shares: bcs.u64(),
        min_shares: bcs.u64()
    } });
export const SupplyReferral = new MoveStruct({ name: `${$moduleName}::SupplyReferral`, fields: {
        id: object.UID,
        owner: bcs.Address,
        last_fees_per_share: bcs.u64()
    } });
export const ReferralFeesIncreasedEvent = new MoveStruct({ name: `${$moduleName}::ReferralFeesIncreasedEvent`, fields: {
        total_shares: bcs.u64(),
        fees_accrued: bcs.u64()
    } });
export const ReferralFeesClaimedEvent = new MoveStruct({ name: `${$moduleName}::ReferralFeesClaimedEvent`, fields: {
        referral_id: bcs.Address,
        owner: bcs.Address,
        fees: bcs.u64()
    } });