use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{error::AllotError, state::*};

#[derive(Accounts)]
pub struct CloseOffer<'info> {
    #[account(mut, has_one = mint)]
    pub offer: Box<Account<'info, Offer>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        associated_token::mint = mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_close_offer(ctx: Context<CloseOffer>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let offer = &mut ctx.accounts.offer;
    require!(offer.status == OfferStatus::Open, AllotError::WrongStatus);
    require!(now >= offer.close_ts, AllotError::BookStillOpen);
    let success = offer.units_requested >= offer.min_raise_units;
    let key = offer.key();
    seal(offer, key, ctx.accounts.vault.amount, success, OfferStatus::Closed, now)
}

pub fn seal(offer: &mut Offer, key: Pubkey, vault_amount: u64, success: bool, status: OfferStatus, now: i64) -> Result<()> {
    require!(offer.in_strategy == 0, AllotError::StrategyNotEmpty);
    offer.success = success;
    offer.yield_total = vault_amount.saturating_sub(offer.principal);
    offer.loss = offer.principal.saturating_sub(vault_amount);
    offer.status = status;
    offer.closed_ts = now;
    emit!(OfferClosed {
        offer: key,
        success,
        units_requested: offer.units_requested,
        principal: offer.principal,
        yield_total: offer.yield_total,
        loss: offer.loss,
    });
    Ok(())
}
