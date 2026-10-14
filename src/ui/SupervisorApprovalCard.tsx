import { useState } from 'react';
import { ShieldCheck,ArrowRight } from 'lucide-react';
import { money } from '../model';
export default function SupervisorApprovalCard({required,regular,discount,error}:{required:boolean;regular?:number;discount:boolean;error:string}){
  const [price,setPrice]=useState(regular===undefined?'':(regular/100).toFixed(2));const [reason,setReason]=useState('');const [authorize,setAuthorize]=useState(required);
  const cents=Math.round(Number(price)*100);const reduction=regular&&Number.isFinite(cents)?Math.max(0,(regular-cents)/regular*100):0;
  return <section className={`approval-card ${error?'micro-shake':''}`}><header><ShieldCheck size={21}/><span><strong>{discount?'Ajuste de precio':'Autorización de devolución'}</strong><small>La operación queda registrada a tu nombre</small></span></header>
    {discount&&<><div className="approval-impact"><span><small>Precio actual</small>{money(regular??0)}</span><ArrowRight size={20}/><span><small>Nuevo precio</small>{Number.isFinite(cents)?money(cents):'—'}</span><b>−{reduction.toFixed(1)}%</b></div><label className="field"><span>Precio autorizado por unidad</span><input name="amount" type="number" min="0.01" max="1000000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} required autoFocus/></label></>}
    <label className="field"><span>Motivo obligatorio</span><input name="reason" required maxLength={200} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe por qué se realiza este ajuste"/></label>{reason&&<p className="approval-reason">{reason}</p>}
    {!required&&<label className="check-row"><input type="checkbox" checked={authorize} onChange={e=>setAuthorize(e.target.checked)}/>Solicitar autorización de otro usuario</label>}
    {authorize&&<div className="approval-credentials"><p>El encargado autoriza únicamente esta operación, con sus permisos y límite de descuento.</p><div className="form-pair"><label className="field"><span>Usuario que autoriza</span><input name="supervisor_username" required autoComplete="off" maxLength={40}/></label><label className="field"><span>Contraseña</span><input name="supervisor_password" type="password" required autoComplete="off" maxLength={128}/></label></div></div>}
  </section>;
}
