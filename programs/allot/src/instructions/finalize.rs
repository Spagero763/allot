use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{constants::*, error::AllotError, math, state::*};

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, has_one = mint, has_one = treasury, has_one = fee_destination)]
    pub offer: Box<Account<'info, Offer>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub treasury: SystemAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = treasury,
        associated_token::token_program = token_program,
    )]
    pub treasury_token: Box<InterfaceAccount<'info, TokenAccount>>,
    pub fee_destination: SystemAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = fee_destination,
        associated_token::token_program = token_program,
    )]
    pub fee_token: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_finalize(ctx: Context<Finalize>) -> Result<()> {
    let offer = &mut ctx.accounts.offer;
    require!(
        matches!(offer.status, OfferStatus::Closed | OfferStatus::Cancelled),
        AllotError::WrongStatus
    );
    require!(offer.processed == offer.subscriber_count, AllotError::Unprocessed);

    let proceeds = if offer.success {
        (offer.units_allotted as u128)
            .checked_mul(offer.unit_price as u128)
            .and_then(|v| u64::try_from(v).ok())
            .ok_or(AllotError::Overflow)?
    } else {
        0
    };
    let fee = math::fee(proceeds, offer.fee_bps).ok_or(AllotError::Overflow)?.min(ctx.accounts.vault.amount);
    let to_treasury = ctx.accounts.vault.amount.checked_sub(fee).ok_or(AllotError::Overflow)?;

    let issuer = offer.issuer;
    let id_bytes = offer.offer_id.to_le_bytes();
    let signer: &[&[u8]] = &[OFFER_SEED, issuer.as_ref(), &id_bytes, &[offer.bump]];
    if fee > 0 {
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.fee_token.to_account_info(),
                    authority: offer.to_account_info(),
                },
                &[signer],
            ),
            fee,
            offer.mint_decimals,
        )?;
    }
    if to_treasury > 0 {
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: offer.to_account_info(),
                },
                &[signer],
            ),
            to_treasury,
            offer.mint_decimals,
        )?;
    }
    offer.status = OfferStatus::Settled;

    emit!(OfferSettled {
        offer: offer.key(),
        proceeds,
        fee,
        units_allotted: offer.units_allotted,
    });
    Ok(())
}
