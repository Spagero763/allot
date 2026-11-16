use anchor_lang::prelude::*;

#[error_code]
pub enum AllotError {
    #[msg("protocol is paused")]
    Paused,
    #[msg("fee exceeds the maximum")]
    FeeTooHigh,
    #[msg("offer terms are invalid")]
    InvalidTerms,
    #[msg("name, symbol or uri is too long")]
    StringTooLong,
    #[msg("the book is not open")]
    BookNotOpen,
    #[msg("the book has not closed yet")]
    BookStillOpen,
    #[msg("offer is not in the expected status")]
    WrongStatus,
    #[msg("units are below the minimum for this offer")]
    BelowMinimum,
    #[msg("units are above the maximum for this offer")]
    AboveMaximum,
    #[msg("the strategy still holds funds")]
    StrategyNotEmpty,
    #[msg("offer has no strategy")]
    NoStrategy,
    #[msg("subscription already settled")]
    AlreadySettled,
    #[msg("subscriptions are still unprocessed")]
    Unprocessed,
    #[msg("account does not belong to this offer")]
    WrongOffer,
    #[msg("signer may not do this")]
    NotAuthorized,
    #[msg("lending program is not recognised")]
    UnknownLender,
    #[msg("sweep would leave the vault below its reserve")]
    ReserveTooLow,
    #[msg("strategy balances did not move as expected")]
    StrategyMismatch,
    #[msg("this book requires an attestation the subscriber does not hold")]
    NotEligible,
    #[msg("arithmetic overflow")]
    Overflow,
}
