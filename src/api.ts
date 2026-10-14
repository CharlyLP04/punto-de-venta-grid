import { invoke as nativeInvoke } from '@tauri-apps/api/core';
const sharedCommands=new Set(['auth_status','login','logout','snapshot','mutate','checkout','operate','approve_operation','users_list','user_save','advanced_save','advanced_list','filtered_report','sale_history','procurement_list','procurement_save','management','catalog_preview','catalog_apply','catalog_export','fiscal']);
export async function transport<T=unknown>(command:string,args:Record<string,unknown>={}):Promise<T>{
 if(sharedCommands.has(command))return nativeInvoke<T>('connection_call',{command,args});
 const connection=await nativeInvoke<{remote:boolean}>('connection_status');
 if(connection?.remote&&!['connection_status','connection_save'].includes(command))throw new Error('Esta operación se realiza en la caja principal.');
 return nativeInvoke<T>(command,args);
}
let token: string | null = null;
export const setSessionToken = (value: string | null) => { token = value; };
export const getSessionToken = () => token;
export async function invoke<T = unknown>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const request = command === 'mutate' ? { requestId: crypto.randomUUID(), ...args } : args;
  try {
    const sessionToken=token;
    if(command==='operate'){
      const {approval,...operationArgs}=request;
      const approvalToken=approval?await transport<string>('approve_operation',{sessionToken,requestId:request.requestId,operation:request.operation,approval}):null;
      if(sessionToken!==token)throw new Error('SESSION_EXPIRED');
      return await transport<T>(command,{...operationArgs,approvalToken,sessionToken});
    }
    return await transport<T>(command, { ...request, sessionToken });
  }
  catch (error) {
    if (String(error).includes('SESSION_EXPIRED')) window.dispatchEvent(new Event('mario-session-expired'));
    throw error;
  }
}
