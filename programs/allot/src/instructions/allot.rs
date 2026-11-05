use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::{self, MintTo, Token2022},
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{constants::*, error::AllotError, math, state::*};

#[derive(Accounts)]
pub struct Allot<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, has_one = mint, has_one = receipt_mint)]
    pub offer: Box<Account<'info, Offer>>,
    #[account(
        mut,
        seeds = [SUBSCRIPTION_SEED, offer.key().as_ref(), subscriber.key().as_ref()],
        bump = subscription.bump,
        has_one = offer,
        has_one = subscriber,
    )]
    pub subscription: Account<'info, Subscription>,
    pub subscriber: SystemAccount<'info>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = subscriber,
        associated_token::token_program = token_program,
    )]
    pub subscriber_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub receipt_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = receipt_mint,
        associated_token::authority = subscriber,
        associated_token::token_program = token_2022_program,
    )]
    pub subscriber_receipt: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_allot(ctx: Context<Allot>) -> Result<()> {
    let offer = &mut ctx.accounts.offer;
    require!(
        matches!(offer.status, OfferStatus::Closed | OfferStatus::Cancelled),
        AllotError::WrongStatus
    );
    let sub = &mut ctx.accounts.subscription;
    require!(!sub.settled, AllotError::AlreadySettled);

    let allotted = if offer.success {
        let book = math::Book {
            total_units: offer.total_units,
            units_requested: offer.units_requested,
            floor_units: offer.floor_units,
            floor_demand: offer.floor_demand,
        };
        math::allotment(&book, sub.units).ok_or(AllotError::Overflow)?
    } else {
        0
    };
    let kept = (allotted as u128)
        .checked_mul(offer.unit_price as u128)
        .and_then(|v| u64::try_from(v).ok())
        .ok_or(AllotError::Overflow)?;
    let haircut = math::haircut(offer.loss, sub.amount, offer.principal).ok_or(AllotError::Overflow)?;
    let refund = sub.amount.checked_sub(kept).ok_or(AllotError::Overflow)?.saturating_sub(haircut);
    let yield_share = math::yield_share(offer.yield_total, sub.weight, offer.weight_total)
        .ok_or(AllotError::Overflow)?;

    sub.allotted_units = allotted;
    sub.refund = refund;
    sub.yield_share = yield_share;
    sub.settled = true;
    offer.units_allotted = offer.units_allotted.checked_add(allotted).ok_or(AllotError::Overflow)?;
    offer.yield_paid = offer.yield_paid.checked_add(yield_share).ok_or(AllotError::Overflow)?;
    offer.processed = offer.processed.checked_add(1).ok_or(AllotError::Overflow)?;

    let issuer = offer.issuer;
    let id_bytes = offer.offer_id.to_le_bytes();
    let signer: &[&[u8]] = &[OFFER_SEED, issuer.as_ref(), &id_bytes, &[offer.bump]];

    let payout = refund.checked_add(yield_share).ok_or(AllotError::Overflow)?;
    if payout > 0 {
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
            payout,
            offer.mint_decimals,
        )?;
    }
    if allotted > 0 {
        token_2022::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_2022_program.key(),
                MintTo {
                    mint: ctx.accounts.receipt_mint.to_account_info(),
                    to: ctx.accounts.subscriber_receipt.to_account_info(),
                    authority: offer.to_account_info(),
                },
                &[signer],
            ),
            allotted,
        )?;
    }

    emit!(Allotted {
        offer: offer.key(),
        subscriber: ctx.accounts.subscriber.key(),
        units: sub.units,
        allotted_units: allotted,
        refund,
        yield_share,
    });
    Ok(())
}
