import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,ShieldAlert,X} from 'lucide-react';
function Toast({message,error=false,onClose}:{message:string;error?:boolean;onClose:()=>void}){
 const [paused,setPaused]=useState(false);const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{if(error||paused)return;const timer=window.setTimeout(()=>close.current(),4000);return()=>clearTimeout(timer);},[message,error,paused]);
 const technical=/ambiguous column|SQLITE|SELECT |database is locked|no such column/i.test(message);
 return <article className={`floating-toast ${error?'toast-error':'toast-success'}`} role={error?'alert':'status'} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false);}}>{error?<ShieldAlert aria-hidden="true"/>:<CheckCircle2 aria-hidden="true"/>}<div><strong>{error?'No se pudo completar':'Listo'}</strong><p>{technical?'Hubo un problema al consultar los datos. Intenta de nuevo. Si continúa, comparte el detalle con soporte.':message}</p>{technical&&<details><summary>Detalle para soporte</summary><p>{message}</p></details>}</div><button type="button" aria-label="Cerrar aviso" onClick={onClose}><X size={17}/></button>{!error&&<span className="toast-timer" style={{animationPlayState:paused?'paused':'running'}} aria-hidden="true"/>}</article>;
}
export default function ToastMessages({error='',notice='',clearError,clearNotice}:{error?:string;notice?:string;clearError:()=>void;clearNotice:()=>void}){return <div className="toast-stack" role="region" aria-label="Avisos">{error&&<Toast message={error} error onClose={clearError}/>} {notice&&<Toast message={notice} onClose={clearNotice}/>}</div>;}
