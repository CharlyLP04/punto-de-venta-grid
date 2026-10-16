import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {decimal,money,quantity,type Snapshot} from '../model';

export type SupplyOrder={id:string;supplier:number;supplier_name:string;status:string;body:string;created:string};
export type SupplyBody={lines:{product:number;quantity:number;cost:number;received?:number}[];note:string;total:number;receipts?:{id:string;total:number;created:string;note:string;closed_remaining:boolean;price_changes:{product:number;previous:number;price:number}[]}[]};
export type PurchaseDraft={product:number;quantity:string;cost:string};
type Save=(action:Record<string,unknown>)=>Promise<boolean>;
const amount=(value:string)=>{try{return decimal(value);}catch{return 0;}};

const supplyCollator=new Intl.Collator('es-MX');
export function BudgetPlanner({data,orders,supplier,busy,onApply}:{data:Snapshot;orders:SupplyOrder[];supplier:number;busy:boolean;onApply:(rows:PurchaseDraft[],budget:number)=>void}){
 const [budget,setBudget]=useState('');const [wholeCatalog,setWholeCatalog]=useState(false);const [message,setMessage]=useState('');
 const known=useMemo(()=>new Set(orders.filter(o=>o.supplier===supplier).flatMap(o=>(JSON.parse(o.body) as SupplyBody).lines.map(l=>l.product))),[orders,supplier]);
 const candidates=useMemo(()=>{
  const frequency=new Map(data.frequencies.map(f=>[f.product,f.count]));
  return data.products.filter(p=>(wholeCatalog||known.has(p.id))&&p.stock<=p.minimum&&p.target>p.stock).sort((a,b)=>Number(b.stock<=0)-Number(a.stock<=0)||(frequency.get(b.id)??0)-(frequency.get(a.id)??0)||supplyCollator.compare(a.name,b.name));
 },[wholeCatalog,known,data.products,data.frequencies]);
 // Prepare quantities once per catalog/supplier change, not for each budget keystroke.
 const prepared=useMemo(()=>{
  let skipped=0;
  const rows: {product:Snapshot['products'][number];step:number;wanted:number}[]=[];
  for(const product of candidates){
   if(product.cost<=0||product.cost_known===0){skipped++;continue;}
   const step=product.unit==='pieza'?1000:100;
   rows.push({product,step,wanted:Math.min(1_000_000,Math.ceil((product.target-product.stock)/step)*step)});
  }
  return {rows,skipped};
 },[candidates]);
 const plan=useMemo(()=>{
  let remaining=amount(budget);const rows:PurchaseDraft[]=[];const skipped=prepared.skipped;

  for(const {product:p,step,wanted} of prepared.rows){
   if(rows.length>=200)break;
   let qty=Math.min(wanted,Math.floor(remaining*1000/p.cost/step)*step);
   while(qty>0&&Math.round(qty*p.cost/1000)>remaining)qty-=step;
   if(qty<=0||rows.length>=200)continue;
   remaining-=Math.round(qty*p.cost/1000);
   rows.push({product:p.id,quantity:String(qty/1000),cost:(p.cost/100).toFixed(2)});
  }
  return {rows,spent:amount(budget)-remaining,remaining,skipped,candidates:candidates.length};
 },[budget,candidates,prepared]);
 return <details className="supply-budget"><summary>Surtir con un presupuesto</summary><p>Primero agotados, después productos con ventas recientes. Usa tus mínimos y objetivos; es una estimación, no un pronóstico.</p><div className="form-pair"><label className="field">¿Cuánto puedes gastar? ($)<input type="number" min="0.01" max="1000000" step="0.01" value={budget} disabled={busy} onChange={e=>{setBudget(e.target.value);setMessage('');}}/></label><label className="check-row"><input type="checkbox" checked={wholeCatalog} disabled={busy} onChange={e=>setWholeCatalog(e.target.checked)}/>Incluir todo el catálogo; yo confirmaré qué vende este proveedor</label></div><p>Sin esta opción solo se usan productos de sus pedidos recientes. Los costos son estimados y se revisan al recibir. No se descuentan otros pedidos pendientes.</p><div className="supply-totals"><span>{plan.rows.length} productos</span><strong>Propuesta {money(plan.spent)}</strong><span>Quedan {money(plan.remaining)}</span></div>{plan.skipped>0&&<p role="status">{plan.skipped} productos necesitan un costo confirmado antes de sugerirlos.</p>}{amount(budget)>0&&!plan.rows.length&&<p>No hay productos que se puedan incluir. Revisa el proveedor, los objetivos de inventario o el presupuesto.</p>}<button type="button" className="light" disabled={busy||!supplier||!plan.rows.length} onClick={()=>{onApply(plan.rows,amount(budget));setMessage('Propuesta colocada en el pedido. Ajusta cantidades y confirma el proveedor antes de guardar.');}}>Usar propuesta en el pedido</button>{message&&<p role="status">{message}</p>}</details>;
}

export function ReceiveDelivery({order,data,busy,canPrice,canCash,onSave,onClose}:{order:SupplyOrder;data:Snapshot;busy:boolean;canPrice:boolean;canCash:boolean;onSave:Save;onClose:()=>void}){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});},[]);
 const body=useMemo(()=>JSON.parse(order.body) as SupplyBody,[order.body]);
 const products=useMemo(()=>new Map(data.products.map(p=>[p.id,p])),[data.products]);
 const [rows,setRows]=useState(()=>body.lines.filter(l=>l.quantity>(l.received??0)).map(l=>({product:l.product,remaining:l.quantity-(l.received??0),quantity:'0',cost:(l.cost/100).toFixed(2),price:'',change:false,lot:'',expires:''})));
 const [stage,setStage]=useState(0);const [pay,setPay]=useState(false);const [closeRemaining,setCloseRemaining]=useState(false);const [note,setNote]=useState('');const [error,setError]=useState('');
 function patch(id:number,change:Partial<typeof rows[number]>){setRows(v=>v.map(r=>r.product===id?{...r,...change}:r));setStage(0);}
 function payload(){
  const lines=rows.flatMap(r=>{
   const qty=decimal(r.quantity,3);if(qty>r.remaining)throw new Error('No recibas más de lo pendiente. Agrega los extras a otro pedido.');
   if(qty===0)return [];
   const p=products.get(r.product);if(!p)throw new Error('Un producto ya no está disponible. Recarga el pedido.');
   if(p.unit==='pieza'&&qty%1000)throw new Error('Las piezas se reciben completas.');
   return [{product:r.product,quantity:qty,cost:decimal(r.cost),expected_price:p.price,price:r.change?decimal(r.price):null,lot:r.lot,expires:r.expires}];
  }).filter(r=>r.quantity>0);
  if(!lines.length&&!closeRemaining)throw new Error('Indica lo que recibiste; puedes dejar en cero lo que no llegó.');
  if(closeRemaining&&!note.trim())throw new Error('Explica por qué cerrarás lo que falta.');
  return {type:'deliver',id:order.id,expected_body:order.body,lines,pay_cash:pay,close_remaining:closeRemaining,note};
 }
 const total=rows.reduce((sum,r)=>sum+Math.round(Number(r.quantity||0)*amount(r.cost)),0);
 async function submit(e:FormEvent){e.preventDefault();try{const action=payload();setError('');if(stage===0){setStage(1);return;}if(await onSave(action))onClose();}catch(e){setError(String(e));}}
 return <form className="panel delivery-flow" onSubmit={submit}><div className="section-head"><div><h2 ref={heading} tabIndex={-1}>Recibir de {order.supplier_name}</h2><p>{stage===0?'1. Cuenta lo que llegó y revisa el costo':'2. Confirma la entrega'}</p></div><button type="button" className="light" disabled={busy} onClick={onClose}>Volver a pedidos</button></div>{error&&<p role="alert" className="alert error">{error}</p>}<fieldset disabled={busy}><p>Solo se suma lo que recibes hoy. Lo demás queda pendiente. Mercancía dañada o devuelta al repartidor no se incluye; anótala en las observaciones.</p>{stage===0&&<button type="button" className="light" onClick={()=>setRows(v=>v.map(r=>({...r,quantity:String(r.remaining/1000)})))}>Llegó todo lo pendiente</button>}<div className="delivery-lines">{rows.map(r=>{const p=products.get(r.product);if(!p)return <p key={r.product}>Producto {r.product} no disponible.</p>;const cost=amount(r.cost);const margin=p.price>0?(p.price-cost)/p.price:0;const suggested=p.cost_known!==0&&p.cost>0&&p.price>p.cost?Math.ceil(cost*p.price/p.cost):null;return <article key={r.product} className="delivery-line"><header><strong>{p.name}</strong><span>Pendiente: {quantity(r.remaining)} {p.unit}</span></header>{stage===0?<><div className="form-pair"><label className="field">Recibido hoy ({p.unit})<input type="number" min="0" max={r.remaining/1000} step={p.unit==='pieza'?'1':'0.001'} value={r.quantity} required onChange={e=>patch(r.product,{quantity:e.target.value})}/></label><label className="field">Costo por {p.unit} ($)<input type="number" min="0" max="1000000" step="0.01" value={r.cost} required onChange={e=>patch(r.product,{cost:e.target.value})}/></label></div>{Number(r.quantity)>0&&<div className={`price-review ${cost>p.cost?'cost-increased':''}`}><p>Costo promedio registrado: {p.cost_known===0?'Sin confirmar':money(p.cost)} · Esta entrega: {money(cost)}</p><p>Venta actual: <strong>{money(p.price)}</strong> · Quedan {money(p.price-cost)} por {p.unit} antes de gastos ({(margin*100).toFixed(1)}%).</p>{cost>p.cost&&<strong>Subió el costo. Revisa si conviene cambiar el precio.</strong>}{p.promotion_price!==null&&<p>Hay una promoción vigente: {money(p.promotion_price)}. Revísala por separado.</p>}{p.wholesale_quantity>0&&<p>El precio de mayoreo no se modifica con este cambio.</p>}{canPrice?<><label className="check-row"><input type="checkbox" checked={r.change} onChange={e=>patch(r.product,{change:e.target.checked,price:r.price||String(p.price/100)})}/>Cambiar precio de venta al recibir</label>{r.change&&<div className="form-pair"><label className="field">Nuevo precio ($)<input type="number" min="0.01" max="1000000" step="0.01" required value={r.price} onChange={e=>patch(r.product,{price:e.target.value})}/></label>{suggested!==null&&<button type="button" className="light" onClick={()=>patch(r.product,{price:(suggested/100).toFixed(2)})}>Conservar margen: {money(suggested)}</button>}</div>}</>:<p>El encargado puede autorizar cambios de precio con su propia sesión.</p>}</div>}<details><summary>Lote y caducidad (si aplica)</summary><div className="form-pair"><label className="field">Lote<input maxLength={80} value={r.lot} onChange={e=>patch(r.product,{lot:e.target.value})}/></label><label className="field">Caducidad<input type="date" value={r.expires} onChange={e=>patch(r.product,{expires:e.target.value})}/></label></div></details></>:<p>Recibir {r.quantity} {p.unit} a {money(cost)} · {r.change?`Nuevo precio: ${money(amount(r.price))}`:'Conservar precio de venta'}</p>}</article>;})}</div><label className="field">Observaciones de la entrega<textarea maxLength={500} value={note} onChange={e=>{setNote(e.target.value);setStage(0);}} placeholder="Faltantes, mercancía rechazada o acuerdo con el proveedor…"/></label><label className="check-row"><input type="checkbox" checked={closeRemaining} onChange={e=>{setCloseRemaining(e.target.checked);setStage(0);}}/>Cerrar lo que falta: no llegará en otra visita</label><label className="check-row"><input type="checkbox" checked={pay} disabled={!canCash} onChange={e=>{setPay(e.target.checked);setStage(0);}}/>Pagar esta entrega desde el cajón</label><p>{pay?'Se descontará solo esta entrega del turno abierto.':'No se descontará efectivo del cajón. El pago externo o adeudo se gestiona por separado.'}</p><footer className="order-summary"><strong>Total recibido: {money(total)}</strong>{stage===1&&<button type="button" className="light" onClick={()=>setStage(0)}>Corregir</button>}<button className="primary" disabled={busy}>{busy?'Guardando…':stage===0?'Revisar entrega':'Confirmar recepción y precios'}</button></footer></fieldset></form>;
}
