import {useEffect,useMemo,useState} from 'react';
import {invoke} from '../api';
import {useSession} from '../security/Session';
import type {Snapshot} from '../model';
import type {Page} from '../ui/WorkspaceNavigation';

export default function PendingCenter({data,onOpen}:{data:Snapshot;onOpen:(page:Page)=>void}){
  const {can}=useSession();const [backupError,setBackupError]=useState('');const [lookupError,setLookupError]=useState('');
  const canBackup=can('backup.create');
  useEffect(()=>{let active=true;if(canBackup)void invoke<{error:string}>('backup_center').then(result=>{if(active)setBackupError(result.error);}).catch(()=>{if(active)setLookupError('No se pudo consultar el estado del respaldo.');});return()=>{active=false;};},[canBackup]);
  const lowCount=useMemo(()=>data.products.reduce((count,p)=>count+Number(p.stock<=p.minimum),0),[data.products]);
  const printCount=useMemo(()=>data.sales.reduce((count,s)=>count+Number(s.print_status==='sending'||s.print_status==='uncertain'),0),[data.sales]);
  const items:{label:string;count:number;page:Page}[]=[];
  if(can('inventory.view')){
    items.push({label:'Productos por surtir',count:lowCount,page:'Surtido'});
    items.push({label:'Lotes por revisar',count:data.expiry_alerts[0]?.count??0,page:'Lotes'});
  }
  if(can('receipt.print'))items.push({label:'Impresiones inciertas en ventas recientes',count:printCount,page:'Historial'});
  if(canBackup&&backupError)items.push({label:'Respaldo automático con error',count:1,page:'Respaldos'});
  const pending=items.filter(item=>item.count>0);
  if(!items.length&&!lookupError)return null;
  return <details className="pending-center"><summary>Pendientes <span>{pending.reduce((sum,item)=>sum+item.count,0)}</span></summary><div className="pending-grid">{pending.map(item=><button key={item.page} type="button" onClick={()=>onOpen(item.page)}><strong>{item.count}</strong><span>{item.label}</span><span aria-hidden="true">→</span></button>)}{!pending.length&&<p>No hay pendientes en las categorías consultadas.</p>}{lookupError&&<p role="status">{lookupError} <button type="button" onClick={()=>onOpen('Respaldos')}>Revisar respaldos</button></p>}</div></details>;
}
