import {invoke} from '../api';
export function openWhatsApp(phone:string,message:string){let normalized=phone.replace(/[^0-9]/g,'');if(normalized.length===10)normalized=`52${normalized}`;if(!/^[1-9][0-9]{10,14}$/.test(normalized))return Promise.reject(new Error('Revisa el teléfono del contacto e incluye la lada del país.'));return invoke('open_whatsapp',{phone:normalized,message});}
