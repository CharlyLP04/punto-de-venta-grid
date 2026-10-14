export type Product = { id:number; cost_known?:number; common?:number; code:string; name:string; category:string; icon:string; price:number; cost:number; unit:'pieza'|'kg'; stock:number;physical_stock:number;expired_stock:number; minimum:number;target:number;wholesale_quantity:number;wholesale_price:number;favorite:number;promotion_price:number|null };
export type Line = { ticket:number; product:number; quantity:number; override_price:number|null; reason:string|null };
export const linePrice=(product:Product|undefined,line:Line)=>line.override_price??Math.min(product&&product.wholesale_quantity>0&&line.quantity>=product.wholesale_quantity?product.wholesale_price:product?.price??0,product?.promotion_price??Infinity);
export type Customer = { credit_enabled:number;enabled:number;email:string;address:string; id:number; name:string; phone:string; credit_limit:number; balance:number };
export type Sale = { id:string; total:number; payment:string; created:string; print_status:string;cashier:string;refunded:number };
export type Snapshot = {
  expiry_alerts:{count:number}[];
  products:Product[]; common_products?:Product[]; lines:Line[]; customers:Customer[]; sales:Sale[];
  frequencies:{product:number;count:number}[];
  aliases:{code:string;product:number}[];
  repayments:{id:string;customer:number;amount:number;previous_balance:number;balance:number;created:string}[];
  movements:{ id:number; amount:number; note:string; created:string }[];
  ledger:{ id:number; customer:number; amount:number; note:string; created:string }[];
  shift:{ id:number; created:string;user_id:number;cashier:string }[];
  cuts:{ id:number; opening:number; counted:number; expected:number; closed:string }[];
  settings:{ key:string; value:string }[]; stats:{ today:number; tickets:number }[]; pending:{count:number}[];
};
export type Receipt = { id:string; total:number; received:number; change:number; payment:string };
const currencyFormatter = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});
const quantityFormatter = new Intl.NumberFormat('es-MX',{maximumFractionDigits:3});
export const money = (cents:number) => currencyFormatter.format(cents/100);
export const quantity = (value:number) => quantityFormatter.format(value/1000);
export function decimal(text:string, digits=2) {
  const normalized=text.trim().replace(',','.');
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`).test(normalized)) throw new Error(`Ingresa un número positivo con hasta ${digits} decimales`);
  const [whole,fraction='']=normalized.split('.');
  const value=Number(whole)*10**digits+Number(fraction.padEnd(digits,'0'));
  if (!Number.isSafeInteger(value) || value>100_000_000) throw new Error('Cantidad fuera de rango');
  return value;
}


