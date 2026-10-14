import NetworkConnection from '../ui/NetworkConnection';
import { createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode,type FormEvent } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { ArrowRight,Lock,ShieldCheck,UserRound,Store,Keyboard,Eye,EyeOff,Crown,Star,Flower2,Package } from 'lucide-react';
import { invoke,setSessionToken,transport as nativeInvoke } from '../api';
import InputModePicker,{pcMode,useInputMode} from '../ui/InputMode';
import BrandMark from '../ui/BrandMark';
import ArcadeButton from '../ui/ArcadeButton';
import ThemeToggle,{useTheme} from '../ui/Theme';
export type User={id:number;name:string;role:string;permissions:string[]};
type Profile={id:number;username:string;name:string;role:string};
type Session={user:User;can:(permission:string)=>boolean;lock:()=>void};
const Context=createContext<Session|null>(null);
export function useSession(){const session=useContext(Context);if(!session)throw new Error('Sesión requerida');return session;}
const roles:Record<string,string>={owner:'Propietario',manager:'Encargado',cashier:'Cajero',stock:'Inventario',custom:'Acceso personalizado'};
export default function SessionProvider({children}:{children:ReactNode}){
  const {identify}=useTheme();
  const {mode}=useInputMode();
  const [session,setSession]=useState<{token:string;user:User;idleMinutes:number}|null>(null);
  const [setup,setSetup]=useState<boolean>();const [profiles,setProfiles]=useState<Profile[]>([]);const [selected,setSelected]=useState<Profile|null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [visible,setVisible]=useState(false);const [failures,setFailures]=useState(0);
  const lastActivity=useRef(Date.now());const passwordInput=useRef<HTMLInputElement>(null);const flight=useRef(false);
  const lock=useCallback(()=>{void invoke('logout').catch(()=>{});setSessionToken(null);setSession(null);setSelected(null);setError('');setVisible(false);},[]);
  useEffect(()=>{identify(session?.user.id??null);},[session?.user.id,identify]);
  useEffect(()=>{
    if(session)return;
    if(!isTauri()){setError('Abre la aplicación nativa para iniciar sesión.');return;}
    let live=true;
    nativeInvoke<{setup:boolean;profiles:Profile[]}>('auth_status').then(result=>{if(live){setSetup(result.setup);setProfiles(result.profiles);try{const saved=Number(localStorage.getItem('grid_last_profile')??localStorage.getItem('mario_last_profile'));const previous=result.profiles.find(p=>p.id===saved)??(result.profiles.length===1?result.profiles[0]:undefined);if(previous)setSelected(previous);}catch{/* Profile recall is optional. */}}}).catch(e=>{if(live)setError(String(e));});
    return()=>{live=false;};
  },[session?.token]);
  useEffect(()=>{
    window.addEventListener('grid-session-expired',lock);
    window.addEventListener('mario-session-expired',lock);
    const policy=(event:Event)=>{const minutes=Number((event as CustomEvent).detail);if(minutes>=1&&minutes<=120)setSession(current=>current&&current.idleMinutes!==minutes?{...current,idleMinutes:minutes}:current);};
    window.addEventListener('grid-idle-policy',policy);
    window.addEventListener('mario-idle-policy',policy);
    return()=>{window.removeEventListener('grid-session-expired',lock);window.removeEventListener('mario-session-expired',lock);window.removeEventListener('grid-idle-policy',policy);window.removeEventListener('mario-idle-policy',policy);};
  },[lock]);
  useEffect(()=>{
    if(!session)return;
    const activity=()=>{lastActivity.current=Date.now();};activity();
    window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity);
    const interval=window.setInterval(()=>{if(Date.now()-lastActivity.current>=session.idleMinutes*60000)lock();},1000);
    const resume=()=>{if(document.visibilityState==='visible'&&Date.now()-lastActivity.current>=session.idleMinutes*60000)lock();};
    document.addEventListener('visibilitychange',resume);
    return()=>{clearInterval(interval);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);document.removeEventListener('visibilitychange',resume);};
  },[session?.token,session?.idleMinutes,lock]);
  useEffect(()=>{if(selected&&mode==='pc')passwordInput.current?.focus();},[selected?.id,mode]);
  function choose(profile:Profile|null){setSelected(profile);setError('');setVisible(false);if(passwordInput.current)passwordInput.current.value='';if(profile&&pcMode())passwordInput.current?.focus();}
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(flight.current)return;flight.current=true;setBusy(true);setError('');const form=event.currentTarget;const values=new FormData(form);
    const username=selected?.username??String(values.get('username')??'');const password=String(values.get('password')??'');
    try{
      if(setup){if(password!==values.get('confirm'))throw new Error('Las contraseñas no coinciden');await nativeInvoke('bootstrap_owner',{username,password,name:String(values.get('name')??'')});setSetup(false);}
      const result=await nativeInvoke<{token:string;user:User;idleMinutes:number}>('login',{username,password});
      try{localStorage.setItem('grid_last_profile',String(result.user.id));}catch{/* No password is stored. */}
      form.reset();setSessionToken(result.token);setSession(result);
    }catch(e){setError(String(e));setFailures(n=>n+1);passwordInput.current?.select();}finally{flight.current=false;setBusy(false);}
  }
  const sessionValue=useMemo<Session|null>(()=>session?{user:session.user,can:permission=>session.user.role==='owner'||session.user.permissions.includes(permission),lock}:null,[session?.user,lock]);
  if(session&&sessionValue)return <Context.Provider value={sessionValue}><div key={session.token}>{children}</div></Context.Provider>;
  return <main className="kiosk-console quick-login store-login" onKeyDown={e=>{if(e.key==='Escape'&&!busy)choose(null);}}>
    <header className="kiosk-top"><div className="kiosk-wordmark"><BrandMark/><span>GRID <b>POS</b><small>Tu punto de venta</small></span></div><div className="kiosk-status"><span><i/> Trabajo sin internet</span><ThemeToggle/></div></header>
    <div className="kiosk-body"><div className="login-heading"><span className="login-character" aria-hidden="true"><Store/></span><div><h1>{setup?'Prepara tu tienda':'Todo listo para vender'}</h1><p>{setup?'Crea la cuenta del propietario.':'Elige tu nombre para entrar.'}</p></div></div>
    <section className={`kiosk-access login-console ${setup?'login-setup':''}`} aria-label="Acceso al mostrador"><details className="login-options"><summary>{mode==='touch'?'Modo táctil':'Modo PC'} · Cambiar</summary><InputModePicker compact disabled={busy}/></details>{!setup&&<div className="profile-picker"><div className="section-head"><div><span className="eyebrow">Tu equipo</span><h2>Equipo</h2></div><UserRound size={22}/></div><div className="profile-grid" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;const items=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'));const i=items.indexOf(document.activeElement as HTMLButtonElement);if(i<0)return;e.preventDefault();items[(i+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();}}>{profiles.map(profile=><button type="button" key={profile.id} disabled={busy} aria-pressed={selected?.id===profile.id} className={`profile-choice ${selected?.id===profile.id?'selected':''}`} onClick={()=>choose(profile)}><span className={`profile-monogram role-${profile.role}`} aria-hidden="true">{profile.role==='owner'?<Crown/>:profile.role==='manager'?<Flower2/>:profile.role==='stock'?<Package/>:<Star/>}</span><span>{profile.name}<small>{roles[profile.role]??'Personalizado'}</small></span><ArrowRight size={16}/></button>)}<button type="button" className={`profile-choice other-profile ${selected===null?'selected':''}`} disabled={busy} onClick={()=>choose(null)}><span className="profile-monogram other-monogram" aria-hidden="true"><UserRound size={20}/></span><span>Otro usuario<small>Escribir mi acceso</small></span><ArrowRight size={16}/></button></div></div>}
    <form className="kiosk-unlock" onSubmit={submit}><div className="unlock-heading"><span className="lock-medallion"><Lock size={20}/></span><div><span className="eyebrow">{setup?'CONFIGURA TU TIENDA':'Tu acceso'}</span><h2>{setup?'Empieza como propietario':selected?selected.name:'Iniciar sesión'}</h2>{selected&&!setup&&<p className="selected-profile-note">{roles[selected.role]??'Acceso personalizado'} · Escribe tu contraseña</p>}</div></div>
      {error&&<div key={failures} className="alert error micro-shake" role="alert">{error}</div>}
      {setup&&<label className="field"><span>Nombre del propietario</span><input name="name" required maxLength={100} autoComplete="name"/></label>}
      {(!selected||setup)&&<label className="field"><span>Usuario</span><input name="username" spellCheck={false} autoCapitalize="none" minLength={3} maxLength={40} pattern="[a-zA-Z0-9_-]+" required autoComplete="username"/></label>}
      <label className="field"><span>Contraseña</span><span className="password-control"><input ref={passwordInput} name="password" type={visible?'text':'password'} minLength={8} maxLength={128} required autoComplete={setup?'new-password':'current-password'}/><button type="button" aria-label={visible?'Ocultar contraseña':'Mostrar contraseña'} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
      {setup&&<label className="field"><span>Repite la contraseña</span><input name="confirm" type="password" minLength={8} required autoComplete="new-password"/></label>}
      <ArcadeButton type="submit" shortcut="Enter" disabled={busy||setup===undefined}>{busy?'Verificando…':setup?'Crear mi tienda':'Entrar'}<ArrowRight size={18}/></ArcadeButton><p className="unlock-note">{setup?'Después podrás crear tu equipo y sus permisos. No hay contraseña predeterminada.':'Enter para entrar. Esc para cambiar de usuario.'}</p>
    </form></section></div><NetworkConnection/><footer className="kiosk-footer"><span>{mode==='touch'?'Toca tu perfil y escribe tu contraseña':<><Keyboard size={15} aria-hidden="true"/> Tab · Navegar <b>↵</b> Entrar <b>Esc</b> Cambiar perfil</>}</span><span className="grid-signature">GRID MX <b>·</b> Hecho para tu negocio</span></footer>
  </main>;
}
