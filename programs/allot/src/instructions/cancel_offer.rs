use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{error::AllotError, instructions::close_offer::seal, state::*};

#[derive(Accounts)]
pub struct CancelOffer<'info> {
    pub issuer: Signer<'info>,
    #[account(mut, has_one = issuer, has_one = mint)]
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

pub fn handle_cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let offer = &mut ctx.accounts.offer;
    require!(offer.status == OfferStatus::Open, AllotError::WrongStatus);
    let key = offer.key();
    seal(offer, key, ctx.accounts.vault.amount, false, OfferStatus::Cancelled, now)
}
