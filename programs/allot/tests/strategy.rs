mod common;

use {
    allot::state::*,
    common::*,
    solana_keypair::Keypair,
    solana_signer::Signer,
};

const DAY: i64 = 86_400;

fn lending_offer(w: &mut World, id: u64, days: i64) -> anchor_lang::prelude::Pubkey {
    let mut args = w.offer_args(id);
    args.total_units = 100_000;
    args.close_ts = w.now + days * DAY;
    args.strategy = Strategy::JupiterLend;
    w.create_offer(args).unwrap()
}

#[test]
fn idle_book_money_earns_in_the_lending_market() {
    let mut w = World::fork();
    w.init_config(50);
    let offer = lending_offer(&mut w, 1, 30);

    let a = w.subscriber(usdc(60_000));
    let b = w.subscriber(usdc(90_000));
    w.subscribe(&offer, &a, 60_000).unwrap();
    w.subscribe(&offer, &b, 90_000).unwrap();

    let issuer = w.issuer.insecure_clone();
    w.sweep(&offer, &issuer, usdc(135_000)).unwrap();
    assert_eq!(w.balance(&w.vault_of(&offer)), usdc(15_000));
    assert_eq!(w.offer(&offer).in_strategy, usdc(135_000));
    assert!(w.balance(&w.shares_of(&offer)) > 0);
    assert!(w.close_offer(&offer).is_err());

    w.advance(30 * DAY + 1);
    assert!(w.close_offer(&offer).unwrap_err().contains("StrategyNotEmpty"));

    let anyone = Keypair::new();
    w.svm.airdrop(&anyone.pubkey(), 1_000_000_000).unwrap();
    w.unsweep(&offer, &anyone, false).unwrap();
    assert_eq!(w.balance(&w.shares_of(&offer)), 0);
    assert_eq!(w.offer(&offer).in_strategy, 0);

    w.close_offer(&offer).unwrap();
    let o = w.offer(&offer);
    assert!(o.success);
    assert_eq!(o.loss, 0);
    assert!(o.yield_total > 0, "thirty days in the market should earn something");
    assert_eq!(w.balance(&w.vault_of(&offer)), usdc(150_000) + o.yield_total);

    w.allot(&offer, &a.pubkey()).unwrap();
    w.allot(&offer, &b.pubkey()).unwrap();
    let sa = w.subscription(&offer, &a.pubkey());
    let sb = w.subscription(&offer, &b.pubkey());
    assert_eq!(sa.allotted_units, 40_000);
    assert_eq!(sb.allotted_units, 60_000);
    assert_eq!(sa.refund, usdc(20_000));
    assert_eq!(sb.refund, usdc(30_000));
    assert!(sa.yield_share > 0 && sb.yield_share > sa.yield_share);
    assert_eq!(w.token_balance(&a.pubkey()), usdc(20_000) + sa.yield_share);
    assert_eq!(w.token_balance(&b.pubkey()), usdc(30_000) + sb.yield_share);

    w.finalize(&offer).unwrap();
    let fee = usdc(100_000) * 50 / 10_000;
    let dust = o.yield_total - sa.yield_share - sb.yield_share;
    assert_eq!(w.token_balance(&w.fee_destination.pubkey()), fee);
    assert_eq!(w.token_balance(&w.treasury.pubkey()), usdc(100_000) - fee + dust);
    assert_eq!(w.balance(&w.vault_of(&offer)), 0);
    println!("yield on 135,000 USDC over 30 days: {} micro USDC", o.yield_total);
}

#[test]
fn sweep_is_gated_and_keeps_a_reserve() {
    let mut w = World::fork();
    w.init_config(50);
    let offer = lending_offer(&mut w, 1, 30);
    let a = w.subscriber(usdc(10_000));
    w.subscribe(&offer, &a, 10_000).unwrap();

    assert!(w.sweep(&offer, &a, usdc(1_000)).unwrap_err().contains("NotAuthorized"));

    let issuer = w.issuer.insecure_clone();
    assert!(w.sweep(&offer, &issuer, usdc(9_500)).unwrap_err().contains("ReserveTooLow"));

    let fake = Keypair::new().pubkey();
    assert!(w.sweep_with(&offer, &issuer, usdc(1_000), &fake).unwrap_err().contains("UnknownLender"));

    let plain = w.create_offer(w.offer_args(2)).unwrap();
    let c = w.subscriber(usdc(100));
    w.subscribe(&plain, &c, 100).unwrap();
    assert!(w.sweep(&plain, &issuer, usdc(10)).unwrap_err().contains("NoStrategy"));

    let admin = w.admin.insecure_clone();
    w.sweep(&offer, &admin, usdc(9_000)).unwrap();
    assert_eq!(w.offer(&offer).in_strategy, usdc(9_000));
}

#[test]
fn a_subscriber_can_pull_the_money_back_to_leave() {
    let mut w = World::fork();
    w.init_config(50);
    let offer = lending_offer(&mut w, 1, 30);
    let a = w.subscriber(usdc(40_000));
    let b = w.subscriber(usdc(10_000));
    w.subscribe(&offer, &a, 40_000).unwrap();
    w.subscribe(&offer, &b, 10_000).unwrap();

    let issuer = w.issuer.insecure_clone();
    w.sweep(&offer, &issuer, usdc(45_000)).unwrap();
    w.advance(DAY);

    assert!(w.cancel_subscription(&offer, &a).unwrap_err().contains("StrategyNotEmpty"));

    let stranger = Keypair::new();
    w.svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    assert!(w.unsweep(&offer, &stranger, false).unwrap_err().contains("NotAuthorized"));
    assert!(w.unsweep(&offer, &stranger, true).is_err());

    w.unsweep(&offer, &a, true).unwrap();
    assert!(w.balance(&w.vault_of(&offer)) >= usdc(50_000));
    w.cancel_subscription(&offer, &a).unwrap();
    assert_eq!(w.token_balance(&a.pubkey()), usdc(40_000));

    w.advance(30 * DAY);
    w.close_offer(&offer).unwrap();
    w.allot(&offer, &b.pubkey()).unwrap();
    w.finalize(&offer).unwrap();
    assert_eq!(w.receipt_balance(&offer, &b.pubkey()), 10_000);
    assert_eq!(w.balance(&w.vault_of(&offer)), 0);
}
