import { createContext,useCallback,useContext,useLayoutEffect,useState,type ReactNode } from 'react';
import { Moon,Sun } from 'lucide-react';
type Theme='light'|'dark';
const Context=createContext<{theme:Theme;toggle:()=>void;identify:(id:number|null)=>void}|null>(null);
function read(key:string):Theme {try{const value=localStorage.getItem(key)??localStorage.getItem('grid_kiosk_theme');if(value==='dark'||value==='light')return value;}catch{/* A theme preference must never prevent login. */}return 'dark';}
export function ThemeProvider({children}:{children:ReactNode}){
  const [key,setKey]=useState('grid_kiosk_theme');const [theme,setTheme]=useState<Theme>(()=>read('grid_kiosk_theme'));
  useLayoutEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#17191e':'#f3f7f0');},[theme]);
  const identify=useCallback((id:number|null)=>{const next=id===null?'grid_kiosk_theme':`grid_theme_user_${id}`;setKey(next);setTheme(read(next));},[]);
  function toggle(){const next=theme==='light'?'dark':'light';setTheme(next);try{localStorage.setItem(key,next);}catch{/* Use the in-memory preference when storage is unavailable. */}}
  return <Context.Provider value={{theme,toggle,identify}}>{children}</Context.Provider>;
}
export function useTheme(){const value=useContext(Context);if(!value)throw new Error('Tema no disponible');return value;}
export default function ThemeToggle(){const {theme,toggle}=useTheme();return <button type="button" className="theme-toggle" role="switch" aria-checked={theme==='dark'} aria-label={theme==='dark'?'Modo oscuro activo':'Modo claro activo'} title={theme==='dark'?'Cambiar a modo claro':'Cambiar a modo oscuro'} onClick={toggle}><span className="theme-track-icon theme-track-sun" aria-hidden="true"><Sun size={14}/></span><span className="theme-track-icon theme-track-moon" aria-hidden="true"><Moon size={14}/></span><span className="theme-thumb" aria-hidden="true">{theme==='dark'?<Moon size={14}/>:<Sun size={14}/>}</span></button>;}
