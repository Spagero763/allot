use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{constants::*, eligibility, error::AllotError, math, state::*};

#[derive(Accounts)]
pub struct Subscribe<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = mint)]
    pub offer: Box<Account<'info, Offer>>,
    #[account(
        init,
        payer = subscriber,
        space = 8 + Subscription::INIT_SPACE,
        seeds = [SUBSCRIPTION_SEED, offer.key().as_ref(), subscriber.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = subscriber,
        token::token_program = token_program,
    )]
    pub subscriber_token: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: parsed and checked against the attestation service in `eligibility`
    pub attestation: Option<UncheckedAccount<'info>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handle_subscribe(ctx: Context<Subscribe>, units: u64) -> Result<()> {
    require!(!ctx.accounts.config.paused, AllotError::Paused);
    let now = Clock::get()?.unix_timestamp;
    let offer = &mut ctx.accounts.offer;
    require!(offer.is_open(now), AllotError::BookNotOpen);
    require!(units >= offer.min_units, AllotError::BelowMinimum);
    require!(offer.max_units == 0 || units <= offer.max_units, AllotError::AboveMaximum);
    if offer.gate != Pubkey::default() {
        let attestation = ctx.accounts.attestation.as_ref().ok_or(AllotError::NotEligible)?;
        eligibility::check(&attestation.to_account_info(), &offer.gate, &ctx.accounts.subscriber.key(), now)?;
    }

    let amount = (units as u128)
        .checked_mul(offer.unit_price as u128)
        .and_then(|v| u64::try_from(v).ok())
        .ok_or(AllotError::Overflow)?;
    let weight = math::weight(amount, now, offer.close_ts);

    offer.units_requested = offer.units_requested.checked_add(units).ok_or(AllotError::Overflow)?;
    offer.floor_demand = offer
        .floor_demand
        .checked_add(units.min(offer.floor_units))
        .ok_or(AllotError::Overflow)?;
    offer.principal = offer.principal.checked_add(amount).ok_or(AllotError::Overflow)?;
    offer.weight_total = offer.weight_total.checked_add(weight).ok_or(AllotError::Overflow)?;
    offer.subscriber_count = offer.subscriber_count.checked_add(1).ok_or(AllotError::Overflow)?;

    let sub = &mut ctx.accounts.subscription;
    sub.offer = offer.key();
    sub.subscriber = ctx.accounts.subscriber.key();
    sub.units = units;
    sub.amount = amount;
    sub.committed_ts = now;
    sub.weight = weight;
    sub.bump = ctx.bumps.subscription;

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.subscriber_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.subscriber.to_account_info(),
            },
        ),
        amount,
        offer.mint_decimals,
    )?;

    emit!(Subscribed {
        offer: offer.key(),
        subscriber: ctx.accounts.subscriber.key(),
        units,
        amount,
        units_requested: offer.units_requested,
    });
    Ok(())
}
