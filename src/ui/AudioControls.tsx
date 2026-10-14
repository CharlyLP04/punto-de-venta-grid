import {useSyncExternalStore} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
let volume=0.65;
try{const stored=localStorage.getItem('mario_audio_volume');if(stored!==null&&Number.isFinite(Number(stored)))volume=Math.max(0,Math.min(1,Number(stored)));}catch{/* Local preference is optional. */}
const listeners=new Set<()=>void>();
export const soundVolume=()=>volume;
function setVolume(value:number){volume=Math.max(0,Math.min(1,value));try{localStorage.setItem('mario_audio_volume',String(volume));}catch{/* Keep the current volume in memory. */}listeners.forEach(listener=>listener());}
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export default function AudioControls({enabled}:{enabled:boolean}){
  const value=useSyncExternalStore(subscribe,soundVolume);
  const pct=Math.round(value*100);
  return <div className="audio-controls" title={`Volumen: ${pct}%`}>
    <button className="quick-mute" type="button" aria-label={value>0?'Silenciar en esta computadora':'Restaurar volumen'} aria-pressed={value===0} onClick={()=>setVolume(value>0?0:.65)}>
      {value>0&&enabled?<Volume2 size={16} aria-hidden="true"/>:<VolumeX size={16} aria-hidden="true"/>}
    </button>
    <label className="audio-slider-wrap">
      <span className="sr-only">Volumen en esta computadora</span>
      <input type="range" min="0" max="1" step="0.05" value={value} onChange={e=>setVolume(Number(e.target.value))}/>
    </label>
    <span className="audio-pct" aria-hidden="true">{pct}%</span>
    {!enabled&&<span className="sr-only">Los sonidos están desactivados en Ajustes.</span>}
  </div>;
}

