use anchor_lang::prelude::*;

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

#[constant]
pub const OFFER_SEED: &[u8] = b"offer";

#[constant]
pub const SUBSCRIPTION_SEED: &[u8] = b"sub";

#[constant]
pub const RECEIPT_SEED: &[u8] = b"receipt";

#[constant]
pub const BPS: u64 = 10_000;

#[constant]
pub const MAX_FEE_BPS: u16 = 500;

pub const NAME_LEN: usize = 32;
pub const SYMBOL_LEN: usize = 10;
pub const URI_LEN: usize = 128;
