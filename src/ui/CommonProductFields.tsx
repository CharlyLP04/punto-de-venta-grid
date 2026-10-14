import {useState} from 'react';
import {decimal,money} from '../model';
import {pcMode} from './InputMode';

export default function CommonProductFields({canCosts}:{canCosts:boolean}) {
  const [quantity,setQuantity]=useState('1');
  const [price,setPrice]=useState('');
  let total:number|null=null;
  try { total=Math.round(decimal(quantity,3)*decimal(price)/1000); } catch { /* Incomplete input. */ }
  return <>
    <p className="muted">Solo para este ticket. No crea un producto en el catálogo ni descuenta existencias.</p>
    <label className="field"><span>Descripción</span><input name="name" required maxLength={120} autoFocus={pcMode()} placeholder="Ej. dulces sueltos"/></label>
    <div className="form-pair">
      <label className="field"><span>Cantidad</span><input name="quantity" type="number" inputMode="decimal" min="0.001" max="1000" step="0.001" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
      <label className="field"><span>Precio unitario ($)</span><input name="price" type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></label>
    </div>
    {canCosts&&<details><summary>Agregar costo para calcular el margen</summary><label className="field"><span>Costo unitario ($), opcional</span><input name="cost" type="number" inputMode="decimal" min="0" max="1000000" step="0.01"/><small>Vacío significa desconocido. Escribe 0 solo si realmente no tuvo costo.</small></label></details>}
    <p className="common-total" role="status">Importe <strong>{total===null?'—':money(total)}</strong></p>
  </>;
}
