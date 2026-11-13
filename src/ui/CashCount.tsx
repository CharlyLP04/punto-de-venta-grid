import { memo, useMemo, useState } from 'react';
import useFeedbackSound from './useFeedbackSound';
import { money } from '../model';
const denominations=[100000,50000,20000,10000,5000,2000,1000,500,200,100,50];
const cashPieces=[...denominations.map(value=>({id:String(value),value,label:value>=2000?'Billete':'Moneda'})),{id:'coin20',value:2000,label:'Moneda'}];
function CashCount({soundEnabled=false}:{soundEnabled?:boolean}){
  const sound=useFeedbackSound(soundEnabled);
  const [counts,setCounts]=useState<Record<string,number>>({});
  const {total,breakdown}=useMemo(()=>{
    let total=0;const byValue=new Map<number,number>();
    for(const piece of cashPieces){const count=counts[piece.id]??0;total+=piece.value*count;byValue.set(piece.value,(byValue.get(piece.value)??0)+count);}
    return {total,breakdown:JSON.stringify(denominations.map(value=>[value,byValue.get(value)??0]))};
  },[counts]);
  return <><p>Cuenta billetes y monedas. Toca el importe para sumar una pieza o escribe cuántas tienes. El saldo esperado no se muestra antes de cerrar.</p><div className="denominations">{cashPieces.map(({id,value,label})=><div className="denomination-control" key={id}><span className="cash-piece-label">{label}</span><button type="button" disabled={(counts[id]??0)>=(value===2000?5000:10000)} aria-label={`Agregar ${label.toLowerCase()} de ${money(value)}`} onClick={()=>{sound.prepare();sound.play(label==='Billete'?'note':'coin');setCounts(previous=>({...previous,[id]:Math.min(id==='coin20'||id==='2000'?5000:10000,(previous[id]??0)+1)}));}}>+ {money(value)}</button><label className="cash-count-quantity"><span>Cantidad de piezas</span><input aria-label={`Cantidad de ${label.toLowerCase()} de ${money(value)}`} type="number" inputMode="numeric" min="0" max={value===2000?5000:10000} step="1" value={counts[id]??0} onChange={e=>setCounts(previous=>({...previous,[id]:Math.min(id==='coin20'||id==='2000'?5000:10000,Math.max(0,Math.floor(Number(e.target.value)||0)))}))}/></label><button type="button" aria-label={`Quitar ${label.toLowerCase()} de ${money(value)}`} disabled={!(counts[id]??0)} onClick={()=>setCounts(previous=>({...previous,[id]:Math.max(0,(previous[id]??0)-1)}))}>−</button></div>)}</div><div className="change">Contado <strong>{money(total)}</strong></div><input type="hidden" name="amount" value={(total/100).toFixed(2)}/><input type="hidden" name="denominations" value={breakdown}/></>;
}

export default memo(CashCount);
