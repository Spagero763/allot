#![allow(dead_code)]

use {
    allot::state::*,
    anchor_lang::{prelude::Pubkey, solana_program::instruction::Instruction, AccountDeserialize, InstructionData, ToAccountMetas},
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_program_pack::Pack,
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

pub const SYSTEM: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const TOKEN: Pubkey = anchor_spl::token::ID;
pub const TOKEN_2022: Pubkey = anchor_spl::token_2022::ID;
pub const ATA: Pubkey = anchor_spl::associated_token::ID;
pub const DECIMALS: u8 = 6;

pub struct World {
    pub svm: LiteSVM,
    pub program: Pubkey,
    pub admin: Keypair,
    pub issuer: Keypair,
    pub fee_destination: Keypair,
    pub treasury: Keypair,
    pub mint: Pubkey,
    pub mint_authority: Keypair,
    pub now: i64,
}

impl World {
    pub fn new() -> Self {
        let mut svm = LiteSVM::new();
        let program = allot::id();
        let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/allot.so"));
        svm.add_program(program, bytes).unwrap();
        let admin = Keypair::new();
        let issuer = Keypair::new();
        let fee_destination = Keypair::new();
        let treasury = Keypair::new();
        let mint_authority = Keypair::new();
        for k in [&admin, &issuer, &fee_destination, &treasury, &mint_authority] {
            svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
        }
        let mut w = World {
            svm,
            program,
            admin,
            issuer,
            fee_destination,
            treasury,
            mint: Pubkey::default(),
            mint_authority,
            now: 1_800_000_000,
        };
        w.set_time(w.now);
        w.mint = w.create_mint();
        w
    }

    pub fn set_time(&mut self, ts: i64) {
        self.now = ts;
        let mut clock = self.svm.get_sysvar::<anchor_lang::solana_program::clock::Clock>();
        clock.unix_timestamp = ts;
        self.svm.set_sysvar(&clock);
    }

    pub fn advance(&mut self, seconds: i64) {
        let ts = self.now + seconds;
        self.set_time(ts);
        self.svm.expire_blockhash();
    }

    pub fn send(&mut self, ixs: &[Instruction], payer: &Keypair, signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &blockhash);
        let mut all: Vec<&Keypair> = vec![payer];
        for s in signers {
            if s.pubkey() != payer.pubkey() {
                all.push(s);
            }
        }
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &all).unwrap();
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?}\n{}", e.err, e.meta.logs.join("\n")))
    }

    pub fn create_mint(&mut self) -> Pubkey {
        let mint = Keypair::new();
        let rent = self.svm.minimum_balance_for_rent_exemption(spl_token_interface::state::Mint::LEN);
        let create = anchor_lang::solana_program::system_instruction::create_account(
            &self.mint_authority.pubkey(),
            &mint.pubkey(),
            rent,
            spl_token_interface::state::Mint::LEN as u64,
            &TOKEN,
        );
        let init = spl_token_interface::instruction::initialize_mint2(
            &TOKEN,
            &mint.pubkey(),
            &self.mint_authority.pubkey(),
            None,
            DECIMALS,
        )
        .unwrap();
        let authority = self.mint_authority.insecure_clone();
        self.send(&[create, init], &authority, &[&mint]).unwrap();
        mint.pubkey()
    }

    pub fn ata(&self, owner: &Pubkey, mint: &Pubkey, token_program: &Pubkey) -> Pubkey {
        spl_associated_token_account_interface::address::get_associated_token_address_with_program_id(
            owner,
            mint,
            token_program,
        )
    }

    pub fn fund(&mut self, owner: &Keypair, amount: u64) -> Pubkey {
        let ata = self.ata(&owner.pubkey(), &self.mint, &TOKEN);
        let create = spl_associated_token_account_interface::instruction::create_associated_token_account_idempotent(
            &owner.pubkey(),
            &owner.pubkey(),
            &self.mint,
            &TOKEN,
        );
        let mint_to = spl_token_interface::instruction::mint_to(
            &TOKEN,
            &self.mint,
            &ata,
            &self.mint_authority.pubkey(),
            &[],
            amount,
        )
        .unwrap();
        let authority = self.mint_authority.insecure_clone();
        let owner = owner.insecure_clone();
        self.send(&[create, mint_to], &owner, &[&authority]).unwrap();
        ata
    }

    pub fn balance(&self, account: &Pubkey) -> u64 {
        match self.svm.get_account(account) {
            Some(a) if a.data.len() >= 72 => u64::from_le_bytes(a.data[64..72].try_into().unwrap()),
            _ => 0,
        }
    }

    pub fn config_pda(&self) -> Pubkey {
        Pubkey::find_program_address(&[allot::constants::CONFIG_SEED], &self.program).0
    }

    pub fn offer_pda(&self, issuer: &Pubkey, offer_id: u64) -> Pubkey {
        Pubkey::find_program_address(
            &[allot::constants::OFFER_SEED, issuer.as_ref(), &offer_id.to_le_bytes()],
            &self.program,
        )
        .0
    }

    pub fn receipt_pda(&self, offer: &Pubkey) -> Pubkey {
        Pubkey::find_program_address(&[allot::constants::RECEIPT_SEED, offer.as_ref()], &self.program).0
    }

    pub fn sub_pda(&self, offer: &Pubkey, subscriber: &Pubkey) -> Pubkey {
        Pubkey::find_program_address(
            &[allot::constants::SUBSCRIPTION_SEED, offer.as_ref(), subscriber.as_ref()],
            &self.program,
        )
        .0
    }

    pub fn account<T: AccountDeserialize>(&self, key: &Pubkey) -> T {
        let acc = self.svm.get_account(key).expect("account missing");
        let mut data: &[u8] = &acc.data;
        T::try_deserialize(&mut data).unwrap()
    }

    pub fn init_config(&mut self, fee_bps: u16) {
        let ix = Instruction::new_with_bytes(
            self.program,
            &allot::instruction::InitConfig { fee_bps, fee_destination: self.fee_destination.pubkey() }.data(),
            allot::accounts::InitConfig {
                admin: self.admin.pubkey(),
                config: self.config_pda(),
                system_program: SYSTEM,
            }
            .to_account_metas(None),
        );
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &admin, &[]).unwrap();
    }

    pub fn offer_args(&self, offer_id: u64) -> allot::instructions::CreateOfferArgs {
        allot::instructions::CreateOfferArgs {
            offer_id,
            unit_price: 1_000_000,
            total_units: 1_000,
            min_units: 1,
            max_units: 0,
            floor_units: 0,
            min_raise_units: 0,
            open_ts: self.now,
            close_ts: self.now + 3_600,
            treasury: self.treasury.pubkey(),
            strategy: Strategy::Idle,
            name: "Harbour Terminals Series A".to_string(),
            symbol: "HTA".to_string(),
            uri: "https://example.org/hta.json".to_string(),
        }
    }

    pub fn create_offer(&mut self, args: allot::instructions::CreateOfferArgs) -> Result<Pubkey, String> {
        let offer = self.offer_pda(&self.issuer.pubkey(), args.offer_id);
        let ix = Instruction::new_with_bytes(
            self.program,
            &allot::instruction::CreateOffer { args }.data(),
            allot::accounts::CreateOffer {
                issuer: self.issuer.pubkey(),
                config: self.config_pda(),
                offer,
                mint: self.mint,
                vault: self.ata(&offer, &self.mint, &TOKEN),
                receipt_mint: self.receipt_pda(&offer),
                token_program: TOKEN,
                token_2022_program: TOKEN_2022,
                associated_token_program: ATA,
                system_program: SYSTEM,
            }
            .to_account_metas(None),
        );
        let issuer = self.issuer.insecure_clone();
        self.send(&[ix], &issuer, &[]).map(|_| offer)
    }

    pub fn subscribe(&mut self, offer: &Pubkey, subscriber: &Keypair, units: u64) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            self.program,
            &allot::instruction::Subscribe { units }.data(),
            allot::accounts::Subscribe {
                subscriber: subscriber.pubkey(),
                config: self.config_pda(),
                offer: *offer,
                subscription: self.sub_pda(offer, &subscriber.pubkey()),
                mint: self.mint,
                vault: self.ata(offer, &self.mint, &TOKEN),
                subscriber_token: self.ata(&subscriber.pubkey(), &self.mint, &TOKEN),
                token_program: TOKEN,
                system_program: SYSTEM,
            }
            .to_account_metas(None),
        );
        let s = subscriber.insecure_clone();
        self.send(&[ix], &s, &[])
    }

    pub fn cancel_subscription(&mut self, offer: &Pubkey, subscriber: &Keypair) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            self.program,
            &allot::instruction::CancelSubscription {}.data(),
            allot::accounts::CancelSubscription {
                subscriber: subscriber.pubkey(),
                offer: *offer,
                subscription: self.sub_pda(offer, &subscriber.pubkey()),
                mint: self.mint,
                vault: self.ata(offer, &self.mint, &TOKEN),
                subscriber_token: self.ata(&subscriber.pubkey(), &self.mint, &TOKEN),
                token_program: TOKEN,
            }
            .to_account_metas(None),
        );
        let s = subscriber.insecure_clone();
        self.send(&[ix], &s, &[])
    }

    pub fn close_offer(&mut self, offer: &Pubkey) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            self.program,
            &allot::instruction::CloseOffer {}.data(),
            allot::accounts::CloseOffer {
                offer: *offer,
                mint: self.mint,
                vault: self.ata(offer, &self.mint, &TOKEN),
                token_program: TOKEN,
            }
            .to_account_metas(None),
        );
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &admin, &[])
    }

    pub fn cancel_offer(&mut self, offer: &Pubkey) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            self.program,
            &allot::instruction::CancelOffer {}.data(),
            allot::accounts::CancelOffer {
                issuer: self.issuer.pubkey(),
                offer: *offer,
                mint: self.mint,
                vault: self.ata(offer, &self.mint, &TOKEN),
                token_program: TOKEN,
            }
            .to_account_metas(None),
        );
        let issuer = self.issuer.insecure_clone();
        self.send(&[ix], &issuer, &[])
    }

    pub fn allot(&mut self, offer: &Pubkey, subscriber: &Pubkey) -> Result<(), String> {
        let receipt_mint = self.receipt_pda(offer);
        let ix = Instruction::new_with_bytes(
            self.program,
            &allot::instruction::Allot {}.data(),
            allot::accounts::Allot {
                payer: self.admin.pubkey(),
                offer: *offer,
                subscription: self.sub_pda(offer, subscriber),
                subscriber: *subscriber,
                mint: self.mint,
                vault: self.ata(offer, &self.mint, &TOKEN),
                subscriber_token: self.ata(subscriber, &self.mint, &TOKEN),
                receipt_mint,
                subscriber_receipt: self.ata(subscriber, &receipt_mint, &TOKEN_2022),
                token_program: TOKEN,
                token_2022_program: TOKEN_2022,
                associated_token_program: ATA,
                system_program: SYSTEM,
            }
            .to_account_metas(None),
        );
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &admin, &[])
    }

    pub fn finalize(&mut self, offer: &Pubkey) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            self.program,
            &allot::instruction::Finalize {}.data(),
            allot::accounts::Finalize {
                payer: self.admin.pubkey(),
                offer: *offer,
                mint: self.mint,
                vault: self.ata(offer, &self.mint, &TOKEN),
                treasury: self.treasury.pubkey(),
                treasury_token: self.ata(&self.treasury.pubkey(), &self.mint, &TOKEN),
                fee_destination: self.fee_destination.pubkey(),
                fee_token: self.ata(&self.fee_destination.pubkey(), &self.mint, &TOKEN),
                token_program: TOKEN,
                associated_token_program: ATA,
                system_program: SYSTEM,
            }
            .to_account_metas(None),
        );
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &admin, &[])
    }

    pub fn vault_of(&self, offer: &Pubkey) -> Pubkey {
        self.ata(offer, &self.mint, &TOKEN)
    }

    pub fn seed_yield(&mut self, offer: &Pubkey, amount: u64) {
        let vault = self.vault_of(offer);
        let ix = spl_token_interface::instruction::mint_to(
            &TOKEN,
            &self.mint,
            &vault,
            &self.mint_authority.pubkey(),
            &[],
            amount,
        )
        .unwrap();
        let authority = self.mint_authority.insecure_clone();
        self.send(&[ix], &authority, &[]).unwrap();
    }

    pub fn subscriber(&mut self, funds: u64) -> Keypair {
        let k = Keypair::new();
        self.svm.airdrop(&k.pubkey(), 5_000_000_000).unwrap();
        self.fund(&k, funds);
        k
    }

    pub fn receipt_balance(&self, offer: &Pubkey, subscriber: &Pubkey) -> u64 {
        self.balance(&self.ata(subscriber, &self.receipt_pda(offer), &TOKEN_2022))
    }

    pub fn token_balance(&self, owner: &Pubkey) -> u64 {
        self.balance(&self.ata(owner, &self.mint, &TOKEN))
    }

    pub fn offer(&self, key: &Pubkey) -> Offer {
        self.account(key)
    }

    pub fn subscription(&self, offer: &Pubkey, subscriber: &Pubkey) -> Subscription {
        self.account(&self.sub_pda(offer, subscriber))
    }
}

pub fn usdc(n: u64) -> u64 {
    n * 1_000_000
}
