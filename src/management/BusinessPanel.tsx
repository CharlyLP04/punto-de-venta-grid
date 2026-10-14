import { useEffect, useRef, useState, type FormEvent } from 'react';
import StoreSettings from './StoreSettings';
import AuditTrail from './AuditTrail';
import { invoke } from '../api';
import { decimal, money, quantity, type Snapshot } from '../model';
import { useSession } from '../security/Session';

type InventoryData={aliases:{code:string;product:number}[];combos:{combo:number;product:number;quantity:number}[];orders:{id:number;name:string;stock:number;suggested:number}[];purchases:{id:string;supplier:string;folio:string;total:number;created:string}[]};
type Reports={summary:{revenue:number;cost:number;losses:number;missing_cost:number}[];stars:{name:string;margin:number}[];ghosts:{id:number;name:string;stock:number}[];hours:{hour:string;tickets:number;total:number}[]};
type Audit={events:{id:number;event:string;created:string;user:string}[]};
type Cut={shift:number;expected:number;payments:{method:string;amount:number}[];movements:{amount:number;note:string}[]};
type Section='inventory'|'reports'|'audit'|'customize'|'services';
export default function BusinessPanel({section,data,onRefresh,filteredProductIds}:{section:Section;data:Snapshot;onRefresh:()=>Promise<void>;filteredProductIds?:Set<number>}){
  const {can}=useSession();const [inventory,setInventory]=useState<InventoryData>();const [reports,setReports]=useState<Reports>();const [audit,setAudit]=useState<Audit>();const [cut,setCut]=useState<Cut>();
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const [mode,setMode]=useState('purchase');
  const modes=[['purchase','Recibir mercancía','purchases.create'],['rules','Mayoreo y mínimos','inventory.rules'],['alias','Códigos','inventory.codes'],['combo','Combos','inventory.combos'],['loss','Merma','inventory.loss']].filter(([, , permission])=>can('inventory.manage')||can(permission));
  useEffect(()=>{if(!modes.some(([key])=>key===mode)&&modes.length)setMode(modes[0][0]);},[mode,can]);
  const [product,setProduct]=useState(data.products[0]?.id??0);const [rows,setRows]=useState([{product:data.products[0]?.id??0,quantity:'1',cost:'0',lot:'',expires:''}]);
  const inFlight=useRef(false);
  const request=useRef<{body:string;id:string}|undefined>(undefined);
  const settings=Object.fromEntries(data.settings.map(s=>[s.key,s.value]));
  async function load(){try{if(section==='inventory')setInventory(await invoke('management',{section}));if(section==='reports')setReports(await invoke('management',{section}));if(section==='audit')setAudit(await invoke('management',{section}));}catch(e){setError(String(e));}}
  useEffect(()=>{void load();},[section]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(inFlight.current)return;inFlight.current=true;const form=new FormData(e.currentTarget);const text=(name:string)=>String(form.get(name)??'');
    try{
      let operation:Record<string,unknown>;
      if(section==='customize')operation={type:'customize',store_name:text('store_name'),address:text('address'),phone:text('phone'),footer:text('footer'),accent:text('accent'),density:text('density'),idle_minutes:Number(text('idle_minutes')),daily_goal:decimal(text('daily_goal'))};
      else if(mode==='purchase')operation={type:'purchase',supplier:text('supplier'),folio:text('folio'),pay_cash:form.get('pay_cash')==='on',lines:rows.map(row=>({product:row.product,quantity:decimal(row.quantity,3),cost:decimal(row.cost),lot:row.lot,expires:row.expires}))};
      else if(mode==='rules')operation={type:'rules',product,minimum:decimal(text('minimum'),3),target:decimal(text('target'),3),wholesale_quantity:decimal(text('wholesale_quantity'),3),wholesale_price:decimal(text('wholesale_price')),favorite:form.get('favorite')==='on'};
      else if(mode==='alias')operation={type:'alias',product,code:text('code')};
      else if(mode==='combo')operation={type:'combo',product,components:rows.map(row=>({product:row.product,quantity:decimal(row.quantity,3)}))};
      else operation={type:'loss',product,quantity:decimal(text('quantity'),3),reason:text('reason')};
      const body=JSON.stringify(operation);if(request.current?.body!==body)request.current={body,id:crypto.randomUUID()};setBusy(true);setError('');
      await invoke('operate',{requestId:request.current.id,operation,approval:null});setNotice('Operación guardada con auditoría.');await onRefresh();await load();request.current=undefined;
    }catch(e){setError(String(e));}finally{inFlight.current=false;setBusy(false);}
  }
  const orders=inventory?.orders.filter(p=>!filteredProductIds||filteredProductIds.has(p.id));
  const selected=data.products.find(p=>p.id===product);
  const productOptions=data.products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.unit}</option>);
  return <section className="business-panel">
    {error&&<div className="alert error" role="alert">{error}</div>}{notice&&<div className="alert success">{notice}</div>}
    {section==='inventory'&&<>
      <article className="panel"><h2>Pedido sugerido</h2><p className="muted">Los filtros maestros se aplican a este pedido sugerido. Los formularios y compras recientes conservan todos sus productos. Diferencia entre el stock actual y el objetivo configurado; no se envían pedidos automáticamente.</p>{orders?.map(p=><div className="record" key={p.id}><span>{p.name}<small>Disponible: {quantity(p.stock)}</small></span><strong>Pedir {quantity(p.suggested)}</strong></div>)}{orders?.length===0&&<p>No hay productos por surtir que coincidan con los filtros.</p>}</article>
      {modes.length>0&&<form className="panel" onSubmit={submit}><div className="categories">{modes.map(([key,label])=><button type="button" aria-pressed={mode===key} className={mode===key?'chosen':''} key={key} onClick={()=>{setMode(key);setNotice('');}}>{label}</button>)}</div>
        {mode!=='purchase'&&<label className="field"><span>Producto</span><select value={product} onChange={e=>setProduct(Number(e.target.value))}>{productOptions}</select></label>}
        {mode==='purchase'&&<><div className="form-pair"><label className="field"><span>Proveedor</span><input name="supplier" required maxLength={120} list="suppliers"/><datalist id="suppliers">{['Bimbo','Coca-Cola','Sabritas','Lala','Barcel','Hielo'].map(name=><option key={name}>{name}</option>)}</datalist></label><label className="field"><span>Folio de nota</span><input name="folio" maxLength={100}/></label></div><p>Costo unitario por pieza o kg. Se recalcula el costo promedio ponderado.</p></>}
        {(mode==='purchase'||mode==='combo')&&<><div className="purchase-rows">{rows.map((row,index)=><div className="purchase-row" key={index}><select aria-label={`Producto ${index+1}`} value={row.product} onChange={e=>setRows(list=>list.map((v,i)=>i===index?{...v,product:Number(e.target.value)}:v))}>{productOptions}</select><input aria-label={`Cantidad ${index+1}`} type="number" min="0.001" step="0.001" required value={row.quantity} onChange={e=>setRows(list=>list.map((v,i)=>i===index?{...v,quantity:e.target.value}:v))}/>{mode==='purchase'&&<input aria-label={`Costo unitario ${index+1}`} type="number" min="0" step="0.01" required value={row.cost} onChange={e=>setRows(list=>list.map((v,i)=>i===index?{...v,cost:e.target.value}:v))}/>}{mode==='purchase'&&<div className="purchase-lot"><label>Lote (opcional)<input maxLength={80} value={row.lot} required={!!row.expires} onChange={e=>setRows(list=>list.map((v,i)=>i===index?{...v,lot:e.target.value}:v))}/></label><label>Caducidad<input type="date" value={row.expires} required={!!row.lot} onChange={e=>setRows(list=>list.map((v,i)=>i===index?{...v,expires:e.target.value}:v))}/></label></div>}<button type="button" className="light" disabled={rows.length===1} onClick={()=>setRows(list=>list.filter((_,i)=>i!==index))}>Quitar</button></div>)}</div><button type="button" className="light" onClick={()=>setRows(list=>[...list,{product:data.products[0]?.id??0,quantity:'1',cost:'0',lot:'',expires:''}])}>Agregar línea</button>{mode==='purchase'?<label className="check-row"><input type="checkbox" name="pay_cash" disabled={!can('cash.move')}/>Pagar desde el cajón del turno activo</label>:<p>El combo debe ser un producto por pieza con stock propio cero. Sus componentes se descuentan al cobrar.</p>}</>}
        {mode==='rules'&&<div key={product}><div className="form-pair"><label className="field"><span>Stock mínimo ({selected?.unit})</span><input name="minimum" type="number" min="0" step="0.001" defaultValue={(selected?.minimum??0)/1000} required/></label><label className="field"><span>Stock objetivo ({selected?.unit})</span><input name="target" type="number" min="0" step="0.001" defaultValue={(selected?.target??0)/1000} required/></label></div><div className="form-pair"><label className="field"><span>Mayoreo desde (0 desactiva)</span><input name="wholesale_quantity" type="number" min="0" step="0.001" defaultValue={(selected?.wholesale_quantity??0)/1000} required/></label><label className="field"><span>Precio por unidad en mayoreo</span><input name="wholesale_price" type="number" min="0" step="0.01" defaultValue={(selected?.wholesale_price??0)/100} required/></label></div><label className="check-row"><input name="favorite" type="checkbox" defaultChecked={!!selected?.favorite}/>Acceso favorito Alt+1 a Alt+9 (orden alfabético)</label></div>}
        {mode==='alias'&&<><label className="field"><span>Código adicional</span><input name="code" required maxLength={64}/></label><p>{inventory?.aliases.filter(a=>a.product===product).map(a=>a.code).join(' · ')}</p></>}
        {mode==='combo'&&<p className="muted">Composición actual: {inventory?.combos.filter(c=>c.combo===product).map(c=>`${quantity(c.quantity)} ${data.products.find(p=>p.id===c.product)?.name}`).join(' + ')||'Sin componentes'}</p>}
        {mode==='loss'&&<><label className="field"><span>Cantidad ({selected?.unit})</span><input name="quantity" type="number" min="0.001" step="0.001" required/></label><label className="field"><span>Motivo o fecha de caducidad</span><input name="reason" required maxLength={200}/></label></>}
        <div className="form-actions"><button className="primary" disabled={busy||(mode==='purchase'&&!can('costs.view'))}>{busy?'Guardando…':'Guardar operación'}</button></div>
      </form>}
      {!!inventory?.purchases.length&&<article className="panel"><h2>Compras recientes</h2>{inventory.purchases.map(p=><div className="record" key={p.id}><span>{p.supplier}<small>{p.folio} · {new Date(p.created).toLocaleString('es-MX')}</small></span><b>{money(p.total)}</b></div>)}</article>}
    </>}
    {section==='reports'&&<><article className="panel"><div className="section-head"><h2>Resultados de hoy</h2><button className="light" onClick={()=>invoke<Cut>('management',{section:'cut_x'}).then(setCut).catch(e=>setError(String(e)))}>Corte X · Sin cerrar</button></div>{reports?.summary.map((s,i)=>{
      const netMargin=s.revenue-s.cost-s.losses;
      return <div key={i}><div className="metric-strip report-kpis">
        <article><small>Ventas netas de devoluciones</small><strong>{money(s.revenue)}</strong></article>
        {can('costs.view')&&<article><small>Costo de lo vendido</small><strong>{money(s.cost)}</strong></article>}
        <article><small>Mermas registradas</small><strong>{money(s.losses)}</strong></article>
        {can('costs.view')&&<article className={netMargin>=0?'metric-feature':''}><small>Margen bruto del día</small><strong style={{color:netMargin>=0?'var(--accent-emerald)':'var(--accent-red)'}}>{s.missing_cost?'Pendiente':money(netMargin)}</strong></article>}
      </div><p className="muted">No incluye renta, nómina, impuestos ni otros gastos operativos. {s.missing_cost?`${s.missing_cost} líneas sin costo confirmado: el margen está incompleto.`:''}</p></div>;
    })}{cut&&<div className="cut-preview"><h3>Turno #{cut.shift} · Esperado {money(cut.expected)}</h3><div className="payment-splits">{cut.payments.map(p=><div key={p.method}><small>{p.method}</small><b>{money(p.amount)}</b></div>)}</div>{cut.movements.map((m,i)=><p key={i}>{m.note}: {money(m.amount)}</p>)}</div>}</article>
    <article className="panel">
      <h2>Horas de mayor movimiento hoy</h2>
      <p className="muted">Identifica tus horas pico de clientes para anticipar surtido y refuerzo en caja.</p>
      {reports?.hours&&reports.hours.length>0?(()=>{
        const maxTickets=Math.max(1,...reports.hours.map(h=>h.tickets));
        return <div className="analytics-hours">
          <svg className="sales-chart" viewBox="0 0 600 120" style={{height:'120px',width:'100%'}}>
            {reports.hours.map((h,idx)=>{
              const barWidth=Math.max(12,Math.floor(540/Math.max(1,reports.hours.length))-6);
              const x=30+idx*(barWidth+6);
              const barHeight=Math.max(6,Math.round((h.tickets/maxTickets)*80));
              const y=95-barHeight;
              const isPeak=h.tickets===maxTickets;
              return <g key={h.hour}>
                <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} className={isPeak?'peak':''} fill={isPeak?'var(--accent-gold)':'var(--accent-emerald)'} opacity={isPeak?1:0.75}/>
                <text x={x+barWidth/2} y={112} textAnchor="middle" fill="var(--text-secondary)" fontSize="10">{h.hour}:00</text>
                <text x={x+barWidth/2} y={y-4} textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontWeight="bold">{h.tickets}</text>
              </g>;
            })}
          </svg>
          <div className="hours-list">{reports.hours.map(h=><div className="hour-row" key={h.hour}><span>{h.hour}:00</span><meter min="0" max={maxTickets} value={h.tickets}/><strong>{h.tickets} {h.tickets===1?'ticket':'tickets'}</strong><span>{money(h.total)}</span></div>)}</div>
        </div>;
      })():<div className="calm-empty">Sin ventas registradas en el día de hoy.</div>}
    </article>
    <div className="admin-grid"><article className="panel"><h2>Productos estrella · 7 días</h2><p className="muted">Solo líneas con costo confirmado al vender.</p>{reports?.stars.map((p,i)=><div className="record" key={i}><span>{p.name}</span><b>{money(p.margin??0)}</b></div>)}{!reports?.stars.length&&<p className="muted">Sin datos de productos estrella.</p>}</article><article className="panel"><h2>Sin venta en 45 días</h2>{reports?.ghosts.map(p=><div className="record" key={p.id}><span>{p.name}</span><b>{quantity(p.stock)}</b></div>)}{reports?.ghosts.length===0&&<p className="muted">Sin productos en esta condición.</p>}</article></div></>}
    {section==='audit'&&<AuditTrail events={audit?.events??[]}/>}
    {section==='customize'&&<StoreSettings settings={settings} busy={busy} onSubmit={submit}/>}
    {section==='services'&&<article className="panel"><h2>Servicios y conexiones</h2><p>La caja funciona localmente. Estas conexiones quedan en Beta para una etapa posterior; no realizan cargos ni envían datos.</p><div className="integration-list">{[['Recargas y pago de servicios','Proveedor, credenciales, catálogo y conciliación de operaciones.'],['Terminal bancaria','Los pagos con tarjeta se registran después de confirmar manualmente la terminal. No se realiza un cargo desde esta aplicación.'],['Grid MX / Sincronización Móvil','API, autenticación de tienda y contrato de sincronización. La cola local no implica entrega a la nube.'],['Báscula automática','Modelo, protocolo serial y unidad de peso para interpretar únicamente lecturas estables.']].map(([name,description])=><div key={name}><strong>{name}</strong><span className="tag">Beta · Próximamente</span><p>{description}</p></div>)}</div></article>}
  </section>;
}



