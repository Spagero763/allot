use anchor_lang::prelude::*;

use crate::{constants::ATTESTATION_SERVICE, error::AllotError};

const DISCRIMINATOR: u8 = 2;
const HEAD: usize = 1 + 32 + 32 + 32 + 4;

pub fn check(attestation: &AccountInfo, schema: &Pubkey, subject: &Pubkey, now: i64) -> Result<()> {
    require_keys_eq!(*attestation.owner, ATTESTATION_SERVICE, AllotError::NotEligible);
    let data = attestation.try_borrow_data()?;
    require!(data.len() >= HEAD && data[0] == DISCRIMINATOR, AllotError::NotEligible);
    let nonce = Pubkey::try_from(&data[1..33]).map_err(|_| AllotError::NotEligible)?;
    let credential = Pubkey::try_from(&data[33..65]).map_err(|_| AllotError::NotEligible)?;
    let found = Pubkey::try_from(&data[65..97]).map_err(|_| AllotError::NotEligible)?;
    let len = u32::from_le_bytes(data[97..101].try_into().unwrap()) as usize;
    let expiry_at = HEAD + len + 32;
    require!(data.len() >= expiry_at + 8, AllotError::NotEligible);
    let expiry = i64::from_le_bytes(data[expiry_at..expiry_at + 8].try_into().unwrap());

    require_keys_eq!(found, *schema, AllotError::NotEligible);
    require_keys_eq!(nonce, *subject, AllotError::NotEligible);
    require!(expiry == 0 || expiry > now, AllotError::NotEligible);
    let (expected, _) = Pubkey::find_program_address(
        &[b"attestation", credential.as_ref(), schema.as_ref(), subject.as_ref()],
        &ATTESTATION_SERVICE,
    );
    require_keys_eq!(expected, attestation.key(), AllotError::NotEligible);
    Ok(())
}
