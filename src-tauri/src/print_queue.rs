use crate::{err, lifecycle, Result};
use std::{io::Write, sync::{mpsc, OnceLock, atomic::{AtomicUsize, Ordering}}, time::{Duration, Instant}};

const DEADLINE: Duration = Duration::from_secs(15);
static QUEUE: OnceLock<mpsc::SyncSender<Job>> = OnceLock::new();
static PENDING: AtomicUsize = AtomicUsize::new(0);

struct Job {
    port: String,
    baud: u32,
    bytes: Vec<u8>,
    deadline: Instant,
    reply: mpsc::SyncSender<Result<()>>,
    _operation: lifecycle::Operation,
}
impl Drop for Job {
    fn drop(&mut self) { PENDING.fetch_sub(1, Ordering::AcqRel); }
}
pub fn busy() -> bool { PENDING.load(Ordering::Acquire) != 0 }

fn remaining(deadline: Instant) -> Result<Duration> {
    let time=deadline.saturating_duration_since(Instant::now());
    if time.is_zero() { Err("La impresora tardó demasiado. Revisa el papel antes de pedir una copia.".into()) }
    else { Ok(time.min(Duration::from_secs(1))) }
}
fn transmit(job: &Job) -> Result<()> {
    // Expired queued jobs must never start printing later.
    let timeout=remaining(job.deadline)?;
    let mut device=serialport::new(&job.port,job.baud).timeout(timeout).open().map_err(err)?;
    let mut offset=0;
    while offset<job.bytes.len() {
        device.set_timeout(remaining(job.deadline)?).map_err(err)?;
        let end=(offset+256).min(job.bytes.len());
        let count=device.write(&job.bytes[offset..end]).map_err(err)?;
        if count==0 { return Err("La impresora dejó de recibir datos".into()); }
        offset+=count;
    }
    // FlushFileBuffers can wait indefinitely on Windows. Observe the driver's
    // output queue instead, keeping the same deadline as admission and writes.
    loop {
        remaining(job.deadline)?;
        if device.bytes_to_write().map_err(err)?==0 { return Ok(()); }
        std::thread::sleep(Duration::from_millis(20));
    }
}
pub fn send(port:String,baud:u32,bytes:Vec<u8>) -> Result<()> {
    let operation=lifecycle::enter()?;
    let sender=QUEUE.get_or_init(||{
        let (sender,receiver)=mpsc::sync_channel::<Job>(8);
        std::thread::spawn(move || {
            while let Ok(job)=receiver.recv() {
                let result=transmit(&job);
                let _=job.reply.try_send(result);
            }
        });
        sender
    });
    let (reply,response)=mpsc::sync_channel(1);
    let deadline=Instant::now()+DEADLINE;
    PENDING.fetch_add(1,Ordering::AcqRel);
    let job=Job {port,baud,bytes,deadline,reply,_operation:operation};
    sender.try_send(job).map_err(|error|match error {
        mpsc::TrySendError::Full(_)=>"Hay varios tickets pendientes. Revisa la impresora antes de reintentar.".to_string(),
        mpsc::TrySendError::Disconnected(_)=>"La impresión no está disponible. Reinicia la aplicación.".to_string(),
    })?;
    response.recv_timeout(deadline.saturating_duration_since(Instant::now()))
        .map_err(|_|"No se confirmó el envío a tiempo. Revisa el papel antes de pedir una copia.".to_string())?
}
