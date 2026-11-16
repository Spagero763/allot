pub mod constants;
pub mod eligibility;
pub mod error;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("BJxkmWB63H6yzkmm3Vrv5a9zGe7FPfPe1uFcur77kTD3");

#[program]
pub mod allot {
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, fee_bps: u16, fee_destination: Pubkey) -> Result<()> {
        handle_init_config(ctx, fee_bps, fee_destination)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: u16,
        fee_destination: Pubkey,
        paused: bool,
        admin: Pubkey,
    ) -> Result<()> {
        handle_update_config(ctx, fee_bps, fee_destination, paused, admin)
    }

    pub fn create_offer(ctx: Context<CreateOffer>, args: CreateOfferArgs) -> Result<()> {
        handle_create_offer(ctx, args)
    }

    pub fn subscribe(ctx: Context<Subscribe>, units: u64) -> Result<()> {
        handle_subscribe(ctx, units)
    }

    pub fn cancel_subscription(ctx: Context<CancelSubscription>) -> Result<()> {
        handle_cancel_subscription(ctx)
    }

    pub fn close_offer(ctx: Context<CloseOffer>) -> Result<()> {
        handle_close_offer(ctx)
    }

    pub fn cancel_offer(ctx: Context<CancelOffer>) -> Result<()> {
        handle_cancel_offer(ctx)
    }

    pub fn allot(ctx: Context<Allot>) -> Result<()> {
        handle_allot(ctx)
    }

    pub fn finalize(ctx: Context<Finalize>) -> Result<()> {
        handle_finalize(ctx)
    }

    pub fn sweep<'info>(ctx: Context<'info, Sweep<'info>>, amount: u64) -> Result<()> {
        handle_sweep(ctx, amount)
    }

    pub fn unsweep<'info>(ctx: Context<'info, Unsweep<'info>>) -> Result<()> {
        handle_unsweep(ctx)
    }
}
