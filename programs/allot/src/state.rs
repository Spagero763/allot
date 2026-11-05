use anchor_lang::prelude::*;

use crate::constants::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum OfferStatus {
    Open,
    Closed,
    Cancelled,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Strategy {
    Idle,
    JupiterLend,
}

#[account]
#[derive(InitSpace)]
pub struct Offer {
    pub issuer: Pubkey,
    pub offer_id: u64,
    pub mint: Pubkey,
    pub mint_decimals: u8,
    pub receipt_mint: Pubkey,
    pub treasury: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_bps: u16,

    pub unit_price: u64,
    pub total_units: u64,
    pub min_units: u64,
    pub max_units: u64,
    pub floor_units: u64,
    pub min_raise_units: u64,
    pub open_ts: i64,
    pub close_ts: i64,
    pub strategy: Strategy,

    pub status: OfferStatus,
    pub success: bool,
    pub units_requested: u64,
    pub floor_demand: u64,
    pub principal: u64,
    pub weight_total: u128,
    pub subscriber_count: u32,
    pub in_strategy: u64,

    pub yield_total: u64,
    pub yield_paid: u64,
    pub loss: u64,
    pub units_allotted: u64,
    pub processed: u32,
    pub closed_ts: i64,

    #[max_len(NAME_LEN)]
    pub name: String,
    #[max_len(SYMBOL_LEN)]
    pub symbol: String,
    #[max_len(URI_LEN)]
    pub uri: String,

    pub bump: u8,
}

impl Offer {
    pub fn is_open(&self, now: i64) -> bool {
        self.status == OfferStatus::Open && now >= self.open_ts && now < self.close_ts
    }
}

#[account]
#[derive(InitSpace)]
pub struct Subscription {
    pub offer: Pubkey,
    pub subscriber: Pubkey,
    pub units: u64,
    pub amount: u64,
    pub committed_ts: i64,
    pub weight: u128,
    pub allotted_units: u64,
    pub refund: u64,
    pub yield_share: u64,
    pub settled: bool,
    pub bump: u8,
}

#[event]
pub struct OfferCreated {
    pub offer: Pubkey,
    pub issuer: Pubkey,
    pub mint: Pubkey,
    pub receipt_mint: Pubkey,
    pub unit_price: u64,
    pub total_units: u64,
    pub open_ts: i64,
    pub close_ts: i64,
}

#[event]
pub struct Subscribed {
    pub offer: Pubkey,
    pub subscriber: Pubkey,
    pub units: u64,
    pub amount: u64,
    pub units_requested: u64,
}

#[event]
pub struct SubscriptionCancelled {
    pub offer: Pubkey,
    pub subscriber: Pubkey,
    pub amount: u64,
}

#[event]
pub struct OfferClosed {
    pub offer: Pubkey,
    pub success: bool,
    pub units_requested: u64,
    pub principal: u64,
    pub yield_total: u64,
    pub loss: u64,
}

#[event]
pub struct Allotted {
    pub offer: Pubkey,
    pub subscriber: Pubkey,
    pub units: u64,
    pub allotted_units: u64,
    pub refund: u64,
    pub yield_share: u64,
}

#[event]
pub struct OfferSettled {
    pub offer: Pubkey,
    pub proceeds: u64,
    pub fee: u64,
    pub units_allotted: u64,
}

#[event]
pub struct Swept {
    pub offer: Pubkey,
    pub amount: u64,
    pub in_strategy: u64,
}

#[event]
pub struct Unswept {
    pub offer: Pubkey,
    pub deployed: u64,
    pub returned: u64,
}
