import { useEffect, useMemo, useRef, useState } from 'react';
import {Search,X} from 'lucide-react';
import SavedFilters from './SavedFilters';
import type { Product } from '../model';

export type CatalogFilters = {
  categories:string[]; products:number[]; stock:string; unit:string;
  min:string; max:string; favorites:boolean; frequent:boolean; sort:string;
};
export const emptyFilters = ():CatalogFilters => ({categories:[],products:[],stock:'all',unit:'all',min:'',max:'',favorites:false,frequent:false,sort:'name'});
export const normalize = (text:string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX');
const collator=new Intl.Collator('es-MX');
function matchesSearch(product:Product,words:string[],extra:Map<number,string[]>){
  if(!words.length)return true;
  const haystack=normalize(`${product.name} ${product.code} ${product.category} ${(extra.get(product.id)??[]).join(' ')}`);
  return words.every(word=>haystack.includes(word));
}
export function filterCatalog(products:Product[], filters:CatalogFilters, search:string, aliases:{product:number;code:string}[], frequency:Map<number,number>) {
  const extra=new Map<number,string[]>();
  for(const alias of aliases){const list=extra.get(alias.product);if(list)list.push(alias.code);else extra.set(alias.product,[alias.code]);}
  const selectedCategories=new Set(filters.categories),selectedProducts=new Set(filters.products);
  const words=normalize(search).trim().split(/\s+/).filter(Boolean);
  const min=filters.min===''?0:Math.round(Number(filters.min)*100);
  const max=filters.max===''?Infinity:Math.round(Number(filters.max)*100);
  return products.filter(p=>
    (!filters.categories.length||selectedCategories.has(p.category))&&
    (!filters.products.length||selectedProducts.has(p.id))&&
    (filters.unit==='all'||p.unit===filters.unit)&&
    (filters.stock==='all'||(filters.stock==='available'&&p.stock>0)||(filters.stock==='empty'&&p.stock<=0)||(filters.stock==='low'&&p.stock<=p.minimum))&&
    (!filters.favorites||!!p.favorite)&&(!filters.frequent||frequency.has(p.id))&&
    (p.promotion_price??p.price)>=min&&(p.promotion_price??p.price)<=max&&
    matchesSearch(p,words,extra)
  ).sort((a,b)=>{
    const order=filters.sort==='price-up'?(a.promotion_price??a.price)-(b.promotion_price??b.price):filters.sort==='price-down'?(b.promotion_price??b.price)-(a.promotion_price??a.price):filters.sort==='stock'?a.stock-b.stock:filters.sort==='frequency'?(frequency.get(b.id)??0)-(frequency.get(a.id)??0):0;
    return order||collator.compare(a.name,b.name)||a.id-b.id;
  });
}
export default function MasterFilters({products,value,onChange,search,onSearch,count,compact=false}:{compact?:boolean;products:Product[];value:CatalogFilters;onChange:(value:CatalogFilters)=>void;search:string;onSearch:(value:string)=>void;count:number}) {
  const [productSearch,setProductSearch]=useState('');
  const [open,setOpen]=useState(false);
  const [optionPage,setOptionPage]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
  useEffect(()=>setOptionPage(0),[productSearch,products]);
  const categories=useMemo(()=>[...new Set(products.map(p=>p.category))].sort((a,b)=>a.localeCompare(b,'es-MX')),[products]);
  const counts=useMemo(()=>{const result=new Map<string,number>();for(const p of products)result.set(p.category,(result.get(p.category)??0)+1);return result;},[products]);
  const options=useMemo(()=>{const needle=normalize(productSearch);return open?products.filter(p=>normalize(`${p.name} ${p.code}`).includes(needle)):[];},[products,productSearch,open]);
  function patch(change:Partial<CatalogFilters>){onChange({...value,...change});}
  const active=value.categories.length+value.products.length+Number(value.stock!=='all')+Number(value.unit!=='all')+Number(value.min!=='')+Number(value.max!=='')+Number(value.favorites)+Number(value.frequent)+Number(!!search);
  return <section className="master-filters" aria-label="Filtros maestros de productos">
    <header><button type="button" className="filter-trigger" onClick={()=>setOpen(true)}>Filtros {active>0&&<b>{active}</b>}</button><span role="status">{count} de {products.length} productos</span><button type="button" className="light" onClick={()=>{onChange(emptyFilters());onSearch('');setProductSearch('');}}>Limpiar filtros</button></header>
    {!compact&&<label className="field"><span>Buscar en el catálogo</span><span className="input-adornment"><Search size={18} aria-hidden="true"/><input type="search" value={search} onChange={e=>onSearch(e.target.value)} placeholder="Nombre, categoría o código…"/>{search&&<button type="button" aria-label="Limpiar búsqueda del catálogo" onClick={()=>onSearch('')}><X size={18} aria-hidden="true"/></button>}</span></label>}
    <div className="quick-categories" aria-label="Categorías rápidas">{categories.map(category=><button type="button" key={category} aria-pressed={value.categories.includes(category)} onClick={()=>patch({categories:value.categories.includes(category)?value.categories.filter(c=>c!==category):[...value.categories,category]})}>{category} <b>{counts.get(category)??0}</b></button>)}</div><dialog ref={dialog} className="filter-dialog" aria-labelledby="filter-dialog-title" onClose={()=>setOpen(false)}>{open&&<><header><div><h2 id="filter-dialog-title">Filtros maestros</h2></div><button type="button" className="light" onClick={()=>dialog.current?.close()} aria-label="Cerrar filtros">Cerrar ×</button></header>
      <SavedFilters value={value} search={search} onApply={(filters,query)=>{onChange(filters);onSearch(query);}}/><p className="muted">Combina categorías, productos y condiciones. Se conservan entre Caja e Inventario.</p>
      <div className="master-grid"><fieldset><legend>Categorías · varias a la vez</legend><div className="category-pills">{categories.map(category=><button type="button" key={category} aria-pressed={value.categories.includes(category)} onClick={()=>patch({categories:value.categories.includes(category)?value.categories.filter(c=>c!==category):[...value.categories,category]})}>{category}<b>{counts.get(category)??0}</b></button>)}</div></fieldset>
      <fieldset><legend>Productos específicos</legend><input type="search" aria-label="Buscar productos para seleccionar" value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Localizar producto"/><div className="master-options">{options.slice(optionPage*40,(optionPage+1)*40).map(product=><label key={product.id}><input type="checkbox" checked={value.products.includes(product.id)} onChange={e=>patch({products:e.target.checked?[...value.products,product.id]:value.products.filter(id=>id!==product.id)})}/>{product.name} · {product.code}</label>)}{!options.length&&<span>No hay coincidencias.</span>}</div>{options.length>40&&<nav className="filter-pagination" aria-label="Páginas de productos para filtrar"><button type="button" disabled={optionPage===0} onClick={()=>setOptionPage(p=>p-1)}>Anterior</button><span role="status">{optionPage+1} / {Math.ceil(options.length/40)}</span><button type="button" disabled={(optionPage+1)*40>=options.length} onClick={()=>setOptionPage(p=>p+1)}>Siguiente</button></nav>}</fieldset>
      <label className="field"><span>Existencias</span><select value={value.stock} onChange={e=>patch({stock:e.target.value})}><option value="all">Todas</option><option value="available">Con existencias</option><option value="empty">Agotados</option><option value="low">En mínimo o por debajo</option></select></label>
      <label className="field"><span>Unidad</span><select value={value.unit} onChange={e=>patch({unit:e.target.value})}><option value="all">Todas</option><option value="pieza">Por pieza</option><option value="kg">Por kilogramo</option></select></label>
      <label className="field"><span>Precio vigente desde ($)</span><span className="input-adornment"><span aria-hidden="true">$</span><input type="number" inputMode="decimal" min="0" step="0.01" value={value.min} onChange={e=>patch({min:e.target.value})}/></span></label>
      <label className="field"><span>Precio vigente hasta ($)</span><span className="input-adornment"><span aria-hidden="true">$</span><input type="number" inputMode="decimal" min="0" step="0.01" value={value.max} onChange={e=>patch({max:e.target.value})}/></span></label>
      <label className="filter-switch"><input role="switch" type="checkbox" checked={value.favorites} onChange={e=>patch({favorites:e.target.checked})}/> Solo favoritos</label><label className="filter-switch"><input role="switch" type="checkbox" checked={value.frequent} onChange={e=>patch({frequent:e.target.checked})}/> Con ventas recientes</label>
      </div>
    {value.min!==""&&value.max!==""&&Number(value.min)>Number(value.max)&&<p role="alert">El mínimo supera al máximo. Ajusta el rango.</p>}<footer className="filter-dialog-footer"><span role="status">{count} productos coinciden</span><button type="button" className="primary" onClick={()=>dialog.current?.close()}>Ver {count} resultados</button></footer></>}</dialog>
    {value.min!==''&&value.max!==''&&Number(value.min)>Number(value.max)&&<p role="alert">El precio mínimo supera al máximo. Ajusta el rango.</p>}
    <label className="master-sort">Ordenar<select value={value.sort} onChange={e=>patch({sort:e.target.value})}><option value="name">Nombre A–Z</option><option value="price-up">Menor precio</option><option value="price-down">Mayor precio</option><option value="stock">Menor existencia</option><option value="frequency">Más vendidos recientemente</option></select></label>
    <div className="master-chips">
      {value.stock!=='all'&&<button type="button" onClick={()=>patch({stock:'all'})}>Existencia: {({available:'Disponible',empty:'Agotados',low:'Por surtir'} as Record<string,string>)[value.stock]} ×</button>}
      {value.unit!=='all'&&<button type="button" onClick={()=>patch({unit:'all'})}>{value.unit==='kg'?'Por kilo':'Por pieza'} ×</button>}
      {(value.min!==''||value.max!=='')&&<button type="button" onClick={()=>patch({min:'',max:''})}>Precio: {value.min||'0'}–{value.max||'sin máximo'} ×</button>}
      {value.favorites&&<button type="button" onClick={()=>patch({favorites:false})}>Favoritos ×</button>}
      {value.frequent&&<button type="button" onClick={()=>patch({frequent:false})}>Con ventas recientes ×</button>}
{value.categories.map(category=><button type="button" key={category} onClick={()=>patch({categories:value.categories.filter(c=>c!==category)})}>{category} ×</button>)}{value.products.map(id=><button type="button" key={id} onClick={()=>patch({products:value.products.filter(p=>p!==id)})}>{products.find(p=>p.id===id)?.name??`Producto ${id}`} ×</button>)}</div>
  </section>;
}



