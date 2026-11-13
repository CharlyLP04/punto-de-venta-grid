import {memo,useMemo} from 'react';
import {ArrowDownLeft,ArrowUpRight} from 'lucide-react';
import {money,type Snapshot} from '../model';

const timestamp=new Intl.DateTimeFormat('es-MX',{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric'});
function dateLabel(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?date.toLocaleString('es-MX'):timestamp.format(date);}

export const CashMovements=memo(function CashMovements({entries}:{entries:Snapshot['movements']}){
 const rows=useMemo(()=>entries.map(m=><div className="record" key={m.id}>{m.amount>0?<ArrowDownLeft/>:<ArrowUpRight/>}<span>{m.note}<small>{dateLabel(m.created)}</small></span><b>{money(m.amount)}</b></div>),[entries]);
 return <>{rows}</>;
});
export const CashCuts=memo(function CashCuts({entries}:{entries:Snapshot['cuts']}){
 const rows=useMemo(()=>entries.map(c=><div className="record" key={c.id}><span>Turno #{c.id}<small>{dateLabel(c.closed)} · Esperado {money(c.expected)} · Contado {money(c.counted)}</small></span><b>Diferencia {money(c.counted-c.expected)}</b></div>),[entries]);
 return <>{rows}</>;
});
