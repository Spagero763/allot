use anchor_lang::{prelude::*, system_program};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_2022::Token2022,
    token_2022_extensions::{token_metadata_initialize, TokenMetadataInitialize},
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::{constants::*, error::AllotError, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreateOfferArgs {
    pub offer_id: u64,
    pub unit_price: u64,
    pub total_units: u64,
    pub min_units: u64,
    pub max_units: u64,
    pub floor_units: u64,
    pub min_raise_units: u64,
    pub open_ts: i64,
    pub close_ts: i64,
    pub treasury: Pubkey,
    pub strategy: Strategy,
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[derive(Accounts)]
#[instruction(args: CreateOfferArgs)]
pub struct CreateOffer<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = issuer,
        space = 8 + Offer::INIT_SPACE,
        seeds = [OFFER_SEED, issuer.key().as_ref(), &args.offer_id.to_le_bytes()],
        bump
    )]
    pub offer: Box<Account<'info, Offer>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        init,
        payer = issuer,
        associated_token::mint = mint,
        associated_token::authority = offer,
        associated_token::token_program = token_program,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init,
        payer = issuer,
        seeds = [RECEIPT_SEED, offer.key().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = offer,
        mint::freeze_authority = offer,
        mint::token_program = token_2022_program,
        extensions::metadata_pointer::authority = offer,
        extensions::metadata_pointer::metadata_address = receipt_mint,
    )]
    pub receipt_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_offer(ctx: Context<CreateOffer>, args: CreateOfferArgs) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, AllotError::Paused);

    let now = Clock::get()?.unix_timestamp;
    require!(args.unit_price > 0 && args.total_units > 0, AllotError::InvalidTerms);
    require!(args.min_units >= 1 && args.min_units <= args.total_units, AllotError::InvalidTerms);
    require!(args.max_units == 0 || args.max_units >= args.min_units, AllotError::InvalidTerms);
    require!(args.floor_units <= args.total_units, AllotError::InvalidTerms);
    require!(args.min_raise_units <= args.total_units, AllotError::InvalidTerms);
    require!(args.close_ts > args.open_ts && args.close_ts > now, AllotError::InvalidTerms);
    require_keys_neq!(args.treasury, config.fee_destination, AllotError::InvalidTerms);
    require!(
        args.name.len() <= NAME_LEN && args.symbol.len() <= SYMBOL_LEN && args.uri.len() <= URI_LEN,
        AllotError::StringTooLong
    );
    (args.total_units as u128)
        .checked_mul(args.unit_price as u128)
        .and_then(|v| u64::try_from(v).ok())
        .ok_or(AllotError::Overflow)?;

    let offer = &mut ctx.accounts.offer;
    offer.issuer = ctx.accounts.issuer.key();
    offer.offer_id = args.offer_id;
    offer.mint = ctx.accounts.mint.key();
    offer.mint_decimals = ctx.accounts.mint.decimals;
    offer.receipt_mint = ctx.accounts.receipt_mint.key();
    offer.treasury = args.treasury;
    offer.fee_destination = config.fee_destination;
    offer.fee_bps = config.fee_bps;
    offer.unit_price = args.unit_price;
    offer.total_units = args.total_units;
    offer.min_units = args.min_units;
    offer.max_units = args.max_units;
    offer.floor_units = args.floor_units;
    offer.min_raise_units = args.min_raise_units;
    offer.open_ts = args.open_ts;
    offer.close_ts = args.close_ts;
    offer.strategy = args.strategy;
    offer.status = OfferStatus::Open;
    offer.name = args.name.clone();
    offer.symbol = args.symbol.clone();
    offer.uri = args.uri.clone();
    offer.bump = ctx.bumps.offer;

    fund_metadata_rent(&ctx, &args)?;

    let issuer_key = ctx.accounts.issuer.key();
    let id_bytes = args.offer_id.to_le_bytes();
    let signer: &[&[u8]] = &[OFFER_SEED, issuer_key.as_ref(), &id_bytes, &[ctx.bumps.offer]];
    token_metadata_initialize(
        CpiContext::new_with_signer(
            ctx.accounts.token_2022_program.key(),
            TokenMetadataInitialize {
                program_id: ctx.accounts.token_2022_program.to_account_info(),
                metadata: ctx.accounts.receipt_mint.to_account_info(),
                update_authority: ctx.accounts.offer.to_account_info(),
                mint_authority: ctx.accounts.offer.to_account_info(),
                mint: ctx.accounts.receipt_mint.to_account_info(),
            },
            &[signer],
        ),
        args.name,
        args.symbol,
        args.uri,
    )?;

    emit!(OfferCreated {
        offer: ctx.accounts.offer.key(),
        issuer: issuer_key,
        mint: ctx.accounts.mint.key(),
        receipt_mint: ctx.accounts.receipt_mint.key(),
        unit_price: args.unit_price,
        total_units: args.total_units,
        open_ts: args.open_ts,
        close_ts: args.close_ts,
    });
    Ok(())
}

fn fund_metadata_rent(ctx: &Context<CreateOffer>, args: &CreateOfferArgs) -> Result<()> {
    let mint_info = ctx.accounts.receipt_mint.to_account_info();
    let metadata_len = 4 + 32 + 32 + 32
        + 4 + args.name.len()
        + 4 + args.symbol.len()
        + 4 + args.uri.len()
        + 4;
    let needed = Rent::get()?.minimum_balance(mint_info.data_len() + metadata_len);
    let have = mint_info.lamports();
    if needed > have {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.issuer.to_account_info(),
                    to: mint_info,
                },
            ),
            needed - have,
        )?;
    }
    Ok(())
}
