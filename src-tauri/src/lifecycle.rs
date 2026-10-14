use std::sync::{Mutex, Condvar};
use std::time::{Duration, Instant};

struct State { closing: bool, active: usize }
static STATE: Mutex<State> = Mutex::new(State { closing: false, active: 0 });
static IDLE: Condvar = Condvar::new();

pub fn closing() -> bool { STATE.lock().map(|s| s.closing).unwrap_or(true) }
pub fn begin_shutdown() -> bool {
    let Ok(mut state) = STATE.lock() else { return false };
    if state.closing { return false; }
    state.closing = true;
    true
}
pub struct Operation;
pub fn enter() -> crate::Result<Operation> {
    let mut state = STATE.lock().map_err(crate::err)?;
    if state.closing { return Err("La caja se está cerrando. Espera a que termine.".into()); }
    state.active += 1;
    Ok(Operation)
}
impl Drop for Operation {
    fn drop(&mut self) {
        if let Ok(mut state) = STATE.lock() {
            state.active = state.active.saturating_sub(1);
            IDLE.notify_all();
        }
    }
}
pub fn wait_for_operations(timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    let Ok(mut state) = STATE.lock() else { return false };
    while state.active > 0 {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() { return false; }
        match IDLE.wait_timeout(state, remaining) {
            Ok((next, _)) => state = next,
            Err(_) => return false,
        }
    }
    true
}

pub fn cancel_shutdown() {
    if let Ok(mut state)=STATE.lock() { state.closing=false; }
}
