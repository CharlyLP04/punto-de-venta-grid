import {useState} from 'react';
import {Package} from 'lucide-react';
import {supplierBrands,brandLogo} from './brandAssets';
export {supplierBrands} from './brandAssets';
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function SupplierBrandIcon({name}:{name:string}){
 const src=brandLogo(name);
 const [failed,setFailed]=useState('');
 return <span className="supplier-brand-symbol" aria-hidden="true">{src&&failed!==src?<img src={src} alt="" width="64" height="36" onError={()=>setFailed(src)}/>:<Package size={26} strokeWidth={1.7}/>}</span>;
}
export function SupplierBrandPicker({onPick}:{onPick:(name:string)=>void}){
 const [search,setSearch]=useState('');const [expanded,setExpanded]=useState(false);
 const matches=supplierBrands.filter(b=>normalize(b[0]).includes(normalize(search)));
 const priority=['Bimbo','Sabritas','Lala','Gamesa','Pepsi','Coca-Cola','Marinela','Barcel'];
 const visible=search||expanded?matches:priority.flatMap(name=>matches.filter(brand=>brand[0]===name));
 return <div className="supplier-brand-picker"><label className="field">Elegir una marca (opcional)<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar marca: Lala, Sabritas, Jumex…"/></label><div className="supplier-suggestions" aria-label="Marcas de proveedores">{visible.map(([name])=><button type="button" key={name} onClick={()=>onPick(name)}><SupplierBrandIcon name={name}/><span>{name}</span></button>)}</div>{!search&&<button type="button" className="light" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Mostrar menos':`Ver las ${supplierBrands.length} marcas`}</button>}{!matches.length&&<p>Escribe el nombre de tu proveedor abajo para agregarlo.</p>}<small>La marca solo completa el nombre. Agrega el teléfono de tu repartidor.</small></div>;
}
