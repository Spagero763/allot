use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::invoke_signed,
    },
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{constants::*, error::AllotError, state::*};

const DEPOSIT: [u8; 8] = [242, 35, 198, 137, 82, 225, 242, 182];
const REDEEM: [u8; 8] = [184, 12, 86, 149, 70, 196, 97, 225];

const DEPOSIT_PASSTHROUGH: usize = 9;
const REDEEM_PASSTHROUGH: usize = 10;

#[derive(Accounts)]
pub struct Sweep<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = mint)]
    pub offer: Box<Account<'info, Offer>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub share_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = share_mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub shares: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: must be one of the known lending programs
    #[account(constraint = LENDERS.contains(&lender.key()) @ AllotError::UnknownLender)]
    pub lender: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_sweep<'info>(ctx: Context<'info, Sweep<'info>>, amount: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let offer = &ctx.accounts.offer;
    require!(!ctx.accounts.config.paused, AllotError::Paused);
    require!(offer.strategy == Strategy::JupiterLend, AllotError::NoStrategy);
    require!(offer.is_open(now), AllotError::BookNotOpen);
    let who = ctx.accounts.authority.key();
    require!(who == offer.issuer || who == ctx.accounts.config.admin, AllotError::NotAuthorized);
    require!(amount > 0, AllotError::InvalidTerms);
    require!(ctx.remaining_accounts.len() == DEPOSIT_PASSTHROUGH, AllotError::WrongOffer);

    let rest = ctx.remaining_accounts;
    let a = &ctx.accounts;
    let mut metas = vec![
        AccountMeta::new(a.offer.key(), true),
        AccountMeta::new(a.vault.key(), false),
        AccountMeta::new(a.shares.key(), false),
        AccountMeta::new_readonly(a.mint.key(), false),
        passthrough(&rest[0]),
        passthrough(&rest[1]),
        AccountMeta::new(a.share_mint.key(), false),
    ];
    metas.extend(rest[2..].iter().map(passthrough));
    metas.push(AccountMeta::new_readonly(a.token_program.key(), false));
    metas.push(AccountMeta::new_readonly(a.associated_token_program.key(), false));
    metas.push(AccountMeta::new_readonly(a.system_program.key(), false));

    let mut data = DEPOSIT.to_vec();
    data.extend_from_slice(&amount.to_le_bytes());

    let mut infos = vec![
        a.offer.to_account_info(),
        a.vault.to_account_info(),
        a.shares.to_account_info(),
        a.mint.to_account_info(),
        a.share_mint.to_account_info(),
        a.token_program.to_account_info(),
        a.associated_token_program.to_account_info(),
        a.system_program.to_account_info(),
        a.lender.to_account_info(),
    ];
    infos.extend(rest.iter().cloned());

    let issuer = offer.issuer;
    let id_bytes = offer.offer_id.to_le_bytes();
    let signer: &[&[u8]] = &[OFFER_SEED, issuer.as_ref(), &id_bytes, &[offer.bump]];
    let vault_before = a.vault.amount;
    let shares_before = a.shares.amount;
    invoke_signed(
        &Instruction { program_id: a.lender.key(), accounts: metas, data },
        &infos,
        &[signer],
    )?;

    ctx.accounts.vault.reload()?;
    ctx.accounts.shares.reload()?;
    let vault_after = ctx.accounts.vault.amount;
    require!(vault_before.checked_sub(vault_after) == Some(amount), AllotError::StrategyMismatch);
    require!(ctx.accounts.shares.amount > shares_before, AllotError::StrategyMismatch);

    let offer = &mut ctx.accounts.offer;
    let reserve = (offer.principal as u128 * SWEEP_RESERVE_BPS as u128 / BPS as u128) as u64;
    require!(vault_after >= reserve, AllotError::ReserveTooLow);
    offer.in_strategy = offer.in_strategy.checked_add(amount).ok_or(AllotError::Overflow)?;

    emit!(Swept { offer: offer.key(), amount, in_strategy: offer.in_strategy });
    Ok(())
}

#[derive(Accounts)]
pub struct Unsweep<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = mint)]
    pub offer: Box<Account<'info, Offer>>,
    #[account(
        seeds = [SUBSCRIPTION_SEED, offer.key().as_ref(), authority.key().as_ref()],
        bump = subscription.bump,
    )]
    pub subscription: Option<Account<'info, Subscription>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub share_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        associated_token::mint = share_mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub shares: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: must be one of the known lending programs
    #[account(constraint = LENDERS.contains(&lender.key()) @ AllotError::UnknownLender)]
    pub lender: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_unsweep<'info>(ctx: Context<'info, Unsweep<'info>>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let offer = &ctx.accounts.offer;
    let who = ctx.accounts.authority.key();
    require!(
        who == offer.issuer
            || who == ctx.accounts.config.admin
            || now >= offer.close_ts
            || ctx.accounts.subscription.is_some(),
        AllotError::NotAuthorized
    );
    require!(offer.in_strategy > 0, AllotError::NoStrategy);
    require!(ctx.remaining_accounts.len() == REDEEM_PASSTHROUGH, AllotError::WrongOffer);

    let rest = ctx.remaining_accounts;
    let a = &ctx.accounts;
    let mut metas = vec![
        AccountMeta::new(a.offer.key(), true),
        AccountMeta::new(a.shares.key(), false),
        AccountMeta::new(a.vault.key(), false),
        passthrough(&rest[0]),
        passthrough(&rest[1]),
        AccountMeta::new_readonly(a.mint.key(), false),
        AccountMeta::new(a.share_mint.key(), false),
    ];
    metas.extend(rest[2..].iter().map(passthrough));
    metas.push(AccountMeta::new_readonly(a.token_program.key(), false));
    metas.push(AccountMeta::new_readonly(a.associated_token_program.key(), false));
    metas.push(AccountMeta::new_readonly(a.system_program.key(), false));

    let mut data = REDEEM.to_vec();
    data.extend_from_slice(&a.shares.amount.to_le_bytes());

    let mut infos = vec![
        a.offer.to_account_info(),
        a.shares.to_account_info(),
        a.vault.to_account_info(),
        a.mint.to_account_info(),
        a.share_mint.to_account_info(),
        a.token_program.to_account_info(),
        a.associated_token_program.to_account_info(),
        a.system_program.to_account_info(),
        a.lender.to_account_info(),
    ];
    infos.extend(rest.iter().cloned());

    let issuer = offer.issuer;
    let id_bytes = offer.offer_id.to_le_bytes();
    let signer: &[&[u8]] = &[OFFER_SEED, issuer.as_ref(), &id_bytes, &[offer.bump]];
    let vault_before = a.vault.amount;
    invoke_signed(
        &Instruction { program_id: a.lender.key(), accounts: metas, data },
        &infos,
        &[signer],
    )?;

    ctx.accounts.vault.reload()?;
    ctx.accounts.shares.reload()?;
    require!(ctx.accounts.shares.amount == 0, AllotError::StrategyMismatch);
    let returned = ctx.accounts.vault.amount.saturating_sub(vault_before);

    let offer = &mut ctx.accounts.offer;
    let deployed = offer.in_strategy;
    offer.in_strategy = 0;

    emit!(Unswept { offer: offer.key(), deployed, returned });
    Ok(())
}

fn passthrough(info: &AccountInfo) -> AccountMeta {
    AccountMeta { pubkey: info.key(), is_signer: false, is_writable: info.is_writable }
}
