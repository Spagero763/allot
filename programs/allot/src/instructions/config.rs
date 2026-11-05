use anchor_lang::prelude::*;

use crate::{constants::*, error::AllotError, state::Config};

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_config(ctx: Context<InitConfig>, fee_bps: u16, fee_destination: Pubkey) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, AllotError::FeeTooHigh);
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.fee_destination = fee_destination;
    config.fee_bps = fee_bps;
    config.paused = false;
    config.bump = ctx.bumps.config;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
}

pub fn handle_update_config(
    ctx: Context<UpdateConfig>,
    fee_bps: u16,
    fee_destination: Pubkey,
    paused: bool,
    admin: Pubkey,
) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, AllotError::FeeTooHigh);
    let config = &mut ctx.accounts.config;
    config.fee_bps = fee_bps;
    config.fee_destination = fee_destination;
    config.paused = paused;
    config.admin = admin;
    Ok(())
}
