import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Eye,EyeOff,ReceiptText,Search,RotateCcw,Printer,X,ShoppingBag} from 'lucide-react';
import {invoke} from '../api';
import {useSession} from '../security/Session';
import {decimal,money,quantity,type Product} from '../model';

type ReceiptItem={id?:number;name:string;quantity:number;unit:string;price:number;subtotal:number};
type SaleReceipt={
  store?:string;
  cashier?:string;
  items?:ReceiptItem[];
  total?:number;
  payment?:string;
  change?:number;
  footer?:string;
  tender?:Record<string,number>;
};
type Sale={
  id:string;
  total:number;
  created:string;
  cashier:string;
  customer:string;
  payment:string;
  print_status:string;
  refunded:boolean;
  receipt?:SaleReceipt;
};
type Filter={query:string;from:string|null;to:string|null;cashier:number|null;product:number|null;amount:number|null;page:number};
const initial:Filter={query:'',from:null,to:null,cashier:null,product:null,amount:null,page:0};

export default function SaleHistory({products,onPrint,onRefund,revision}:{revision:unknown;products:Product[];onPrint:(id:string,copy:boolean)=>Promise<void>;onRefund:(id:string)=>void}){
  const {can}=useSession();
  const [result,setResult]=useState<{entries:Sale[];total:number;page:number;cashiers:{id:number;name:string}[]}>();
  const [filter,setFilter]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [expandedSale,setExpandedSale]=useState<string|null>(null);
  const generation=useRef(0);
  const searchForm=useRef<HTMLFormElement>(null);

  async function load(next:Filter){
    const id=++generation.current;
    setBusy(true);
    setError('');
    try{
      const result=await invoke<{entries:Sale[];total:number;page:number;cashiers:{id:number;name:string}[]}>('sale_history',{filter:next});
      if(id===generation.current){
        setResult(result);
        setFilter(next);
      }
    }catch(e){
      if(id===generation.current)setError(String(e));
    }finally{
      if(id===generation.current)setBusy(false);
    }
  }

  useEffect(()=>{
    void load(filter);
    return()=>{generation.current++;};
  },[revision]);

  function quickRange(days:number){
    const end=new Date(),start=new Date();
    start.setDate(start.getDate()-days);
    const day=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const form=searchForm.current;
    if(!form)return;
    (form.elements.namedItem('from') as HTMLInputElement).value=day(start);
    (form.elements.namedItem('to') as HTMLInputElement).value=day(end);
    form.requestSubmit();
  }

  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    try{
      void load({
        query:String(f.get('query')??''),
        from:String(f.get('from')??'')||null,
        to:String(f.get('to')??'')||null,
        cashier:f.get('cashier')?Number(f.get('cashier')):null,
        product:f.get('product')?Number(f.get('product')):null,
        amount:f.get('amount')?decimal(String(f.get('amount'))):null,
        page:0
      });
    }catch(e){
      setError(String(e));
    }
  }

  return (
    <article className="panel sales-history">
      <div className="section-head">
        <div>
          <h2>Tickets de venta</h2>
          <p className="history-subtitle">Historial de tickets cobrados, reimpresiones y consultas de partidas.</p>
        </div>
        <div className="range-presets">
          <button type="button" disabled={busy} onClick={()=>quickRange(0)}>Hoy</button>
          <button type="button" disabled={busy} onClick={()=>quickRange(6)}>7 días</button>
        </div>
      </div>

      <form ref={searchForm} onSubmit={submit} className="history-filters-form">
        <div className="report-filter-grid">
          <label className="field">
            <span>Folio o cliente</span>
            <input name="query" maxLength={120} placeholder="Folio o nombre…"/>
          </label>
          <label className="field">
            <span>Desde</span>
            <input name="from" type="date"/>
          </label>
          <label className="field">
            <span>Hasta</span>
            <input name="to" type="date"/>
          </label>
          <details className="history-extra">
            <summary>Más filtros</summary>
            <div className="report-filter-grid">
              <label className="field">
                <span>Producto vendido</span>
                <select name="product">
                  <option value="">Todos</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              {can('reports.view')&&<label className="field">
                <span>Cajero</span>
                <select name="cashier">
                  <option value="">Todo el equipo</option>
                  {result?.cashiers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>}
              <label className="field">
                <span>Total exacto ($)</span>
                <input name="amount" type="number" min="0" step="0.01"/>
              </label>
            </div>
          </details>
        </div>

        <div className="search-submit-bar">
          <button className="primary history-submit-btn" disabled={busy} type="submit">
            <Search size={16} aria-hidden="true"/>
            <span>Buscar tickets</span>
          </button>
          <span className="tickets-count-badge" role="status">
            {busy ? 'Consultando…' : `${result?.total ?? 0} tickets encontrados`}
          </span>
        </div>
      </form>

      {error && <p role="alert" className="error">{error}</p>}

      <div className="records-list">
        {result?.entries.map(s => {
          const isExpanded = expandedSale === s.id;
          const items = s.receipt?.items ?? [];
          return (
            <div className={`record-card ${isExpanded ? 'record-card-expanded' : ''}`} key={s.id}>
              <div className="record-main-row">
                <div className="record-meta-col">
                  <div className="record-folio-line">
                    <button 
                      type="button" 
                      className={`ticket-eye-btn ${isExpanded ? 'active' : ''}`}
                      onClick={() => setExpandedSale(isExpanded ? null : s.id)}
                      title={isExpanded ? "Ocultar productos" : "Ver productos de este ticket"}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <EyeOff size={16} aria-hidden="true"/> : <Eye size={16} aria-hidden="true"/>}
                    </button>
                    <span className="record-folio">#{s.id.slice(0, 8)}</span>
                    {s.refunded && <span className="refunded-pill">DEVUELTA</span>}
                    {items.length > 0 && (
                      <span className="items-count-pill">{items.length} {items.length === 1 ? 'artículo' : 'artículos'}</span>
                    )}
                  </div>
                  <small className="record-sub">
                    {new Date(s.created).toLocaleString('es-MX')} · {s.cashier} · {s.customer}
                  </small>
                </div>

                <b className="record-total">{money(s.total)}</b>

                <div className="record-actions">
                  <button 
                    type="button" 
                    className={`light record-preview-btn ${isExpanded ? 'active' : ''}`}
                    onClick={() => setExpandedSale(isExpanded ? null : s.id)}
                    title={isExpanded ? "Ocultar partidas" : "Ver productos vendidos"}
                  >
                    {isExpanded ? <EyeOff size={15} aria-hidden="true"/> : <Eye size={15} aria-hidden="true"/>}
                    <span>{isExpanded ? 'Ocultar' : 'Ver productos'}</span>
                  </button>

                  {can('receipt.print') && (
                    <button 
                      type="button" 
                      className="light" 
                      disabled={busy} 
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          if (['sending','uncertain'].includes(s.print_status)) {
                            await invoke('resolve_print', { id: s.id });
                          } else {
                            await onPrint(s.id, s.print_status === 'sent');
                          }
                          await load(filter);
                        } catch(e) {
                          setError(String(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Printer size={15} aria-hidden="true"/>
                      <span>
                        {['sending','uncertain'].includes(s.print_status)
                          ? 'Revisar papel'
                          : s.print_status === 'sent'
                          ? 'Imprimir copia'
                          : 'Imprimir'}
                      </span>
                    </button>
                  )}

                  {can('sales.create') && !s.refunded && (
                    <button 
                      type="button" 
                      className="light refund-btn" 
                      disabled={busy} 
                      onClick={() => onRefund(s.id)}
                      title="Registrar devolución de este ticket"
                    >
                      <RotateCcw size={14} aria-hidden="true"/>
                      <span>Devolver</span>
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="ticket-preview-drawer" role="region" aria-label={`Detalle de ticket ${s.id.slice(0, 8)}`}>
                  <div className="ticket-preview-card">
                    <div className="receipt-banner">
                      <div className="receipt-banner-left">
                        <ShoppingBag size={17} aria-hidden="true"/>
                        <strong>Productos vendidos en ticket #{s.id.slice(0, 8)}</strong>
                      </div>
                      <button 
                        type="button" 
                        className="close-drawer-btn" 
                        onClick={() => setExpandedSale(null)}
                        aria-label="Cerrar vista previa"
                      >
                        <X size={16} aria-hidden="true"/>
                      </button>
                    </div>

                    {items.length > 0 ? (
                      <div className="receipt-table">
                        <div className="receipt-thead">
                          <span className="th-name">Producto</span>
                          <span className="th-qty">Cantidad</span>
                          <span className="th-price">Precio</span>
                          <span className="th-subtotal">Importe</span>
                        </div>
                        <div className="receipt-tbody">
                          {items.map((item, idx) => (
                            <div className="receipt-tr" key={idx}>
                              <span className="td-name">{item.name}</span>
                              <span className="td-qty">{quantity(item.quantity)} {item.unit}</span>
                              <span className="td-price">{money(item.price)}</span>
                              <span className="td-subtotal"><b>{money(item.subtotal)}</b></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="receipt-empty-note">
                        <p>Total registrado: <b>{money(s.total)}</b></p>
                        <small>Este ticket histórico no contiene el desglose de productos individuales.</small>
                      </div>
                    )}

                    <div className="receipt-summary-strip">
                      <div className="receipt-meta-chips">
                        <span>Atendió: <b>{s.cashier}</b></span>
                        <span>Cliente: <b>{s.customer}</b></span>
                        <span>Pago: <b>{s.payment === 'cash' ? 'Efectivo' : s.payment === 'card' ? 'Tarjeta' : s.payment === 'credit' ? 'Fiado' : s.payment}</b></span>
                        {typeof s.receipt?.change === 'number' && s.receipt.change > 0 && (
                          <span>Cambio: <b>{money(s.receipt.change)}</b></span>
                        )}
                      </div>
                      <div className="receipt-grand-total">
                        <small>TOTAL</small>
                        <strong>{money(s.total)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="form-actions">
        <button className="light" disabled={busy||!result||result.page===0} onClick={()=>void load({...filter,page:filter.page-1})}>Anterior</button>
        <span>Página {(result?.page??0)+1}</span>
        <button className="light" disabled={busy||!result||(result.page+1)*40>=result.total} onClick={()=>void load({...filter,page:filter.page+1})}>Siguiente</button>
      </div>
    </article>
  );
}

