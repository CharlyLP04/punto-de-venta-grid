import { ShoppingBasket,Package,Users,ChartNoAxesCombined,Settings,Lock,ChevronRight,Truck,Boxes,CalendarDays,Sparkles,ReceiptText,Wallet,SlidersHorizontal,ShieldCheck,HardDrive,History,Plug } from 'lucide-react';
import BrandMark from './BrandMark';
export type Page='CFDI'|'Multicaja'|'Pedidos'|'Caja'|'Inventario'|'Fiado'|'Movimientos'|'Historial'|'Ajustes'|'Usuarios'|'Surtido'|'Reportes'|'Bitácora'|'Personalizar'|'Servicios'|'Lotes'|'Promociones'|'Respaldos';
type Tab={page:Page;label:string;permissions:string[]};
const groups:{name:string;hint:string;icon:typeof Package;tabs:Tab[]}[]=[
  {name:'Caja',hint:'Vender y cobrar',icon:ShoppingBasket,tabs:[{page:'Caja',label:'Mostrador',permissions:['sales.create']}]},
  {name:'Productos',hint:'Catálogo y abastecimiento',icon:Package,tabs:[{page:'Inventario',label:'Inventario',permissions:['inventory.view']},{page:'Pedidos',label:'Pedidos',permissions:['purchases.create','inventory.manage']},{page:'Surtido',label:'Abastecimiento',permissions:['inventory.view']},{page:'Lotes',label:'Caducidades',permissions:['inventory.view']},{page:'Promociones',label:'Promociones',permissions:['promotions.manage']}]},
  {name:'Clientes',hint:'Fiado y abonos',icon:Users,tabs:[{page:'Fiado',label:'Libreta de clientes',permissions:['credit.use','credit.repay','customers.manage']}]},
  {name:'Ventas',hint:'Resultados y efectivo',icon:ChartNoAxesCombined,tabs:[{page:'CFDI',label:'CFDI · Pruebas',permissions:['settings.manage']},{page:'Historial',label:'Tickets y turno',permissions:['sales.create','reports.view']},{page:'Reportes',label:'Resultados',permissions:['reports.view']},{page:'Movimientos',label:'Efectivo',permissions:['cash.move']}]},
  {name:'Administración',hint:'Equipo y configuración',icon:Settings,tabs:[{page:'Personalizar',label:'Mi tienda',permissions:['settings.manage']},{page:'Usuarios',label:'Equipo y permisos',permissions:['users.manage']},{page:'Ajustes',label:'Dispositivos y sonido',permissions:['settings.manage']},{page:'Respaldos',label:'Respaldos',permissions:['backup.create']},{page:'Bitácora',label:'Bitácora',permissions:['audit.view']},{page:'Multicaja',label:'Multicaja',permissions:['settings.manage']},{page:'Servicios',label:'Conexiones · Beta',permissions:['settings.manage']}]},
];
import AudioControls from './AudioControls';
export function firstPage(can:(permission:string)=>boolean):Page{return groups.flatMap(group=>group.tabs).find(tab=>tab.permissions.some(can))?.page??'Ajustes';}
export function WorkspaceSidebar({page,onChange,can,name,onLock,soundEnabled=true,remote=false}:{page:Page;onChange:(page:Page)=>void;can:(permission:string)=>boolean;name:string;onLock:()=>void;soundEnabled?:boolean;remote?:boolean}){
  return <aside className="sidebar workspace-sidebar"><div className="workspace-brand"><BrandMark/><span>GRID<small>PUNTO DE VENTA</small></span></div><span className="nav-eyebrow">TU MOSTRADOR</span><nav aria-label="Áreas principales">{groups.map(group=>{
    const visible=group.tabs.filter(tab=>tab.permissions.some(can));if(!visible.length)return null;
    const active=group.tabs.some(tab=>tab.page===page);const Icon=group.icon;
    return <button key={group.name} className={active?'active':''} aria-current={active?'page':undefined} onClick={()=>onChange(visible[0].page)}><span className="nav-icon"><Icon size={21} aria-hidden="true"/></span><span className="nav-label">{group.name}<small>{group.hint}</small></span>{active&&<ChevronRight size={14}/>}</button>;
  })}</nav><div className="sidebar-local"><i/> {remote?'Datos en la caja principal':'Todo queda en esta PC'}<small>{remote?'Requiere conexión a la red local':'Lista para trabajar sin internet'}</small></div><div className="sidebar-volume-dock"><AudioControls enabled={soundEnabled}/></div><button className="sidebar-account" onClick={onLock}><span className="avatar">{name.slice(0,2).toUpperCase()}</span><span>{name}<small>Bloquear sesión</small></span><Lock size={16}/></button></aside>;
}
const tabIcons:Partial<Record<Page,typeof Package>>={Inventario:Package,Pedidos:Truck,Surtido:Boxes,Lotes:CalendarDays,Promociones:Sparkles,Historial:ReceiptText,Reportes:ChartNoAxesCombined,Movimientos:Wallet,Personalizar:SlidersHorizontal,Usuarios:ShieldCheck,Ajustes:Settings,Respaldos:HardDrive,Bitácora:History,Servicios:Plug};
export function WorkspaceHeader({page,onChange,can,counts={}}:{page:Page;onChange:(page:Page)=>void;can:(permission:string)=>boolean;counts?:Partial<Record<Page,number>>}){
  const group=groups.find(g=>g.tabs.some(t=>t.page===page));if(!group)return null;
  const tabs=group.tabs.filter(tab=>tab.permissions.some(can));
  return <div className={`workspace-heading ${page==='Caja'?'heading-cash':''}`}><div><span className="eyebrow">{group.hint}</span><h1>{group.name==='Caja'?'Vamos a vender':group.name}</h1></div>{tabs.length>1&&<nav className="workspace-tabs" aria-label={`Secciones de ${group.name}`}>{tabs.map(tab=>{const Icon=tabIcons[tab.page]??Package;return <button key={tab.page} className={page===tab.page?'active':''} aria-current={page===tab.page?'page':undefined} onClick={()=>onChange(tab.page)} data-section={tab.page}><Icon size={17} aria-hidden="true"/><span>{tab.label}</span>{(counts[tab.page]??0)>0&&<b className="section-count">{counts[tab.page]}</b>}</button>;})}</nav>}</div>;
}


