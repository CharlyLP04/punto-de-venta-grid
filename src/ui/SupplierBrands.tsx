import {useState} from 'react';
import {Package} from 'lucide-react';
const logos=import.meta.glob('../assets/supplier-brands/*.{svg,png,gif,webp}',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const supplierBrands=[
 ['Bimbo','BI','bimbo'],['Grupo Bimbo','GB','grupo-bimbo'],['Marinela','MA','marinela'],['Tía Rosa','TR'],['Wonder','WO'],['Barcel','BA','barcel'],
 ['Coca-Cola','CC','coca-cola'],['Pepsi','PE','pepsi'],['Jarritos','JA'],['Peñafiel','PÑ'],['Jumex','JU'],['Boing','BO','boing'],['Bonafont','BF'],['Ciel','CI'],['Epura','EP'],
 ['Sabritas','SA','sabritas'],['Gamesa','GA','gamesa'],['Ricolino','RI'],['De la Rosa','DR'],['Nestlé','NE','nestle'],['Herdez','HE','herdez'],['La Costeña','LC'],['La Moderna','LM'],
 ['Lala','LA','lala'],['Alpura','AL'],['Danone','DA'],['Yakult','YA','yakult'],['Santa Clara','SC'],['FUD','FU'],['Zwan','ZW'],['Nutrioli','NU','nutrioli'],['Patrona','PA'],['Verde Valle','VV','verde-valle'],['Cloralex','CL'],['Zote','ZO']
];
export function SupplierBrandIcon({name}:{name:string}){
 const brand=supplierBrands.find(b=>normalize(b[0])===normalize(name));
 const src=brand?.[2]?Object.entries(logos).find(([path])=>path.replace(/^.*\//,'').replace(/\.[^.]+$/,'')===brand[2])?.[1]:undefined;
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
