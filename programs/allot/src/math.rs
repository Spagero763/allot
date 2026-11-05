pub struct Book {
    pub total_units: u64,
    pub units_requested: u64,
    pub floor_units: u64,
    pub floor_demand: u64,
}

pub fn allotment(book: &Book, requested: u64) -> Option<u64> {
    if book.units_requested <= book.total_units {
        return Some(requested);
    }
    let guaranteed = requested.min(book.floor_units);
    if book.floor_units == 0 || book.floor_demand > book.total_units {
        return pro_rata(requested, book.total_units, book.units_requested);
    }
    let remaining_supply = book.total_units - book.floor_demand;
    let remaining_demand = book.units_requested - book.floor_demand;
    let extra = if remaining_demand == 0 {
        0
    } else {
        pro_rata(requested - guaranteed, remaining_supply, remaining_demand)?
    };
    guaranteed.checked_add(extra)
}

fn pro_rata(part: u64, supply: u64, demand: u64) -> Option<u64> {
    if demand == 0 {
        return Some(0);
    }
    let v = (part as u128).checked_mul(supply as u128)? / demand as u128;
    u64::try_from(v).ok()
}

pub fn yield_share(yield_total: u64, weight: u128, weight_total: u128) -> Option<u64> {
    if weight_total == 0 || yield_total == 0 {
        return Some(0);
    }
    let v = (yield_total as u128).checked_mul(weight)? / weight_total;
    u64::try_from(v).ok()
}

pub fn haircut(loss: u64, amount: u64, principal: u64) -> Option<u64> {
    if loss == 0 || principal == 0 {
        return Some(0);
    }
    let v = (loss as u128).checked_mul(amount as u128)?.div_ceil(principal as u128);
    u64::try_from(v).ok()
}

pub fn weight(amount: u64, committed_ts: i64, close_ts: i64) -> u128 {
    let seconds = close_ts.saturating_sub(committed_ts).max(0) as u128;
    (amount as u128) * seconds
}

pub fn fee(proceeds: u64, fee_bps: u16) -> Option<u64> {
    let v = (proceeds as u128).checked_mul(fee_bps as u128)? / crate::constants::BPS as u128;
    u64::try_from(v).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn book(total: u64, requested: u64, floor: u64, floor_demand: u64) -> Book {
        Book { total_units: total, units_requested: requested, floor_units: floor, floor_demand }
    }

    #[test]
    fn haircut_rounds_up_and_covers_the_loss() {
        assert_eq!(haircut(0, 500, 1_000), Some(0));
        assert_eq!(haircut(1, 500, 1_000), Some(1));
        assert_eq!(haircut(100, 250, 1_000), Some(25));
        let parts = [333u64, 333, 334];
        let taken: u64 = parts.iter().map(|p| haircut(7, *p, 1_000).unwrap()).sum();
        assert!(taken >= 7);
    }

    #[test]
    fn undersubscribed_gets_full_request() {
        assert_eq!(allotment(&book(1000, 600, 0, 0), 250), Some(250));
    }

    #[test]
    fn pure_pro_rata_rounds_down() {
        let b = book(1000, 3000, 0, 0);
        assert_eq!(allotment(&b, 1000), Some(333));
        assert_eq!(allotment(&b, 7), Some(2));
    }

    #[test]
    fn floor_is_honoured_then_pro_rata() {
        let b = book(1000, 2000, 100, 300);
        assert_eq!(allotment(&b, 100), Some(100));
        assert_eq!(allotment(&b, 1000), Some(100 + 900 * 700 / 1700));
    }

    #[test]
    fn floor_falls_back_when_unaffordable() {
        let b = book(100, 1000, 50, 500);
        assert_eq!(allotment(&b, 50), Some(5));
    }

    #[test]
    fn allotment_never_exceeds_supply() {
        let cases: &[(u64, u64, &[u64])] = &[
            (1000, 100, &[100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 1500]),
            (1000, 100, &[50, 2000, 400]),
            (1000, 0, &[1, 999, 1000, 3]),
            (7, 3, &[10, 10, 10, 1]),
            (1000, 1000, &[5000, 5000]),
            (1000, 250, &[300, 300, 300, 300]),
        ];
        for (total, floor, requests) in cases {
            let requested: u64 = requests.iter().sum();
            let floor_demand: u64 = requests.iter().map(|r| (*r).min(*floor)).sum();
            let b = book(*total, requested, *floor, floor_demand);
            let sum: u64 = requests.iter().map(|r| allotment(&b, *r).unwrap()).sum();
            assert!(sum <= *total, "total {total} floor {floor} requests {requests:?} gave {sum}");
            for r in *requests {
                assert!(allotment(&b, *r).unwrap() <= *r);
            }
        }
    }

    #[test]
    fn yield_split_is_time_weighted() {
        let a = weight(1_000, 0, 100);
        let b = weight(1_000, 50, 100);
        assert_eq!(yield_share(300, a, a + b), Some(200));
        assert_eq!(yield_share(300, b, a + b), Some(100));
    }

    #[test]
    fn fee_in_bps() {
        assert_eq!(fee(1_000_000, 50), Some(5_000));
        assert_eq!(fee(0, 50), Some(0));
    }
}
