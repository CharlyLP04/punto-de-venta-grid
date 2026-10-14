import {useState} from 'react';
import {money,decimal,type Customer} from '../model';
const labels={cash:'Efectivo',card:'Tarjeta',transfer:'Transferencia',voucher:'Vale',check:'Cheque',credit:'Fiado'};
type Method=keyof typeof labels;
export default function PaymentFields({total,customers,allowCredit,creditOnly=false}:{total:number;customers:Customer[];allowCredit:boolean;creditOnly?:boolean}){
  const [mode,setMode]=useState(creditOnly?'credit':'cash');
  const [parts,setParts]=useState<Record<Method,string>>({cash:'0',card:'0',transfer:'0',voucher:'0',check:'0',credit:'0'});
  const [received,setReceived]=useState('');const [usd,setUsd]=useState('');const [rate,setRate]=useState('');
  const cents=(value:string)=>{try{return decimal(value||'0');}catch{return 0;}};
  const methods=(Object.keys(labels) as Method[]).filter(method=>method!=='credit'||allowCredit);
  const amounts=Object.fromEntries(methods.map(method=>[method,mode===method?total:mode==='mixed'?cents(parts[method]):0])) as Record<Method,number>;
  const cash=amounts.cash??0,credit=amounts.credit??0;
  const external=(amounts.card??0)+(amounts.transfer??0)+(amounts.voucher??0)+(amounts.check??0);
  const equivalent=Math.round(cents(usd)*cents(rate)/100);
  return <>
    {!creditOnly&&<label className="field"><span>Forma de pago</span><select value={mode} onChange={e=>setMode(e.target.value)}>{methods.map(method=><option key={method} value={method}>{labels[method]}</option>)}<option value="mixed">Pago combinado</option><option value="usd">Dólares · cambio en pesos</option></select></label>}
    {mode==='mixed'&&<><div className="payment-splits">{methods.map(method=><label className="field" key={method}><span>{labels[method]}</span><input type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required value={parts[method]} onChange={e=>setParts({...parts,[method]:e.target.value})}/></label>)}</div><p role="status">Por distribuir: {money(total-Object.values(amounts).reduce((a,b)=>a+b,0))}</p></>}
    {(Object.keys(labels) as Method[]).map(method=><input key={method} type="hidden" name={`split_${method}`} value={((amounts[method]??0)/100).toFixed(2)}/>)}
    <input type="hidden" name="split_usd" value={mode==='usd'?(total/100).toFixed(2):'0'}/>
    {mode==='usd'?<><div className="form-pair"><label className="field"><span>Dólares recibidos (USD)</span><input name="usd_units" type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" required value={usd} onChange={e=>setUsd(e.target.value)}/></label><label className="field"><span>Pesos por dólar · tipo de cambio de la tienda</span><input name="usd_rate" type="number" inputMode="decimal" min="0.01" max="1000" step="0.01" required value={rate} onChange={e=>setRate(e.target.value)}/></label></div><p role="status">Equivalente: {money(equivalent)} · Cambio en pesos: {money(Math.max(0,equivalent-total))}</p><p className="muted">Los dólares se registran por separado. Solo el cambio entregado reduce el efectivo en pesos del cajón.</p></>:<><input type="hidden" name="usd_units" value="0"/><input type="hidden" name="usd_rate" value="0"/></>}
    {cash>0?<><label className="field"><span>Efectivo recibido (MXN)</span><input name="received" type="number" inputMode="decimal" min={(cash/100).toFixed(2)} max="1000000" step="0.01" required value={received} onChange={e=>setReceived(e.target.value)}/></label><div className="quick-cash">{[cash,5000,10000,20000,50000].filter((n,i,a)=>n>=cash&&a.indexOf(n)===i).map(n=><button type="button" key={n} onClick={()=>setReceived((n/100).toFixed(2))}>{n===cash?'Exacto':money(n)}</button>)}</div><div className="change">Cambio <strong>{money(Math.max(0,cents(received)-cash))}</strong></div></>:<input type="hidden" name="received" value="0"/>}
    {external>0&&<><p className="muted">Confirma el pago fuera del sistema. Mario registra la referencia y no realiza cargos bancarios.</p><label className="field"><span>Referencia(s), autorización o folio</span><input name="reference" maxLength={100} required/></label></>}
    {customers.length>0&&<label className="field"><span>{credit>0?'Cliente para el fiado':'Asignar venta a un cliente (opcional)'}</span><select name="customer" required={credit>0} defaultValue=""><option value="" disabled={credit>0}>Mostrador</option>{customers.map(c=><option key={c.id} value={c.id} disabled={credit>0&&(!c.credit_enabled||c.balance+credit>c.credit_limit)}>{c.name}{credit>0?` · Disponible ${money(c.credit_limit-c.balance)}`:''}</option>)}</select></label>}
  </>;
}
