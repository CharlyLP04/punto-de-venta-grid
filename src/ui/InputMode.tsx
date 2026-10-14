import {createContext,useContext,useLayoutEffect,useState,type ReactNode} from 'react';
import {Monitor,Hand} from 'lucide-react';

type Mode='pc'|'touch';
const key='grid_input_mode_v1';
const Context=createContext<{mode:Mode;setMode:(mode:Mode)=>void}|null>(null);
function read():Mode{
  try{const value=localStorage.getItem(key);if(value==='pc'||value==='touch')return value;}catch{/* Keep access available when storage is unavailable. */}
  return 'pc';
}
export function InputModeProvider({children}:{children:ReactNode}){
  const [mode,update]=useState<Mode>(read);
  useLayoutEffect(()=>{document.documentElement.dataset.inputMode=mode;},[mode]);
  function setMode(value:Mode){update(value);try{localStorage.setItem(key,value);}catch{/* The current session still uses the selected mode. */}}
  return <Context.Provider value={{mode,setMode}}>{children}</Context.Provider>;
}
export function useInputMode(){const value=useContext(Context);if(!value)throw new Error('Modo de interacción no disponible');return value;}
export function pcMode(){return document.documentElement.dataset.inputMode!=='touch';}
export default function InputModePicker({compact=false,disabled=false}:{compact?:boolean;disabled?:boolean}){
  const {mode,setMode}=useInputMode();
  return <fieldset className={`input-mode-picker ${compact?'compact':''}`} disabled={disabled}>
    <legend>{compact?'Controles':'¿Cómo vas a usar esta caja?'}</legend>
    <div>{(['pc','touch'] as const).map(value=>{const Icon=value==='pc'?Monitor:Hand;return <label key={value} className={mode===value?'selected':''}>
      <input type="radio" name={compact?'input-mode-settings':'input-mode-login'} value={value} checked={mode===value} onChange={()=>setMode(value)}/>
      <Icon size={22} aria-hidden="true"/><span>{value==='pc'?'Modo PC':'Modo táctil'}{!compact&&<small>{value==='pc'?'Mouse, teclado y lector':'Botones grandes para tocar'}</small>}</span>
    </label>;})}</div>
    {!compact&&<p>Se recuerda en esta computadora. Puedes cambiarlo en Administración → Dispositivos y sonido.</p>}
  </fieldset>;
}
