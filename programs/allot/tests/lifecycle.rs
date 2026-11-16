mod common;

use {
    allot::state::*,
    anchor_lang::prelude::Pubkey,
    common::*,
    solana_signer::Signer,
};

#[test]
fn undersubscribed_book_settles_in_full() {
    let mut w = World::new();
    w.init_config(50);
    let offer = w.create_offer(w.offer_args(1)).unwrap();

    let a = w.subscriber(usdc(500));
    let b = w.subscriber(usdc(500));
    w.subscribe(&offer, &a, 300).unwrap();
    w.subscribe(&offer, &b, 200).unwrap();
    assert_eq!(w.balance(&w.vault_of(&offer)), usdc(500));

    w.advance(3_601);
    w.close_offer(&offer).unwrap();
    let o = w.offer(&offer);
    assert_eq!(o.status, OfferStatus::Closed);
    assert!(o.success);
    assert_eq!(o.yield_total, 0);

    w.allot(&offer, &a.pubkey()).unwrap();
    w.allot(&offer, &b.pubkey()).unwrap();
    assert_eq!(w.receipt_balance(&offer, &a.pubkey()), 300);
    assert_eq!(w.receipt_balance(&offer, &b.pubkey()), 200);
    assert_eq!(w.token_balance(&a.pubkey()), usdc(200));
    assert_eq!(w.token_balance(&b.pubkey()), usdc(300));

    w.finalize(&offer).unwrap();
    assert_eq!(w.token_balance(&w.fee_destination.pubkey()), usdc(500) * 50 / 10_000);
    assert_eq!(w.token_balance(&w.treasury.pubkey()), usdc(500) - usdc(500) * 50 / 10_000);
    assert_eq!(w.balance(&w.vault_of(&offer)), 0);
    assert_eq!(w.offer(&offer).status, OfferStatus::Settled);
}

#[test]
fn oversubscribed_book_allots_pro_rata_with_floor() {
    let mut w = World::new();
    w.init_config(0);
    let mut args = w.offer_args(2);
    args.total_units = 1_000;
    args.floor_units = 100;
    let offer = w.create_offer(args).unwrap();

    let small = w.subscriber(usdc(100));
    let big = w.subscriber(usdc(2_000));
    let mid = w.subscriber(usdc(400));
    w.subscribe(&offer, &small, 100).unwrap();
    w.subscribe(&offer, &big, 2_000).unwrap();
    w.subscribe(&offer, &mid, 400).unwrap();

    w.advance(3_601);
    w.close_offer(&offer).unwrap();
    for s in [&small, &big, &mid] {
        w.allot(&offer, &s.pubkey()).unwrap();
    }

    let floor_demand = 100 + 100 + 100;
    let remaining_supply = 1_000 - floor_demand;
    let remaining_demand = 2_500 - floor_demand;
    let expect_big = 100 + 1_900 * remaining_supply / remaining_demand;
    let expect_mid = 100 + 300 * remaining_supply / remaining_demand;

    assert_eq!(w.receipt_balance(&offer, &small.pubkey()), 100);
    assert_eq!(w.receipt_balance(&offer, &big.pubkey()), expect_big);
    assert_eq!(w.receipt_balance(&offer, &mid.pubkey()), expect_mid);
    assert_eq!(w.token_balance(&big.pubkey()), usdc(2_000 - expect_big));
    assert_eq!(w.token_balance(&mid.pubkey()), usdc(400 - expect_mid));

    let o = w.offer(&offer);
    assert!(o.units_allotted <= o.total_units);
    assert_eq!(o.units_allotted, 100 + expect_big + expect_mid);

    w.finalize(&offer).unwrap();
    assert_eq!(w.token_balance(&w.treasury.pubkey()), usdc(o.units_allotted));
    assert_eq!(w.balance(&w.vault_of(&offer)), 0);
}

#[test]
fn yield_is_split_by_time_in_the_book() {
    let mut w = World::new();
    w.init_config(0);
    let offer = w.create_offer(w.offer_args(3)).unwrap();

    let early = w.subscriber(usdc(100));
    let late = w.subscriber(usdc(100));
    w.subscribe(&offer, &early, 100).unwrap();
    w.advance(1_800);
    w.subscribe(&offer, &late, 100).unwrap();

    w.seed_yield(&offer, 3_000_000);
    w.advance(1_801);
    w.close_offer(&offer).unwrap();
    assert_eq!(w.offer(&offer).yield_total, 3_000_000);

    w.allot(&offer, &early.pubkey()).unwrap();
    w.allot(&offer, &late.pubkey()).unwrap();

    let e = w.subscription(&offer, &early.pubkey());
    let l = w.subscription(&offer, &late.pubkey());
    assert_eq!(e.yield_share, 2_000_000);
    assert_eq!(l.yield_share, 1_000_000);
    assert_eq!(w.token_balance(&early.pubkey()), 2_000_000);
    assert_eq!(w.token_balance(&late.pubkey()), 1_000_000);

    w.finalize(&offer).unwrap();
    assert_eq!(w.token_balance(&w.treasury.pubkey()), usdc(200));
    assert_eq!(w.balance(&w.vault_of(&offer)), 0);
}

#[test]
fn failed_raise_refunds_everyone_with_yield() {
    let mut w = World::new();
    w.init_config(50);
    let mut args = w.offer_args(4);
    args.min_raise_units = 500;
    let offer = w.create_offer(args).unwrap();

    let a = w.subscriber(usdc(100));
    w.subscribe(&offer, &a, 100).unwrap();
    w.seed_yield(&offer, 500_000);
    w.advance(3_601);
    w.close_offer(&offer).unwrap();
    assert!(!w.offer(&offer).success);

    w.allot(&offer, &a.pubkey()).unwrap();
    assert_eq!(w.receipt_balance(&offer, &a.pubkey()), 0);
    assert_eq!(w.token_balance(&a.pubkey()), usdc(100) + 500_000);

    w.finalize(&offer).unwrap();
    assert_eq!(w.token_balance(&w.fee_destination.pubkey()), 0);
    assert_eq!(w.balance(&w.vault_of(&offer)), 0);
}

#[test]
fn subscriber_can_leave_while_the_book_is_open() {
    let mut w = World::new();
    w.init_config(0);
    let offer = w.create_offer(w.offer_args(5)).unwrap();
    let a = w.subscriber(usdc(100));
    w.subscribe(&offer, &a, 100).unwrap();
    assert_eq!(w.offer(&offer).subscriber_count, 1);

    w.cancel_subscription(&offer, &a).unwrap();
    let o = w.offer(&offer);
    assert_eq!(o.subscriber_count, 0);
    assert_eq!(o.units_requested, 0);
    assert_eq!(o.principal, 0);
    assert_eq!(o.weight_total, 0);
    assert_eq!(w.token_balance(&a.pubkey()), usdc(100));

    w.subscribe(&offer, &a, 50).unwrap();
    w.advance(3_601);
    assert!(w.cancel_subscription(&offer, &a).is_err());
}

#[test]
fn issuer_can_cancel_an_open_offer() {
    let mut w = World::new();
    w.init_config(0);
    let offer = w.create_offer(w.offer_args(6)).unwrap();
    let a = w.subscriber(usdc(100));
    w.subscribe(&offer, &a, 100).unwrap();

    w.cancel_offer(&offer).unwrap();
    assert_eq!(w.offer(&offer).status, OfferStatus::Cancelled);
    assert!(w.subscribe(&offer, &a, 1).is_err());

    w.allot(&offer, &a.pubkey()).unwrap();
    assert_eq!(w.token_balance(&a.pubkey()), usdc(100));
    assert_eq!(w.receipt_balance(&offer, &a.pubkey()), 0);
    w.finalize(&offer).unwrap();
    assert_eq!(w.offer(&offer).status, OfferStatus::Settled);
}

#[test]
fn guards_hold() {
    let mut w = World::new();
    w.init_config(0);
    let mut args = w.offer_args(7);
    args.min_units = 10;
    args.max_units = 100;
    args.open_ts = w.now + 60;
    let offer = w.create_offer(args).unwrap();
    let a = w.subscriber(usdc(500));

    assert!(w.subscribe(&offer, &a, 10).is_err());
    w.advance(61);
    assert!(w.subscribe(&offer, &a, 9).is_err());
    assert!(w.subscribe(&offer, &a, 101).is_err());
    w.subscribe(&offer, &a, 10).unwrap();
    assert!(w.subscribe(&offer, &a, 10).is_err());

    assert!(w.close_offer(&offer).is_err());
    assert!(w.allot(&offer, &a.pubkey()).is_err());
    assert!(w.finalize(&offer).is_err());

    w.advance(3_600);
    assert!(w.subscribe(&offer, &a, 10).is_err());
    w.close_offer(&offer).unwrap();
    assert!(w.close_offer(&offer).is_err());
    assert!(w.finalize(&offer).is_err());
    w.allot(&offer, &a.pubkey()).unwrap();
    assert!(w.allot(&offer, &a.pubkey()).is_err());
    w.finalize(&offer).unwrap();
    assert!(w.finalize(&offer).is_err());
}

#[test]
fn bad_terms_are_rejected() {
    let mut w = World::new();
    w.init_config(0);

    let mut args = w.offer_args(8);
    args.close_ts = args.open_ts;
    assert!(w.create_offer(args).is_err());

    let mut args = w.offer_args(9);
    args.unit_price = 0;
    assert!(w.create_offer(args).is_err());

    let mut args = w.offer_args(10);
    args.floor_units = args.total_units + 1;
    assert!(w.create_offer(args).is_err());

    let mut args = w.offer_args(11);
    args.name = "x".repeat(33);
    assert!(w.create_offer(args).is_err());

    assert!(w.create_offer(w.offer_args(12)).is_ok());
}

#[test]
fn treasury_cannot_be_the_fee_destination() {
    let mut w = World::new();
    w.init_config(100);
    let mut args = w.offer_args(14);
    args.treasury = w.fee_destination.pubkey();
    assert!(w.create_offer(args).is_err());
}

#[test]
fn receipt_mint_carries_metadata() {
    let mut w = World::new();
    w.init_config(0);
    let offer = w.create_offer(w.offer_args(13)).unwrap();
    let mint = w.receipt_pda(&offer);
    let acc = w.svm.get_account(&mint).unwrap();
    assert_eq!(acc.owner, TOKEN_2022);
    let data = String::from_utf8_lossy(&acc.data);
    assert!(data.contains("Harbour Terminals Series A"));
    assert!(data.contains("HTA"));
    assert_eq!(w.offer(&offer).receipt_mint, mint);
}

#[test]
fn a_shortfall_is_shared_pro_rata_on_a_failed_raise() {
    let mut w = World::new();
    w.init_config(50);
    let mut args = w.offer_args(1);
    args.min_raise_units = 900;
    let offer = w.create_offer(args).unwrap();
    let a = w.subscriber(usdc(100));
    let b = w.subscriber(usdc(300));
    w.subscribe(&offer, &a, 100).unwrap();
    w.subscribe(&offer, &b, 300).unwrap();

    w.drain_vault(&offer, usdc(40));
    w.advance(3_601);
    w.close_offer(&offer).unwrap();
    let o = w.offer(&offer);
    assert!(!o.success);
    assert_eq!(o.loss, usdc(40));
    assert_eq!(o.yield_total, 0);

    w.allot(&offer, &a.pubkey()).unwrap();
    w.allot(&offer, &b.pubkey()).unwrap();
    assert_eq!(w.token_balance(&a.pubkey()), usdc(90));
    assert_eq!(w.token_balance(&b.pubkey()), usdc(270));
    w.finalize(&offer).unwrap();
    assert_eq!(w.balance(&w.vault_of(&offer)), 0);
}

#[test]
fn a_shortfall_never_blocks_settlement_of_a_filled_book() {
    let mut w = World::new();
    w.init_config(50);
    let mut args = w.offer_args(1);
    args.floor_units = 50;
    let offer = w.create_offer(args).unwrap();
    let subs: Vec<_> = [900u64, 700, 50, 350].iter().map(|u| (w.subscriber(usdc(*u)), *u)).collect();
    for (k, units) in &subs {
        w.subscribe(&offer, k, *units).unwrap();
    }

    w.drain_vault(&offer, 1_234_567);
    w.advance(3_601);
    w.close_offer(&offer).unwrap();
    assert_eq!(w.offer(&offer).loss, 1_234_567);

    let mut paid = 0;
    for (k, _) in &subs {
        w.allot(&offer, &k.pubkey()).unwrap();
        paid += w.token_balance(&k.pubkey());
    }
    w.finalize(&offer).unwrap();
    let o = w.offer(&offer);
    assert_eq!(o.status, OfferStatus::Settled);
    let fee = w.token_balance(&w.fee_destination.pubkey());
    let treasury = w.token_balance(&w.treasury.pubkey());
    assert_eq!(paid + fee + treasury, usdc(2_000) - 1_234_567);
    assert_eq!(w.balance(&w.vault_of(&offer)), 0);
}

#[test]
fn a_gated_book_admits_only_attested_wallets() {
    let mut w = World::new();
    w.init_config(50);
    let credential = Pubkey::new_unique();
    let schema = Pubkey::new_unique();
    let mut args = w.offer_args(1);
    args.gate = schema;
    let offer = w.create_offer(args).unwrap();

    let a = w.subscriber(usdc(500));
    assert!(w.subscribe(&offer, &a, 100).unwrap_err().contains("NotEligible"));

    let other_schema = Pubkey::new_unique();
    let wrong = w.attest(&credential, &other_schema, &a.pubkey(), 0);
    assert!(w.subscribe_with(&offer, &a, 100, Some(wrong)).unwrap_err().contains("NotEligible"));

    let expired = w.attest(&credential, &schema, &a.pubkey(), w.now - 1);
    assert!(w.subscribe_with(&offer, &a, 100, Some(expired)).unwrap_err().contains("NotEligible"));

    let b = w.subscriber(usdc(500));
    let someone_elses = w.attest(&credential, &schema, &b.pubkey(), 0);
    assert!(w.subscribe_with(&offer, &a, 100, Some(someone_elses)).unwrap_err().contains("NotEligible"));

    let valid = w.attest(&credential, &schema, &a.pubkey(), w.now + 86_400);
    w.subscribe_with(&offer, &a, 100, Some(valid)).unwrap();
    assert_eq!(w.offer(&offer).units_requested, 100);

    let forever = w.attest(&credential, &schema, &b.pubkey(), 0);
    w.subscribe_with(&offer, &b, 50, Some(forever)).unwrap();
    assert_eq!(w.offer(&offer).subscriber_count, 2);
}

#[test]
fn an_open_book_ignores_attestations() {
    let mut w = World::new();
    w.init_config(50);
    let offer = w.create_offer(w.offer_args(1)).unwrap();
    let a = w.subscriber(usdc(100));
    w.subscribe_with(&offer, &a, 10, Some(Pubkey::new_unique())).unwrap();
    assert_eq!(w.offer(&offer).units_requested, 10);
}

#[test]
fn random_books_always_settle_and_conserve_every_unit() {
    let mut seed = 0x1234_5678_9abc_def1u64;
    let mut rand = move |n: u64| {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        if n == 0 { 0 } else { seed % n }
    };
    let mut w = World::new();
    w.init_config(1 + rand(500) as u16);
    for round in 1..=12u64 {
        let total = 1 + rand(5_000);
        let mut args = w.offer_args(round);
        args.total_units = total;
        args.floor_units = rand(total / 3 + 1);
        args.min_raise_units = rand(total + 1);
        args.unit_price = 1_000 * (1 + rand(50));
        args.close_ts = w.now + 600;
        let offer = w.create_offer(args.clone()).unwrap();
        let base = w.token_balance(&w.fee_destination.pubkey()) + w.token_balance(&w.treasury.pubkey());
        let count = 1 + rand(7) as usize;
        let mut subs = Vec::new();
        let mut principal = 0u64;
        for _ in 0..count {
            let units = 1 + rand(total);
            let k = w.subscriber(units * args.unit_price);
            w.subscribe(&offer, &k, units).unwrap();
            principal += units * args.unit_price;
            subs.push(k);
            w.advance(1 + rand(60) as i64);
        }
        if rand(2) == 1 {
            w.seed_yield(&offer, rand(5_000_000));
        }
        w.advance(700);
        w.close_offer(&offer).unwrap();
        let o = w.offer(&offer);
        let mut paid = 0u64;
        for k in &subs {
            w.allot(&offer, &k.pubkey()).unwrap();
            paid += w.token_balance(&k.pubkey());
        }
        w.finalize(&offer).unwrap();
        let o2 = w.offer(&offer);
        assert_eq!(o2.status, OfferStatus::Settled);
        assert_eq!(w.balance(&w.vault_of(&offer)), 0, "vault not empty in round {round}");
        let fee = w.token_balance(&w.fee_destination.pubkey());
        let treasury = w.token_balance(&w.treasury.pubkey());
        let receipts: u64 = subs.iter().map(|k| w.receipt_balance(&offer, &k.pubkey())).sum();
        assert_eq!(receipts, o2.units_allotted, "receipts must equal units allotted");
        assert!(o2.units_allotted <= total);
        assert_eq!(paid + fee + treasury - base, principal + o.yield_total, "every unit must land somewhere in round {round}");
        assert_eq!(o.success, o.units_requested >= args.min_raise_units);
    }
}
