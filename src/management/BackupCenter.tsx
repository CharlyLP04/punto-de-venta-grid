import { useEffect, useState } from 'react';
import { invoke } from '../api';
import { useSession } from '../security/Session';
import { HardDrive, RotateCcw, Plus, Clock, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import ArcadeButton from '../ui/ArcadeButton';

type BackupFile = {
  name: string;
  bytes: number;
  modified: number;
};

type BackupCenterData = {
  files: BackupFile[];
  directory: string;
  hours: string;
  keep: string;
  last: string;
  error: string;
};

export default function BackupCenter() {
  const { user, lock } = useSession();
  const [data, setData] = useState<BackupCenterData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [destination,setDestination]=useState('');
  const [exportName,setExportName]=useState('');

  async function load() {
    try {
      const res = await invoke<BackupCenterData>('backup_center');
      setData(res);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createBackup() {
    if(busy)return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const path = await invoke<string>('backup');
      setNotice(`Respaldo creado con éxito: ${path}`);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function changeSchedule(hours: number) {
    if(busy)return;
    setBusy(true);
    setError('');
    try {
      await invoke('backup_schedule', { hours });
      setNotice('Frecuencia de respaldo automático actualizada.');
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function executeRestore() {
    if (!restoreTarget) return;
    if (confirmWord !== 'RESTAURAR') {
      setError('Debes escribir la palabra RESTAURAR en mayúsculas para confirmar.');
      return;
    }
    if(busy)return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await invoke('restore_backup', {
        name: restoreTarget.name,
        confirmation: confirmWord,
      });
      setNotice('¡Respaldo restaurado con éxito! Por seguridad tu sesión se renovará.');
      setRestoreTarget(null);
      setConfirmWord('');
      lock();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDate(unixSeconds: number) {
    if (!unixSeconds) return 'Sin fecha';
    return new Date(unixSeconds * 1000).toLocaleString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="backup-center-hub">
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}
      {data?.error&&<div className="alert error" role="alert">El último respaldo automático falló: {data.error}</div>}

      <div className="admin-grid">
        <article className="panel">
          <div className="section-head">
            <div>
              <h2>Copias de seguridad</h2>
              <p className="muted">
                Copias locales de tu tienda. En bases grandes, el respaldo puede retrasar brevemente una operación.
              </p>
            </div>
            <ArcadeButton
              onClick={createBackup}
              disabled={busy}
              className="primary"
            >
              <Plus size={16} />
              <span>Crear Respaldo Ahora</span>
            </ArcadeButton>
          </div>

          <div className="backup-meta-row">
            <div>
              <small>Ubicación en tu disco</small>
              <code className="directory-code">{data?.directory || 'Cargando carpeta...'}</code>
            </div>
            <div>
              <small>Último respaldo automático</small>
              <strong>{data?.last && data.last !== '0' ? formatDate(Number(data.last)) : 'Sin respaldo previo'}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <h2>Copia externa</h2><p className="muted">Conserva otra copia en una memoria USB. Una copia en el mismo disco no protege contra una falla de ese disco.</p>
          <label className="field"><span>Respaldo a copiar</span><select value={exportName} onChange={e=>setExportName(e.target.value)}><option value="">Selecciona una copia</option>{data?.files.map(file=><option key={file.name}>{file.name}</option>)}</select></label>
          <label className="field"><span>Carpeta existente de destino</span><input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Ej. E:\Respaldos"/></label>
          <button type="button" className="light" disabled={busy||!exportName||!destination.trim()} onClick={async()=>{setBusy(true);setError('');try{const path=await invoke<string>('export_backup',{name:exportName,destination});setNotice(`Copia externa guardada: ${path}`);}catch(e){setError(String(e));}finally{setBusy(false);}}}>Copiar sin reemplazar archivos</button>
          <h2 className="mt">Automatización</h2>
          <label className="field"><span>Copias automáticas a conservar</span><select disabled={busy} value={data?.keep??'0'} onChange={async e=>{const keep=Number(e.target.value);setBusy(true);setError('');try{await invoke('backup_retention',{keep});await load();setNotice(keep?`Después de una nueva copia se conservarán las últimas ${keep} automáticas. Las manuales se mantienen.`:'Se conservarán todas las copias.');}catch(e){setError(String(e));}finally{setBusy(false);}}}><option value="0">Todas · sin eliminación automática</option><option value="7">Últimas 7 automáticas</option><option value="30">Últimas 30 automáticas</option><option value="90">Últimas 90 automáticas</option></select></label><p className="muted">Si eliges un límite, las copias automáticas más antiguas se eliminan después de crear una nueva. Las manuales y las anteriores a una restauración se conservan.</p>
          <p className="muted">La aplicación genera copias mientras permanece abierta. Al volver a abrirla, crea la copia pendiente si ya pasó el intervalo.</p>
          <label className="field">
            <span>Frecuencia de respaldo automático</span>
            <select
              disabled={busy}
              value={data?.hours ?? '24'}
              onChange={e => void changeSchedule(Number(e.target.value))}
            >
              <option value="1">Cada hora</option>
              <option value="6">Cada 6 horas</option>
              <option value="12">Cada 12 horas</option>
              <option value="24">Diario (Cada 24 horas - Recomendado)</option>
              <option value="168">Semanal (Cada 7 días)</option>
              <option value="0">Desactivado (Solo manual)</option>
            </select>
          </label>
        </article>
      </div>

      <article className="panel">
        <div className="section-head">
          <div>
            <h2>Archivos de Respaldo Disponibles ({data?.files.length ?? 0})</h2>
            <p className="muted">
              Para restaurar, cierra el turno actual. Recuperarás los datos y contraseñas guardados en esa copia. Copia los archivos a otra unidad para protegerte de fallas del disco.
            </p>
          </div>
        </div>

        <div className="backup-files-list">
          {!data?.files.length && (
            <div className="calm-empty">No hay archivos de respaldo aún. Haz clic en "Crear Respaldo Ahora".</div>
          )}
          {data?.files.map(f => {
            const isAuto = f.name.includes('-auto-');
            const isPreRestore = f.name.includes('-antes-restaurar-');
            return (
              <div className="record backup-record-card" key={f.name}>
                <div className="backup-file-info">
                  <div className="backup-badges">
                    <span className={`status-pill ${isPreRestore ? 'warning' : isAuto ? 'neutral' : 'success'}`}>
                      {isPreRestore ? 'Antes de restaurar' : isAuto ? 'Automático' : 'Manual'}
                    </span>
                    <strong className="file-date">{formatDate(f.modified)}</strong>
                  </div>
                  <span className="file-name">{f.name}</span>
                  <small className="file-size">{formatBytes(f.bytes)}</small>
                </div>

                {user.role === 'owner' && (
                  <button
                    type="button"
                    className="light restore-btn"
                    disabled={busy}
                    onClick={() => {
                      setRestoreTarget(f);
                      setConfirmWord('');
                      setError('');
                    }}
                  >
                    <RotateCcw size={15} />
                    <span>Restaurar</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </article>

      {restoreTarget && (
        <article className="panel restore-confirm-panel">
          <div className="restore-danger-header">
            <ShieldAlert size={28} className="danger-icon" />
            <div>
              <h3>¿Confirmas restaurar este respaldo?</h3>
              <p>
                Se reemplazará la base de datos activa con el estado del archivo <b>{restoreTarget.name}</b> ({formatDate(restoreTarget.modified)}).
                Antes de restaurar se creará una copia de seguridad automática del estado actual.
              </p>
            </div>
          </div>

          <div className="restore-confirm-form">
            <label className="field">
              <span>Escribe la palabra <b>RESTAURAR</b> para confirmar:</span>
              <input
                type="text"
                value={confirmWord}
                onChange={e => setConfirmWord(e.target.value)}
                placeholder="RESTAURAR"
                autoFocus
              />
            </label>

            <div className="form-actions">
              <ArcadeButton
                variant="danger"
                onClick={executeRestore}
                disabled={busy || confirmWord !== 'RESTAURAR'}
              >
                {busy ? 'Restaurando...' : 'Confirmar Restauración'}
              </ArcadeButton>
              <button
                type="button"
                className="light"
                disabled={busy}
                onClick={() => setRestoreTarget(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}



