use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{constants::*, error::AllotError, state::*};

#[derive(Accounts)]
pub struct CancelSubscription<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,
    #[account(mut, has_one = mint)]
    pub offer: Box<Account<'info, Offer>>,
    #[account(
        mut,
        close = subscriber,
        seeds = [SUBSCRIPTION_SEED, offer.key().as_ref(), subscriber.key().as_ref()],
        bump = subscription.bump,
        has_one = offer,
        has_one = subscriber,
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
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_cancel_subscription(ctx: Context<CancelSubscription>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let offer = &mut ctx.accounts.offer;
    require!(offer.is_open(now), AllotError::BookNotOpen);
    let sub = &ctx.accounts.subscription;
    require!(
        ctx.accounts.vault.amount >= sub.amount,
        AllotError::StrategyNotEmpty
    );

    offer.units_requested -= sub.units;
    offer.floor_demand -= sub.units.min(offer.floor_units);
    offer.principal -= sub.amount;
    offer.weight_total -= sub.weight;
    offer.subscriber_count -= 1;

    let issuer = offer.issuer;
    let id_bytes = offer.offer_id.to_le_bytes();
    let signer: &[&[u8]] = &[OFFER_SEED, issuer.as_ref(), &id_bytes, &[offer.bump]];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.subscriber_token.to_account_info(),
                authority: offer.to_account_info(),
            },
            &[signer],
        ),
        sub.amount,
        offer.mint_decimals,
    )?;

    emit!(SubscriptionCancelled {
        offer: offer.key(),
        subscriber: ctx.accounts.subscriber.key(),
        amount: sub.amount,
    });
    Ok(())
}
