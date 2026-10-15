import useSnapshot from './hooks/useSnapshot';
import NetworkConnection from './ui/NetworkConnection';
import CommonProductFields from './ui/CommonProductFields';
import AudioControls from './ui/AudioControls';
import ToastMessages from './ui/ToastMessages';
import {openWhatsApp} from './management/whatsapp';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { invoke, getSessionToken } from './api';
import { useSession } from './security/Session';
import PendingCenter from './management/PendingCenter';
import SectionHelp from './ui/SectionHelp';
import ThemeToggle from './ui/Theme';
import InputModePicker,{pcMode} from './ui/InputMode';
import SupervisorApprovalCard from './ui/SupervisorApprovalCard';
import MasterFilters, { emptyFilters, filterCatalog } from './ui/MasterFilters';
import { WorkspaceSidebar, WorkspaceHeader, firstPage, type Page } from './ui/WorkspaceNavigation';
import { copyStatement,statementText } from './management/statements';
import PaymentFields from './ui/PaymentFields';
import ProductPricing from './ui/ProductPricing';
import CashCount from './ui/CashCount';
import BulkFields, {bulkQuantity} from './ui/BulkFields';
import IconPicker, { saveBrandToStorage } from './ui/IconPicker';
import { parseBrandBadge } from './ui/productIcons';
import { Search, ShoppingBasket, Package, Users, SlidersHorizontal, ArrowUpRight, Plus, Minus, Trash2, X, Wallet, ReceiptText, ArrowDownLeft, Check, HardDrive, Printer, Scale, Coins, Star, ScanLine, Volume2, VolumeX, ArrowRight, Keyboard, ShieldCheck, Lock, KeyRound } from 'lucide-react';
import { decimal, money, quantity, linePrice, ticketTotal, type Product, type Receipt } from './model';
import ArcadeButton, { KbdBadge } from './ui/ArcadeButton';
import BrandMark from './ui/BrandMark';
import NumberTicker from './ui/NumberTicker';
import ProductCard, { ProductVisual, StockBadge } from './ui/ProductCard';
import useFeedbackSound from './ui/useFeedbackSound';

const FiscalPanel = lazy(() => import('./ui/FiscalPanel'));
const UsersPanel = lazy(() => import('./security/UsersPanel'));
const BusinessPanel = lazy(() => import('./management/BusinessPanel'));
const ProcurementPanel = lazy(() => import('./management/ProcurementPanel'));
const StockPrograms = lazy(() => import('./management/StockPrograms'));
const BackupCenter = lazy(() => import('./management/BackupCenter'));
const SaleHistory = lazy(() => import('./management/SaleHistory'));
const InventoryWorkspace = lazy(() => import('./management/InventoryWorkspace'));
const InventoryCount = lazy(() => import('./management/InventoryCount'));
const ReportExplorer = lazy(() => import('./management/ReportExplorer'));

type Modal = { kind:'common'|'pay'|'credit'|'movement'|'open'|'close'|'customer'|'product'|'restock'|'bulk'|'repay'|'discount'|'refund'; product?:Product; customer?:number; code?:string; sale?:string };
const categories = ['Todo','Bebidas','Botanas','Panadería','Lácteos','Abarrotes','Granel'];


function Field({label,children}:{label:string;children:ReactNode}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Amount({name='amount',defaultValue='',label='Importe',step='0.01'}:{name?:string;defaultValue?:string;label?:string;step?:string}) { return <Field label={label}><input name={name} type="number" inputMode="decimal" min="0" max="1000000" step={step} defaultValue={defaultValue} required autoFocus={pcMode()} /></Field>; }
function Dialog({children,onClose,title,busy,error,kind,returnFocus}:{children:ReactNode;onClose:()=>void;title:string;busy:boolean;error:string;kind:Modal['kind'];returnFocus?:HTMLElement|null}) {
  const ref=useRef<HTMLDialogElement>(null);
  const opener=useRef(returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(()=>{
    const dialog=ref.current;dialog?.showModal();
    return ()=>{
      dialog?.close();
      requestAnimationFrame(()=>{
        if(document.querySelector('dialog[open]'))return;
        const target=opener.current;
        if(target?.isConnected&&!target.matches(':disabled'))target.focus();
        else document.querySelector<HTMLInputElement>('.search input')?.focus();
      });
    };
  },[]);
  useEffect(()=>{if(!error||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const animation=ref.current?.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(-3px)'},{transform:'translateX(0)'}],{duration:320});return()=>animation?.cancel();},[error]);
  const Icon=kind==='pay'||kind==='credit'?Coins:kind==='movement'?Wallet:kind==='product'||kind==='restock'?Package:kind==='close'?ReceiptText:ShieldCheck;
  return <dialog className={`retail-dialog dialog-${kind}`} ref={ref} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-label={title}><header><span className="dialog-emblem"><Icon size={25} aria-hidden="true"/></span><div><span className="eyebrow">Grid POS</span><h2>{title}</h2></div><button type="button" className="icon-button" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={20}/></button></header>{children}</dialog>;
}

export default function App() {
  const {user,can,lock}=useSession();
  const operationId=useRef('');
  const {data,refresh}=useSnapshot();
  const modalReturnFocus=useRef<HTMLElement|null>(null);
  const [connection,setConnection]=useState<{remote:boolean;name:string;serving:boolean}>();
  useEffect(()=>{let live=true;let loading=false;const poll=async()=>{if(loading||document.visibilityState!=='visible')return;loading=true;try{const state=await invoke<{remote:boolean;name:string;serving:boolean}>('connection_status');if(live)setConnection(previous=>previous?.remote===state.remote&&previous?.name===state.name&&previous?.serving===state.serving?previous:state);if(live&&(state.remote||state.serving))await refresh();}catch{/* Explicit operations report connection errors. */}finally{loading=false;}};void poll();const timer=setInterval(()=>void poll(),5000);return()=>{live=false;clearInterval(timer);};},[refresh]);
  const [page,setPage]=useState<Page>(()=>firstPage(can));
  const [ticket,setTicket]=useState(1);
  const [query,setQuery]=useState('');
  const [catalogLimit,setCatalogLimit]=useState(36);
  const [catalogFilters,setCatalogFilters]=useState(emptyFilters);
  useEffect(()=>{setCatalogLimit(36);},[query,catalogFilters]);
  const [modal,setModal]=useState<Modal|null>(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [lastSale,setLastSale]=useState<Receipt>();
  const [selected,setSelected]=useState<number>();
  const [ports,setPorts]=useState<string[]>([]);
  const [addPulse,setAddPulse]=useState({id:0,token:0});
  const [chargePulse,setChargePulse]=useState(0);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!addPulse.token||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const animation=input.current?.closest('form')?.animate([{opacity:.72},{opacity:1}],{duration:300,easing:'cubic-bezier(0.16,1,0.3,1)'});return()=>animation?.cancel();},[addPulse.token]);
  const chain=useRef<Promise<void>>(Promise.resolve());
  const pending=useRef(0);
  const paymentId=useRef<string|undefined>(undefined);
  const paymentInFlight=useRef(false);
  const mutationId=useRef(crypto.randomUUID());
  useEffect(()=>{mutationId.current=crypto.randomUUID();},[modal]);
  useEffect(()=>{ if(!isTauri()){setError('Abre Grid POS como aplicación nativa con npm run desktop. La caja no opera en el navegador.');return;} refresh().catch(e=>setError(String(e))); },[refresh]);

  // Serialize writes, including fast scanner bursts. Cart state is durable after every operation.
  function write(action:Record<string,unknown>, message='', requestId=crypto.randomUUID()):Promise<boolean> {
    const ownerToken=getSessionToken();
    pending.current++;setBusy(true);setError('');
    let success=false;
    const work=chain.current.then(async()=>{if(!ownerToken||ownerToken!==getSessionToken())throw new Error('La sesión cambió; vuelve a realizar la operación');await invoke('mutate',{action,requestId});success=true;if(message)setNotice(message);try{await refresh();}catch(refreshError){setError('La operación se guardó, pero no se pudo actualizar la pantalla. '+String(refreshError));}}).catch(e=>setError(String(e))).finally(()=>{pending.current--;setBusy(pending.current>0);});
    chain.current=work;
    return work.then(()=>success);
  }
  const products=useMemo(()=>new Map([...(data?.products??[]),...(data?.common_products??[])].map(p=>[p.id,p])),[data?.products,data?.common_products]);
  const codes=useMemo(()=>{const result=new Map(data?.products.map(p=>[p.code,p]));for(const alias of data?.aliases??[]){const product=products.get(alias.product);if(product)result.set(alias.code,product);}return result;},[data?.products,data?.aliases,products]);
  const lines=useMemo(()=>(data?.lines??[]).filter(l=>l.ticket===ticket),[data?.lines,ticket]);
  const total=useMemo(()=>ticketTotal(products,lines),[products,lines]);
  const settings=useMemo(()=>Object.fromEntries((data?.settings??[]).map(s=>[s.key,s.value])),[data?.settings]);
  useEffect(()=>{
    if(settings.idle_minutes) {
      window.dispatchEvent(new CustomEvent('grid-idle-policy',{detail:Number(settings.idle_minutes)}));
      window.dispatchEvent(new CustomEvent('mario-idle-policy',{detail:Number(settings.idle_minutes)}));
    }
  },[settings.idle_minutes]);
  const frequency=useMemo(()=>new Map((data?.frequencies??[]).map(f=>[f.product,f.count])),[data?.frequencies]);
  const filtered=useMemo(()=>filterCatalog(data?.products??[],catalogFilters,query,data?.aliases??[],frequency),[data?.products,data?.aliases,catalogFilters,query,frequency]);
  const filteredIds=useMemo(()=>new Set(filtered.map(p=>p.id)),[filtered]);
  const sound=useFeedbackSound(settings.sound==='1');
  const openShift=!!data?.shift.length;

  function add(p:Product) {
    if(!can('sales.create')){setError('No tienes permiso para vender');return;}
    if(!openShift){setModal({kind:'open'});return;}
    sound.prepare();
    setSelected(p.id);
    if(p.unit==='kg'){setModal({kind:'bulk',product:p});return;}
    void write({type:'cart',ticket,product:p.id,delta:1000}).then(saved=>{
      if(saved){setAddPulse(previous=>({id:p.id,token:previous.token+1}));sound.play('add');}
    });
  }
  function scan(code:string) {
    const p=codes.get(code.trim());
    if(p){add(p);setQuery('');}
    else{if(!(can('inventory.manage')||can('products.edit'))||!can('costs.view')){setError('Código desconocido. Solicita el alta al encargado.');return;}setModal({kind:'product',code:code.trim()});setNotice('Código no encontrado. Registra el producto y después su entrada de inventario.');}
  }
  async function pay(credit=false) {
    modalReturnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    if(!can('sales.create')||(credit&&!can('credit.use'))){setError('No tienes permiso para esta venta');return;}
    sound.prepare();
    if(!credit)setChargePulse(value=>value+1);
    if(!openShift){setModal({kind:'open'});return;}
    if(!lines.length){setError('Agrega un producto antes de cobrar');return;}
    if(busy||paymentInFlight.current)return;
    paymentInFlight.current=true;setBusy(true);
    try{await refresh();paymentId.current=crypto.randomUUID();setError('');setModal({kind:credit?'credit':'pay'});}
    catch(e){setError(String(e));}finally{paymentInFlight.current=false;setBusy(false);}
  }
  const canAdjust=lines.some(line=>line.product===selected)&&products.get(selected??0)?.unit==='pieza';
  const favorites=data?.products.filter(p=>p.favorite).slice(0,9)??[];
  const latest=useRef({modal,busy,add,scan,pay,ticket,selected,canAdjust,write,favorites,products});
  latest.current={modal,busy,add,scan,pay,ticket,selected,canAdjust,write,favorites,products};
  useEffect(()=>{
    let buffer='';let last=0;
    const keydown=(e:KeyboardEvent)=>{
      const s=latest.current;
      if(e.ctrlKey&&e.key.toLowerCase()==='p'){e.preventDefault();if(!s.busy&&!s.modal&&!document.querySelector('dialog[open]')){if(!can('sales.create')||!can('sales.common')){setError('No tienes permiso para agregar productos comunes');return;}setPage('Caja');setModal({kind:'common'});}return;}
      if(e.ctrlKey&&e.key.toLowerCase()==='l'){e.preventDefault();if(!s.busy)lock();return;}
      if(document.querySelector('dialog[open]')||s.modal){if(/^F(?:[1-9]|1[0-2])$/.test(e.key))e.preventDefault();buffer='';return;}
      const editing=e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement;
      if(['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10'].includes(e.key)) {
        e.preventDefault();if(s.busy||e.repeat)return;
        if(e.key==='F1'){setPage('Caja');setTimeout(()=>input.current?.focus(),0);}
        if(e.key==='F2')s.pay();
        if(e.key==='F10')s.pay(true);
        if(e.key==='F3')setModal({kind:'movement'});
        if(e.key==='F4'&&s.selected&&!s.products.get(s.selected)?.common){operationId.current='';setModal({kind:'discount',product:s.products.get(s.selected)});}
        const index=['F5','F6','F7','F8','F9'].indexOf(e.key);if(index>=0){setTicket(index+1);setPage('Caja');}
        return;
      }
      if(e.altKey&&/^[1-9]$/.test(e.key)&&!s.busy){e.preventDefault();const favorite=s.favorites[Number(e.key)-1];if(favorite)s.add(favorite);return;}
      if(editing){buffer='';return;}
      const now=performance.now();
      if(e.key==='Enter'&&buffer.length>=4&&now-last<100){e.preventDefault();s.scan(buffer);buffer='';return;}
      if((e.key==='+'||e.key==='-')&&s.selected&&s.canAdjust&&!s.busy&&!(buffer.length>0&&now-last<50)){e.preventDefault();void s.write({type:'cart',ticket:s.ticket,product:s.selected,delta:e.key==='+'?1000:-1000});return;}
      if(e.key.length===1&&!e.ctrlKey&&!e.altKey&&!e.metaKey){buffer=now-last<50?buffer+e.key:e.key;last=now;}
    };
    window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
  },[]);

  async function print(id:string,reprint=false) {
    try{await invoke('print_sale',{id,reprint});setNotice('Ticket enviado a la impresora.');await refresh();}
    catch(e){setError(`Venta guardada. Impresión pendiente: ${String(e)}. Puedes reintentar desde Historial; revisa si salió papel antes de repetir.`);}
  }
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!modal||busy||paymentInFlight.current)return;
    sound.prepare();
    const form=new FormData(e.currentTarget);
    const text=(key:string)=>String(form.get(key)??'');
    try {
      const kind=modal.kind;
      if(kind==='pay'||kind==='credit') {
        paymentInFlight.current=true;setBusy(true);setError('');
        try{
          const credit=decimal(text('split_credit'));
          const receipt=await invoke<Receipt>('checkout',{ticket,requestId:paymentId.current,received:decimal(text('received')),customer:text('customer')?Number(text('customer')):null,tender:{cash:decimal(text('split_cash')),card:decimal(text('split_card')),credit,transfer:decimal(text('split_transfer')),voucher:decimal(text('split_voucher')),check:decimal(text('split_check')),usd:decimal(text('split_usd')),usd_units:decimal(text('usd_units')),usd_rate:decimal(text('usd_rate')),reference:text('reference')}});
          setLastSale(receipt);setModal(null);setNotice(`Venta guardada · Cambio ${money(receipt.change)}`);
          sound.play('sale');
          try{await refresh();}catch{setError('La venta se guardó, pero falta actualizar la pantalla. No vuelvas a cobrar este ticket.');}
          if(settings.printer)void print(receipt.id);
        } finally{paymentInFlight.current=false;setBusy(false);}
        return;
      }
      if(kind==='discount'||kind==='refund'){
        operationId.current ||= crypto.randomUUID();setBusy(true);
        try{await invoke('operate',{requestId:operationId.current,approval:text('supervisor_username')?{username:text('supervisor_username'),password:text('supervisor_password')}:null,operation:kind==='discount'?{type:'discount',ticket,product:modal.product?.id,price:decimal(text('amount')),reason:text('reason')}:{type:'refund',sale:modal.sale,reason:text('reason'),card_refunded:form.get('card_refunded')==='on',restock:text('return_destination')==='stock'}});setModal(null);operationId.current='';setNotice('Operación guardada con auditoría');await refresh();}finally{setBusy(false);}return;
      }      let action:Record<string,unknown>;
      switch(kind) {
        case 'common':action={type:'common',ticket,name:text('name'),quantity:decimal(text('quantity'),3),price:decimal(text('price')),cost:text('cost')===''?null:decimal(text('cost'))};break;
        case 'bulk': {
          const product=modal.product!;
          const line=lines.find(l=>l.product===product.id);
          const q=bulkQuantity(product,line?.quantity??0,line?.override_price??null,text('mode'),text('amount'));
          if(q<=0)throw new Error('La cantidad debe ser mayor a cero');
          action={type:'cart',ticket,product:product.id,delta:q};break;
        }
        case 'open':action={type:'open',amount:decimal(text('amount'))};break;
        case 'close':action={type:'close',counted:decimal(text('amount')),denominations:JSON.parse(text('denominations'))};break;
        case 'movement':action={type:'movement',amount:decimal(text('amount'))*(text('direction')==='out'?-1:1),note:text('note')};break;
        case 'customer':action={type:'customer',id:modal.customer??null,name:text('name'),phone:text('phone'),limit:decimal(text('amount')),email:text('email'),address:text('address'),credit_enabled:form.get('credit_enabled')==='on'};break;
        case 'repay':action={type:'repay',customer:modal.customer,amount:decimal(text('amount'))};break;
        case 'product':{
          const iconVal=text('icon')||undefined;
          if(iconVal&&iconVal.startsWith('brand:')){
            const parsed=parseBrandBadge(iconVal);
            if(parsed&&parsed.label.trim())saveBrandToStorage(parsed);
          }
          action={type:'product',id:modal.product?.id??null,code:text('code'),name:text('name'),category:text('category'),unit:text('unit')||modal.product?.unit,price:decimal(text('price')),cost:text('cost')===''?null:decimal(text('cost')),icon:iconVal};
          break;
        }
        case 'restock':action={type:'restock',product:modal.product!.id,quantity:decimal(text('amount'),3),note:text('note')};break;
      }
      if(await write(action,'Guardado en esta computadora',mutationId.current)){
        if(kind==='repay')sound.play('sale');if(kind==='restock')sound.play('powerup');if(kind==='close')sound.play('close');
        if(kind==='bulk'){setAddPulse(previous=>({id:modal.product!.id,token:previous.token+1}));sound.play('add');}
        setModal(null);
      }
    }catch(e){setError(e instanceof Error?e.message:String(e));}
  }
  const title=modal?({common:'Producto común',pay:'Cobrar ticket',credit:'Anotar en la libreta',movement:'Movimiento de efectivo',open:'Abrir turno',close:'Arqueo y corte Z',customer:modal.customer?'Editar vecino':'Agregar cliente',product:modal.product?'Editar producto':'Nuevo producto',restock:'Entrada de inventario',bulk:modal.product?.name??'Venta a granel',repay:'Registrar abono',discount:'Modificar precio · F4',refund:'Devolver venta completa'}[modal.kind]):'';
  if(!data)return <main className="startup"><BrandMark/><h1>Grid POS</h1><p>{error||'Abriendo tu tienda…'}</p><small>Punto de venta profesional offline-first.</small></main>;

  const lowStock=data.products.filter(p=>p.stock<=p.minimum).length;
  return <div className={`shell ${page==='Caja'?'checkout-shell':''} ${['Inventario','Pedidos','Surtido','Lotes','Promociones'].includes(page)?'products-workspace':''} ${['Historial','Reportes','Movimientos'].includes(page)?'sales-workspace':''} ${['Personalizar','Usuarios','Ajustes','Respaldos','Bitácora','Servicios'].includes(page)?'administration-shell':''}`} data-accent={settings.accent??'gold'} data-density={settings.density??'comfortable'}>
    <WorkspaceSidebar remote={connection?.remote} page={page} onChange={setPage} can={can} name={user.name} onLock={lock} soundEnabled={settings.sound==='1'}/>
    <a className="skip-link" href="#main-workspace">Ir al contenido</a><main id="main-workspace" tabIndex={-1} className="workspace"><header className="topbar"><span className="offline-pill"><i aria-hidden="true"/>{connection?.remote?connection.name:connection?.serving?'Caja principal · Red local':'Trabajo sin internet'}</span><div className="wordmark"><span>GRID <b>POS</b></span><small>{settings.store_name??'Punto de Venta'}</small></div><div className="topbar-stats"><div className="today-stat"><span className="today-coin"><Coins size={18}/>{lastSale&&<span className="coin-reward" key={lastSale.id} aria-hidden="true"><Coins size={18}/></span>}</span><span>{can('reports.view')?'Hoy':'Mis ventas'}</span><NumberTicker cents={data.stats[0]?.today??0}/></div><button className="restock-stat" onClick={()=>setPage('Inventario')}><Package size={16}/><strong>{lowStock}</strong><span>por surtir</span></button></div>{can('inventory.view')&&(data.expiry_alerts[0]?.count??0)>0&&<button className="expiry-alert" onClick={()=>setPage('Lotes')} title="Revisar lotes vencidos o próximos a vencer">{data.expiry_alerts[0].count} lotes por revisar</button>}<SectionHelp page={page}/><ThemeToggle/><button className="user-session" onClick={lock} title="Bloquear y cambiar de usuario"><ShieldCheck size={15}/>{user.name}<Lock size={12}/></button><button className={`shift-button ${openShift?'shift-open':''}`} disabled={busy||!can(openShift?'shifts.close':'shifts.open')} onClick={()=>setModal({kind:openShift?'close':'open'})}><i/>{openShift?`Turno #${data.shift[0].id} · ${data.shift[0].cashier}`:'Abrir turno'}<ArrowUpRight size={14}/></button></header>
      {page!=='Caja'&&<WorkspaceHeader page={page} onChange={setPage} can={can} counts={{Surtido:lowStock,Lotes:data.expiry_alerts[0]?.count??0}}/>}
      <PendingCenter data={data} onOpen={setPage}/>{!modal&&<ToastMessages error={error} notice={notice} clearError={()=>setError('')} clearNotice={()=>setNotice('')}/>}      {page==='Caja'&&<div className="checkout-layout">
        <section className="catalog" aria-label="Productos">
          <div className="counter-heading"><div><h1>Nueva venta</h1><p>{openShift?'Busca o escanea para agregar a la cuenta.':'Abre tu turno para comenzar a vender.'}</p></div><div className="counter-shortcuts" role="group" aria-label="Ver productos">
            <button type="button" aria-pressed={!catalogFilters.favorites&&!catalogFilters.frequent} onClick={()=>setCatalogFilters(f=>({...f,favorites:false,frequent:false}))}>Catálogo</button>
            <button type="button" aria-pressed={catalogFilters.frequent} onClick={()=>setCatalogFilters(f=>({...f,favorites:false,frequent:!f.frequent}))}>Venta frecuente</button>
            <button type="button" aria-pressed={catalogFilters.favorites} onClick={()=>setCatalogFilters(f=>({...f,frequent:false,favorites:!f.favorites}))}><Star size={15} aria-hidden="true"/>Favoritos</button>
          </div></div>
          <div className="cash-toolbar"><form className="search" onSubmit={e=>{e.preventDefault();if(codes.has(query.trim()))scan(query);else if(filtered.length===1)add(filtered[0]);else if(query.trim()&&filtered.length===0)setNotice('No hay coincidencias. Revisa los filtros o registra el producto desde Inventario.');}}>
            <Search size={21} strokeWidth={1.6}/><input ref={input} aria-label="Escanear código de barras o buscar producto" placeholder="Escanea o busca: leche, huevo, jabón…" value={query} onChange={e=>setQuery(e.target.value)}/>
            {query&&<button className="search-clear" type="button" aria-label="Limpiar búsqueda" onClick={()=>{setQuery('');input.current?.focus();}}><X size={16}/></button>}
            <KbdBadge>F1</KbdBadge><span className="scanner-ready" title="Lector HID con terminador Enter"><ScanLine size={19}/><i/></span>
          </form>          {can('sales.create')&&can('sales.common')&&<button className="common-product-trigger" type="button" disabled={busy||!openShift} onClick={()=>setModal({kind:'common'})} title="Producto común (Ctrl+P)"><Plus size={18} aria-hidden="true"/><span>Producto común</span></button>}{can('cash.move')&&<button className="cash-movement-trigger" type="button" disabled={busy||!openShift} onClick={()=>setModal({kind:'movement'})} title={openShift?'Registrar entrada o salida de efectivo (F3)':'Abre un turno para registrar movimientos'}><Wallet size={18} aria-hidden="true"/><span>Efectivo</span><KbdBadge>F3</KbdBadge></button>}</div>

          <MasterFilters compact products={data.products} value={catalogFilters} onChange={setCatalogFilters} search={query} onSearch={setQuery} count={filtered.length}/>
          <div className="catalog-meta"><span>Productos<b>{filtered.length}</b></span><span><Keyboard size={13}/> Flechas para explorar · Enter para agregar</span></div>
          <div className="product-grid" aria-label="Catálogo de productos" aria-busy={busy}>
            {filtered.slice(Math.max(0,Math.min(catalogLimit,Math.ceil(filtered.length/36)*36)-36),Math.min(catalogLimit,Math.ceil(filtered.length/36)*36)).map(p=><ProductCard key={p.id} product={p} disabled={busy} pulse={addPulse.id===p.id?addPulse.token:0} onAdd={add}/>)}
            {filtered.length>36&&<nav className="catalog-pagination" aria-label="Páginas del catálogo"><button type="button" disabled={catalogLimit<=36} onClick={()=>{setCatalogLimit(n=>Math.max(36,n-36));input.current?.closest('.catalog')?.querySelector('.product-grid')?.scrollTo({top:0});}}>Anterior</button><span role="status">Página {Math.min(catalogLimit/36,Math.ceil(filtered.length/36))} de {Math.ceil(filtered.length/36)}</span><button type="button" disabled={catalogLimit>=filtered.length} onClick={()=>{setCatalogLimit(n=>n+36);input.current?.closest('.catalog')?.querySelector('.product-grid')?.scrollTo({top:0});}}>Siguiente</button></nav>}
            {!filtered.length&&<div className="empty"><Package size={32} strokeWidth={1.3}/><h3>Sin coincidencias con estos filtros</h3><p>Ajusta los criterios o limpia los filtros para ver el catálogo completo.</p><button className="light" onClick={()=>{setCatalogFilters(emptyFilters());setQuery('');}}>Ver todos</button></div>}
          </div>
          <div className="goal-track"><Star size={12}/><span>Meta del día {money(Number(settings.daily_goal??0))}</span><progress value={data.stats[0]?.today??0} max={Math.max(1,Number(settings.daily_goal??0))}/></div>
        </section>
        <aside className="ticket-panel" aria-label={`Ticket ${ticket}`}>
          <div className="ticket-tabs" aria-label="Tickets abiertos">
            <span className="ticket-tab-slider" aria-hidden="true" style={{transform:`translateX(${(ticket-1)*100}%)`}}/>
            {[1,2,3,4,5].map(n=>{const entries=data.lines.filter(l=>l.ticket===n);const sum=ticketTotal(products,entries);return <button disabled={busy} key={n} className={ticket===n?'selected':''} aria-pressed={ticket===n} onClick={()=>setTicket(n)}><span>Ticket {n}{data.lines.some(l=>l.ticket===n)&&<i/>}</span><small className="ticket-summary">{entries.length?`${entries.length} prod. · ${money(sum)}`:'Vacío'}</small><KbdBadge>{`F${n+4}`}</KbdBadge></button>;})}
          </div>
          <div className="ticket-title"><div><h2>Venta actual</h2><span>{lines.length} {lines.length===1?'producto':'productos'} · Mostrador</span></div><span className="ticket-number">Ticket {ticket}</span></div>
          <div className="ticket-lines" tabIndex={0} role="region" aria-label="Productos del ticket">
            {lines.length===0?<div className="empty ticket-empty"><span className="basket-relief"><ShoppingBasket size={35} strokeWidth={1.3}/></span><h3>Agrega el primer producto</h3><p>Usa el lector o toca un producto.<br/>Aquí verás lo que lleva tu cliente.</p><span className="empty-shortcut"><KbdBadge>F1</KbdBadge> Buscar un producto</span></div>:lines.map(l=>{
              const p=products.get(l.product)!;
              return <article key={p.id} className={selected===p.id?'line picked':'line'} tabIndex={0} aria-label={`Seleccionar ${p.name}`} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setSelected(p.id);}}} onClick={()=>setSelected(p.id)}>
                <ProductVisual product={p} compact/>
                <div className="line-detail"><strong>{p.name}</strong><small>{money(linePrice(p,l))} / {p.unit}{p.common?' · Común':''}</small><div className="stepper"><button disabled={busy||p.unit==='kg'} aria-label={`Quitar una pieza de ${p.name}`} onClick={()=>void write({type:'cart',ticket,product:p.id,delta:-1000})}><Minus size={12}/></button><span>{quantity(l.quantity)}{p.unit==='kg'?' kg':''}</span><button disabled={busy||p.unit==='kg'} aria-label={`Agregar una pieza de ${p.name}`} onClick={()=>void write({type:'cart',ticket,product:p.id,delta:1000})}><Plus size={12}/></button></div></div>
                <div className="line-end">{can('sales.create')&&!p.common&&<button aria-label={`Cambiar precio de ${p.name}`}  onClick={()=>{operationId.current='';setModal({kind:'discount',product:p});}}>Precio F4</button>}<b>{money(Math.round(linePrice(p,l)*l.quantity/1000))}</b><button disabled={busy} aria-label={`Eliminar ${p.name}`} onClick={()=>void write({type:'remove',ticket,product:p.id})}><Trash2 size={14}/></button></div>
              </article>;
            })}
          </div>
          <div className="ticket-bottom">
            <div className="subtotal"><span>Subtotal</span><span>{money(total)}</span></div><small>Precios finales · Comprobante de venta, no CFDI</small>
            <div className="total"><span>Total <small>MXN</small></span><NumberTicker cents={total}/></div>
            <ArcadeButton className="charge" shortcut="F2" pressToken={chargePulse} disabled={busy||!lines.length} onClick={()=>pay()}><Coins size={19}/><span>Cobrar ahora</span><ArrowRight size={18}/></ArcadeButton>
            <button className="fiar" disabled={busy||!lines.length} onClick={()=>pay(true)}><Users size={16}/> Fiar a un cliente <KbdBadge>F10</KbdBadge></button>
            {lastSale?<p className="last-sale"><Check size={14}/> Último cambio <strong>{money(lastSale.change)}</strong></p>:<p className="ticket-footnote"><HardDrive size={12}/> Tu ticket se guarda automáticamente</p>}
          </div>
        </aside>
      </div>}
      <Suspense fallback={<div className="panel-loading" role="status" style={{padding:'40px',textAlign:'center'}}>Cargando…</div>}>
      {(page==='Inventario'||page==='Surtido'||page==='Lotes'||page==='Promociones')&&<MasterFilters products={data.products} value={catalogFilters} onChange={setCatalogFilters} search={query} onSearch={setQuery} count={filtered.length}/>} 
      {page==='Inventario'&&<InventoryWorkspace allProducts={data.products} aliases={data.aliases} onRefresh={refresh} products={filtered} canCosts={can('costs.view')} canEdit={(can('inventory.manage')||can('products.edit'))&&can('costs.view')} canRestock={can('inventory.manage')} expiryCount={data.expiry_alerts[0]?.count??0} onNew={()=>setModal({kind:'product'})} onEdit={product=>setModal({kind:'product',product})} onRestock={product=>setModal({kind:'restock',product})} onLots={product=>{if(product){setQuery('');setCatalogFilters({...emptyFilters(),products:[product.id]});}setPage('Lotes');}} onLow={()=>setCatalogFilters(current=>({...current,stock:'low'}))}/>}
      {page==='Inventario'&&can('inventory.count')&&<InventoryCount products={data.products} onRefresh={refresh}/>}
      {page==='Lotes'&&can('inventory.view')&&<StockPrograms section="lots" data={data} ids={filteredIds} onRefresh={refresh}/>}
      {page==='Promociones'&&can('promotions.manage')&&<StockPrograms section="promotions" data={data} ids={filteredIds} onRefresh={refresh}/>}
      {page==='Fiado'&&<section className="panel"><div className="section-head"><div><h2>Fiado y abonos</h2><p>Por cobrar: {money(data.customers.reduce((s,c)=>s+c.balance,0))}</p></div>{can('customers.manage')&&<button className="primary" onClick={()=>setModal({kind:'customer'})}>Agregar cliente</button>}</div><div className="customer-grid">{data.customers.map(c=><article className="customer" key={c.id}><div className="avatar">{c.name.slice(0,2).toUpperCase()}</div><h3>{c.name}</h3><small>{c.phone||'Sin teléfono'}</small><strong>{money(c.balance)}</strong><small>{c.credit_enabled?`Límite: ${money(c.credit_limit)}`:'Fiado desactivado'}</small>{can('customers.manage')&&<button className="light" onClick={()=>setModal({kind:'customer',customer:c.id})}>Editar cliente</button>}<div className={`credit-meter ${c.credit_limit<=0||c.balance/c.credit_limit>=.8?'danger':c.balance/c.credit_limit>=.5?'warning':'healthy'}`}><progress aria-label={`Crédito utilizado por ${c.name}`} value={Math.min(c.balance,Math.max(1,c.credit_limit))} max={Math.max(1,c.credit_limit)}/><small>{c.credit_limit>0?`${Math.round(c.balance/c.credit_limit*100)}% utilizado · Disponible ${money(Math.max(0,c.credit_limit-c.balance))}`:'Sin límite de crédito autorizado'}</small></div><button className="light" disabled={!c.phone} onClick={()=>openWhatsApp(c.phone,statementText(c,settings.store_name??'Mi Tienda')).catch(e=>setError(String(e)))}>Abrir WhatsApp</button>{can('credit.repay')&&<button className="light" disabled={busy||!c.balance} onClick={()=>setModal({kind:'repay',customer:c.id})}>Registrar abono</button>}<button className="light" onClick={()=>copyStatement(c,settings.store_name??'Mi Tienda').then(()=>setNotice('Mensaje copiado. Pégalo en WhatsApp para revisarlo y enviarlo.')).catch(e=>setError(String(e)))}>Copiar mensaje para WhatsApp</button><details><summary>Historial de cuenta</summary>{data.ledger.filter(l=>l.customer===c.id).map(l=><p key={l.id}>{new Date(l.created).toLocaleDateString('es-MX')} · {money(l.amount)}<small>{l.note}</small></p>)}</details></article>)}</div>{!!data.repayments.length&&<><h3>Comprobantes de abono</h3>{data.repayments.map(r=><div className="record" key={r.id}><span>{data.customers.find(c=>c.id===r.customer)?.name}<small>Anterior {money(r.previous_balance)} · Abono {money(r.amount)} · Saldo {money(r.balance)}</small></span>{can('receipt.print')&&<button className="light" onClick={()=>invoke('print_repayment',{id:r.id}).then(()=>setNotice('Comprobante enviado')).catch(e=>setError(String(e)))}>Imprimir</button>}</div>)}</>}</section>}
      {page==='Movimientos'&&<section className="panel"><div className="section-head"><h2>Entradas y salidas de efectivo</h2><button className="primary" onClick={()=>setModal({kind:'movement'})}>Registrar movimiento <kbd>F3</kbd></button></div>{data.movements.map(m=><div className="record" key={m.id}>{m.amount>0?<ArrowDownLeft/>:<ArrowUpRight/>}<span>{m.note}<small>{new Date(m.created).toLocaleString('es-MX')}</small></span><b>{money(m.amount)}</b></div>)}</section>}
      {page==='Historial'&&<section className="history-workspace"><SaleHistory revision={data.sales} products={data.products} onPrint={print} onRefund={id=>{operationId.current='';setModal({kind:'refund',sale:id});}}/>{can('reports.view')&&<><h2 className="mt">Cortes de caja</h2>{data.cuts.map(c=><div className="record" key={c.id}><span>Turno #{c.id}<small>{new Date(c.closed).toLocaleString('es-MX')} · Esperado {money(c.expected)} · Contado {money(c.counted)}</small></span><b>Diferencia {money(c.counted-c.expected)}</b></div>)}</>}</section>}
      {page==='Usuarios'&&can('users.manage')&&<UsersPanel/>}
      {page==='Pedidos'&&(can('purchases.create')||can('inventory.manage'))&&<ProcurementPanel data={data} onRefresh={refresh}/>}
      {page==='Surtido'&&can('inventory.view')&&<BusinessPanel section="inventory" data={data} onRefresh={refresh} filteredProductIds={filteredIds}/>}
      {page==='Reportes'&&can('reports.view')&&<ReportExplorer data={data} productScope={null}/>}
      {page==='Bitácora'&&can('audit.view')&&<BusinessPanel section="audit" data={data} onRefresh={refresh}/>}
      {page==='Personalizar'&&can('settings.manage')&&<BusinessPanel section="customize" data={data} onRefresh={refresh}/>}
      {page==='CFDI'&&can('settings.manage')&&<FiscalPanel/>}
      {page==='Multicaja'&&can('settings.manage')&&<NetworkConnection admin/>}
      {page==='Servicios'&&can('settings.manage')&&<BusinessPanel section="services" data={data} onRefresh={refresh}/>}
      {page==='Respaldos'&&can('backup.create')&&<BackupCenter/>}
      {page==='Ajustes'&&can('settings.manage')&&<section className="settings-grid"><article className="panel"><span className="settings-icon"><Keyboard size={24}/></span><h2>Modo de uso</h2><InputModePicker compact/></article><article className="panel feedback-settings"><span className="settings-icon">{settings.sound==='1'?<Volume2 size={24}/>:<VolumeX size={24}/>}</span><div><h2>Sonidos de caja</h2><p>Un clic al agregar y dos notas suaves al guardar el cobro.</p></div><button type="button" role="switch" aria-label="Sonidos de caja" aria-checked={settings.sound==='1'} className={`sound-switch ${settings.sound==='1'?'on':''}`} disabled={busy} onClick={()=>void write({type:'preferences',sound:settings.sound!=='1'})}><span/></button></article><article className="panel"><span className="settings-icon"><Printer size={24}/></span><h2>Hardware del mostrador</h2><button className="light" onClick={()=>invoke<string[]>('serial_ports').then(setPorts).catch(e=>setError(String(e)))}>Detectar puertos</button><p>{ports.join(' · ')||'Sin puertos consultados'}</p><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void write({type:'settings',printer:String(f.get('printer')),baud:Number(f.get('baud')),scale:String(f.get('scale')),scale_baud:Number(f.get('scale_baud'))},'Configuración guardada');}}><Field label="Puerto de impresora"><input name="printer" placeholder="COM3" defaultValue={settings.printer??''}/></Field><Field label="Velocidad impresora"><select name="baud" defaultValue={settings.baud??'9600'}>{[1200,2400,4800,9600,19200,38400,57600,115200].map(n=><option key={n}>{n}</option>)}</select></Field><Field label="Puerto de báscula"><input name="scale" placeholder="COM4" defaultValue={settings.scale??''}/></Field><Field label="Velocidad báscula"><select name="scale_baud" defaultValue={settings.scale_baud??'9600'}>{[1200,2400,4800,9600,19200,38400,57600,115200].map(n=><option key={n}>{n}</option>)}</select></Field><button disabled={busy} className="primary">Guardar hardware</button></form></article>      <article className="panel"><h2>Respaldo local</h2><p>Accede al centro de copias de seguridad desde el menú Administración &gt; Respaldos.</p><button className="light" onClick={()=>setPage('Respaldos')}>Ir a Respaldos</button><hr/><h3>Seguridad</h3><p>Sesión de {user.name}. Configura los accesos desde Usuarios. El bloqueo no cierra el turno.</p><button className="light" onClick={lock}>Bloquear y cambiar usuario</button></article></section>}
      </Suspense>
      <footer className="bottom-bar"><span><i/> {busy?'Guardando…':'Listo para el siguiente cliente'}</span><span>F1 Buscar <b>·</b> F2 Cobrar <b>·</b> F3 Movimiento <b>·</b> F5–F9 Tickets</span><strong>GRID POS <span> / GRID MX</span></strong></footer>
    </main>
    {modal&&<Dialog returnFocus={modal.kind==='pay'||modal.kind==='credit'?modalReturnFocus.current:undefined} kind={modal.kind} title={title} busy={busy} error={error} onClose={()=>setModal(null)}><form onSubmit={submit} key={`${modal.kind}-${modal.product?.id??''}`}>
      {error&&<div className="alert error" role="alert">{error}</div>}
      {(modal.kind==='pay'||modal.kind==='credit')&&<div className="payment-total"><small>Total del ticket {ticket}</small><NumberTicker cents={total}/></div>}
      {(modal.kind==='pay'||modal.kind==='credit')&&<PaymentFields total={total} customers={data.customers} allowCredit={can('credit.use')} creditOnly={modal.kind==='credit'}/>} 
      {modal.kind==='common'&&<CommonProductFields canCosts={can('costs.view')}/>}
      {modal.kind==='bulk'&&<BulkFields product={modal.product!} existing={lines.find(l=>l.product===modal.product!.id)?.quantity??0} override={lines.find(l=>l.product===modal.product!.id)?.override_price??null}/>} 
      {['open','repay'].includes(modal.kind)&&<><Amount label={modal.kind==='open'?'Fondo inicial de caja':modal.kind==='close'?'Efectivo que contaste físicamente':'Abono recibido en efectivo'}/>{modal.kind==='close'&&<p>El esperado se mostrará en Historial después de guardar el conteo. Este corte es definitivo y cierra el turno.</p>}</>}
      {modal.kind==='close'&&<CashCount soundEnabled={settings.sound==='1'}/>}
      {modal.kind==='movement'&&<><fieldset className="movement-direction"><legend>Movimiento del cajón</legend><label><input type="radio" name="direction" value="out" defaultChecked/>Salida / pago</label><label><input type="radio" name="direction" value="in"/>Entrada de efectivo</label></fieldset><Amount/><Field label="Proveedor, motivo y folio"><input name="note" maxLength={200} placeholder="Bimbo · Nota 1842" required/></Field></>}
      {modal.kind==='customer'&&<><Field label="Nombre o apodo"><input name="name" maxLength={120} required autoFocus={pcMode()} defaultValue={data.customers.find(c=>c.id===modal.customer)?.name} placeholder="Doña Mary · Casa verde"/></Field><Field label="Teléfono"><input name="phone" defaultValue={data.customers.find(c=>c.id===modal.customer)?.phone} type="tel" maxLength={12} inputMode="numeric" pattern="([0-9]{10}|52[0-9]{10})?" title="10 dígitos o 52 seguido de 10 dígitos"/><small>Opcional: 10 dígitos de México, con o sin 52.</small></Field><Field label="Correo"><input name="email" type="email" maxLength={120} defaultValue={data.customers.find(c=>c.id===modal.customer)?.email}/></Field><Field label="Dirección"><input name="address" maxLength={300} defaultValue={data.customers.find(c=>c.id===modal.customer)?.address}/></Field><Amount label="Límite de crédito" defaultValue={String((data.customers.find(c=>c.id===modal.customer)?.credit_limit??50000)/100)}/><label className="check-row"><input name="credit_enabled" type="checkbox" defaultChecked={modal.customer?!!data.customers.find(c=>c.id===modal.customer)?.credit_enabled:true}/>Permitir compras fiadas</label></>}
      {modal.kind==='product'&&<><Field label="Código de barras o código interno"><input name="code" defaultValue={modal.product?.code??modal.code??''} maxLength={64} required autoFocus={pcMode()}/></Field><Field label="Nombre del producto"><input name="name" maxLength={120} defaultValue={modal.product?.name??''} required/></Field><div className="form-pair"><Field label="Categoría"><select name="category" defaultValue={modal.product?.category}>{[...new Set([...categories.slice(1),...data.products.map(p=>p.category)])].sort().map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Unidad"><select name="unit" defaultValue={modal.product?.unit??'pieza'} disabled={!!modal.product&&!can('inventory.count')}><option value="pieza">Pieza</option><option value="kg">Kilogramo</option></select></Field></div><IconPicker product={modal.product} products={data.products}/><ProductPricing product={modal.product}/><p className="muted">Los productos nuevos se crean sin existencias. Registra la mercancía desde Inventario. Solo se puede corregir la unidad antes del primer movimiento y con permiso de conteo. La cantidad numérica se conserva: confirma si representa piezas o kilos; no se convierte automáticamente.</p></>}
      {modal.kind==='restock'&&<><p>{modal.product!.name}</p><Amount label={`Cantidad en ${modal.product!.unit}`} step={modal.product!.unit==='kg'?'0.001':'1'}/><Field label="Proveedor o motivo"><input name="note" placeholder="Entrada inicial / proveedor y folio" required/></Field></>}
      {(modal.kind==='discount'||modal.kind==='refund')&&<><p>{modal.kind==='discount'?modal.product?.name:'Se devolverá la venta completa. Indica si la mercancía puede volver a venderse.'}</p><SupervisorApprovalCard key={`${modal.kind}-${modal.product?.id??modal.sale}`} discount={modal.kind==='discount'} regular={modal.product?linePrice(modal.product,lines.find(l=>l.product===modal.product?.id)??{ticket,product:modal.product.id,quantity:1000,override_price:null,reason:null}):undefined} required={!can(modal.kind==='discount'?'sales.discount':'sales.refund')} error={error}/>{modal.kind==='refund'&&<label className="field"><span>Destino de toda la mercancía</span><select name="return_destination" required defaultValue=""><option value="" disabled>Selecciona después de revisar los productos</option><option value="stock">Regresar a inventario vendible</option><option value="loss">Registrar como merma, no volver a vender</option></select></label>}{modal.kind==='refund'&&<label className="check-row"><input name="card_refunded" type="checkbox"/>Si hubo tarjeta, transferencia, vale o cheque, ya resolví el reembolso externo</label>}</>}
      <ArcadeButton type="submit" className="modal-submit" variant={modal.kind==='close'?'danger':modal.kind==='pay'?'success':'primary'} shortcut="Enter" disabled={busy||(modal.kind==='credit'&&!data.customers.length)}>{busy?'Guardando…':modal.kind==='pay'?'Confirmar cobro':modal.kind==='credit'?'Confirmar fiado':modal.kind==='close'?'Guardar conteo y cerrar turno':modal.kind==='common'?'Agregar al ticket':'Guardar'}</ArcadeButton>
    </form></Dialog>}
  </div>;
}










