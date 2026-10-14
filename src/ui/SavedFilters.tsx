import { useState } from 'react';
import { useSession } from '../security/Session';
import { emptyFilters, type CatalogFilters } from './MasterFilters';

type View = { id: string; name: string; filters: CatalogFilters; search: string };
function valid(value: unknown): value is View {
  if (!value || typeof value !== 'object') return false;
  const v = value as View, f = v.filters;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.search === 'string'
    && !!f && Array.isArray(f.categories) && f.categories.every(c => typeof c === 'string')
    && Array.isArray(f.products) && f.products.every(Number.isSafeInteger)
    && ['all','available','empty','low'].includes(f.stock) && ['all','kg','pieza'].includes(f.unit)
    && typeof f.min === 'string' && typeof f.max === 'string' && typeof f.sort === 'string'
    && typeof f.favorites === 'boolean' && typeof f.frequent === 'boolean';
}
export default function SavedFilters({ value, search, onApply }: {
  value: CatalogFilters; search: string; onApply: (filters: CatalogFilters, search: string) => void;
}) {
  const { user } = useSession();
  const key = `mario:filter-views:v1:${user.id}`;
  const [views, setViews] = useState<View[]>(() => {
    try { const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(raw) ? raw.filter(valid).slice(0,20) : []; }
    catch { return []; }
  });
  const [name,setName] = useState('');
  const [message,setMessage] = useState('');
  function save(next: View[]) {
    try { localStorage.setItem(key,JSON.stringify(next)); setViews(next); setMessage('Vistas guardadas para tu usuario.'); }
    catch { setMessage('No se pudo guardar. Revisa el espacio disponible en esta computadora.'); }
  }
  return <details className="saved-filters"><summary>Mis vistas y accesos rápidos</summary>
    <div className="saved-filter-actions">
      <button type="button" onClick={()=>onApply({...emptyFilters(),stock:'low'},'')}>Por surtir</button>
      <button type="button" onClick={()=>onApply({...emptyFilters(),favorites:true},'')}>Favoritos</button>
      <button type="button" onClick={()=>onApply({...emptyFilters(),frequent:true,sort:'frequency'},'')}>Más vendidos</button>
    </div>
    <div className="saved-filter-editor"><label>Nombre de la vista<input maxLength={40} value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Bebidas por surtir…"/></label>
      <button type="button" disabled={!name.trim()||views.length>=20} onClick={()=>{save([...views,{id:crypto.randomUUID(),name:name.trim(),filters:value,search}]);setName('');}}>Guardar filtros actuales</button></div>
    {views.map(view=><div className="saved-filter-row" key={view.id}><button type="button" onClick={()=>onApply(view.filters,view.search)}>{view.name}</button><button type="button" aria-label={`Eliminar vista ${view.name}`} onClick={()=>save(views.filter(v=>v.id!==view.id))}>Eliminar</button></div>)}
    <p role="status">{message || `${views.length} de 20 vistas · disponibles al volver a entrar`}</p>
  </details>;
}
