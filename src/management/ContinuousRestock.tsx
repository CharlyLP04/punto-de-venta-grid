import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ScanLine,X,PackageCheck} from 'lucide-react';
import {invoke} from '../api';
import {decimal,quantity,type Product} from '../model';

type Entry={requestId:string;action:{type:'restock';product:number;quantity:number;note:string}};
export default function ContinuousRestock({products,aliases,onRefresh,onClose}:{products:Product[];aliases:{code:string;product:number}[];onRefresh:()=>Promise<void>;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),scan=useRef<HTMLInputElement>(null),amount=useRef<HTMLInputElement>(null),flight=useRef(false),pending=useRef<Entry|null>(null);
 const [product,setProduct]=useState<Product|null>(null),[code,setCode]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(''),[retry,setRetry]=useState(false);
 const codes=useMemo(()=>{const byId=new Map(products.map(p=>[p.id,p]));const map=new Map(products.map(p=>[p.code,p]));for(const alias of aliases){const p=byId.get(alias.product);if(p)map.set(alias.code,p);}return map;},[products,aliases]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();scan.current?.focus();return()=>{previous?.focus();};},[]);
 useEffect(()=>{if(product)amount.current?.select();},[product]);
 function close(){if(flight.current)return;if(pending.current&&!window.confirm('No se pudo confirmar esta entrada. Revisa las existencias antes de volver a registrarla. ¿Cerrar?'))return;onClose();}
 function find(event:FormEvent){event.preventDefault();const found=codes.get(code.trim());setError(found?'':'No encontramos ese código. Revisa el catálogo.');setProduct(found??null);}
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(flight.current||!product)return;flight.current=true;setBusy(true);setError('');
  try{if(!pending.current){const value=decimal(String(new FormData(event.currentTarget).get('quantity')??''),3);if(value<=0||(product.unit==='pieza'&&value%1000!==0))throw new Error('Escribe una cantidad válida mayor que cero.');if(!note.trim())throw new Error('Escribe el proveedor o motivo.');pending.current={requestId:crypto.randomUUID(),action:{type:'restock',product:product.id,quantity:value,note:note.trim()}};}
   await invoke('mutate',pending.current);const value=pending.current.action.quantity;pending.current=null;setRetry(false);setSaved(`${product.name}: +${quantity(value)} ${product.unit}. Entrada guardada.`);setProduct(null);setCode('');
   try{await onRefresh();}catch{setError('La entrada se guardó. Vuelve a abrir Inventario para actualizar las existencias.');}
   requestAnimationFrame(()=>scan.current?.focus());
  }catch(e){const message=String(e);if(/Surte los componentes|Indica proveedor|Ingresa piezas enteras|permiso|Cantidad fuera de rango/i.test(message))pending.current=null;setError(message);setRetry(pending.current!==null);}finally{flight.current=false;setBusy(false);}
 }
 return <dialog ref={dialog} className="continuous-restock" aria-labelledby="receiving-title" onCancel={e=>{e.preventDefault();close();}}>
  <header><div><ScanLine aria-hidden="true"/><h2 id="receiving-title">Entrada continua</h2></div><button type="button" aria-label="Cerrar entrada continua" disabled={busy} onClick={close}><X/></button></header>
  <p>Escanea, indica la cantidad y guarda. El siguiente producto queda listo para escanear.</p>
  <div role="status" className="receiving-status">{saved&&<><PackageCheck aria-hidden="true"/>{saved}</>}</div>
  {error&&<p role="alert" className="alert error">{error}</p>}
  <form onSubmit={find}><label className="field"><span>Código de barras</span><input ref={scan} value={code} onChange={e=>setCode(e.target.value)} disabled={busy||retry} required autoComplete="off"/></label><button disabled={busy||retry} type="submit">Buscar producto</button></form>
  {product&&<form onSubmit={save}><h3>{product.name}</h3><fieldset disabled={busy||retry}><label className="field"><span>Cantidad en {product.unit}</span><input ref={amount} name="quantity" type="number" min={product.unit==='kg'?'0.001':'1'} step={product.unit==='kg'?'0.001':'1'} defaultValue="1" required/></label><label className="field"><span>Proveedor o motivo</span><input value={note} onChange={e=>setNote(e.target.value)} maxLength={200} required/></label></fieldset>{retry&&<p>Reintenta la misma entrada para confirmar su estado sin duplicarla.</p>}<button className="primary" type="submit" disabled={busy}>{busy?'Guardando…':retry?'Reintentar entrada':'Guardar y escanear siguiente'}</button></form>}
 </dialog>;
}
