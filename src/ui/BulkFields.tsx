import { useState } from 'react';

import { decimal,money,quantity,type Product } from '../model';
export default function BulkFields({product,existing=0,override=null}:{product:Product;existing?:number;override?:number|null}){
  const [mode,setMode]=useState('weight');const [amount,setAmount]=useState('');
  let qty=0;
  try{qty=bulkQuantity(product,existing,override,mode,amount);}catch{ /* Blank and partial input have no preview. */ }
  const price=override??Math.min(product.wholesale_quantity>0&&existing+qty>=product.wholesale_quantity?product.wholesale_price:product.price,product.promotion_price??Infinity);
  return <><p>{money(price)} / kg · {quantity(product.stock)} kg disponibles</p><label className="field"><span>Vender por</span><select name="mode" value={mode} onChange={e=>setMode(e.target.value)}><option value="weight">Peso en kilogramos</option><option value="money">Importe en pesos</option></select></label><label className="field"><span>{mode==='weight'?'Peso (kg)':'Importe ($)'}</span><input name="amount" type="number" inputMode="decimal" min={mode==='weight'?'0.001':'0.01'} step={mode==='weight'?'0.001':'0.01'} value={amount} onChange={e=>setAmount(e.target.value)} required autoFocus/></label><div className="bulk-presets" role="group" aria-label="Pesos rápidos">{[[100,'100 g'],[250,'250 g'],[500,'½ kg'],[750,'¾ kg'],[1000,'1 kg'],[2000,'2 kg']].map(([grams,label])=><button type="button" key={grams} aria-pressed={mode==='weight'&&Number(amount)===Number(grams)/1000} onClick={()=>{setMode('weight');setAmount(String(Number(grams)/1000));}}>{label}</button>)}</div><div className="bulk-presets" role="group" aria-label="Importes rápidos">{[10,15,20,50].map(value=><button type="button" key={value} onClick={()=>{setMode('money');setAmount(String(value));}}>${value}</button>)}</div><div className="bulk-preview">{quantity(qty)} kg · {money(Math.round(qty*price/1000))}</div><p className="muted">Redondeo al gramo más cercano. El mayoreo puede ajustar también las unidades previas del ticket.</p><button type="button" className="light" disabled>Báscula automática · Beta</button><small>Próximamente. Por ahora ingresa el peso manualmente.</small></>;
}
export function bulkQuantity(product:Product,existing:number,override:number|null,mode:string,amount:string){
  if(mode==='weight')return decimal(amount,3);
  const cents=decimal(amount);const wholesale=product.wholesale_quantity>0&&product.wholesale_price>0?Math.round(cents*1000/product.wholesale_price):0;
  const price=override??Math.min(wholesale>0&&existing+wholesale>=product.wholesale_quantity?product.wholesale_price:product.price,product.promotion_price??Infinity);
  return Math.round(cents*1000/price);
}


