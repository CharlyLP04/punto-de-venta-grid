import {memo,useState} from 'react';
import {money,type Snapshot} from '../model';

type Entry=Snapshot['ledger'][number];
const dayFormatter=new Intl.DateTimeFormat('es-MX');
function dateLabel(value:string){const date=new Date(value);return Number.isNaN(date.getTime())?date.toLocaleDateString('es-MX'):dayFormatter.format(date);}
// Closed histories do not allocate every movement's DOM. Opening always uses current entries.
export default memo(function CustomerHistory({entries}:{entries:Entry[]}){
 const [visited,setVisited]=useState(false);
 return <details onToggle={event=>{if(event.currentTarget.open)setVisited(true);}}><summary>Historial de cuenta</summary>{visited&&entries.map(entry=><p key={entry.id}>{dateLabel(entry.created)} · {money(entry.amount)}<small>{entry.note}</small></p>)}</details>;
});
