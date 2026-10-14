import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// UI tests use a simulated IPC bridge. Native transaction tests run separately in Rust.
async function login(page:Page,permissions:string[]|null=null,theme='light',mode='pc') {
  await page.addInitScript(({permissions,theme,mode})=>{
    const w=window as any;
    w.isTauri=true;w.auditCalls=[];
    let fiscalReady=false;
    let common:any[]=[];let lines:any[]=[];let next=1;
    const user={id:1,name:'Prueba',role:permissions===null?'owner':'custom',permissions:permissions??[]};
    w.__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{
      if(command==='connection_call'){command=args.command;args=args.args;}
      if(command==='connection_status')return {remote:false,name:'Caja principal'};
      w.auditCalls.push({command,args});
      if(command==='auth_status')return {setup:false,profiles:[{...user,username:'test'}]};
      if(command==='login')return {token:'test',user,idleMinutes:15};
      if(command==='backup_center')return {error:''};
      if(command==='catalog_preview')return {items:[{code:'IMPORT01',name:'Importado',category:'Abarrotes',unit:'pieza',price:2500,cost:null}],report:{created:1,updated:0,skipped:0,errors:new TextDecoder().decode(new Uint8Array(args.bytes)).includes('BAD')?[{row:2,message:'Código repetido en el archivo'}]:[]}};
      if(command==='catalog_apply')return {created:1,updated:0,skipped:0,errors:[]};
      if(command==='fiscal'){
        if(args.action==='list')return {ready:fiscalReady,sales:[{id:'sale-test',total:11600,created:'2026-10-13'}],documents:[]};
        if(args.action==='credentials'){fiscalReady=true;return {ready:true};}
        if(args.action==='sale')return {payment:'cash',total:11600,items:[{name:'Servicio',unit:'pieza',subtotal:11600}]};
        if(args.action==='draft')return {id:'draft-test',payload:{Receiver:args.input.receiver,Items:args.input.items}};
        if(args.action==='stamp')return {Id:'remote-test'};
      }

      if(command==='mutate'){
        const a=args.action;
        if(a.type==='common'){
          const id=-(next++);
          common=common.concat({id,name:a.name,price:a.price,cost:a.cost??0,cost_known:a.cost===null?0:1,unit:'pieza',category:'Productos comunes',icon:'auto',code:'',stock:0,physical_stock:0,minimum:0,target:0,wholesale_quantity:0,wholesale_price:0,promotion_price:null,common:1});
          lines=lines.concat({ticket:a.ticket,product:id,quantity:a.quantity,override_price:null,reason:null});
        }
        return {};
      }
      if(command==='snapshot')return {
        products:Array.from({length:1309},(_,i)=>({id:i+1,name:'Producto '+i,code:'TEST'+i,category:'Abarrotes',icon:'auto',price:2300,cost:1200,cost_known:1,unit:'pieza',stock:16000,physical_stock:16000,expired_stock:0,minimum:3000,target:12000,wholesale_quantity:0,wholesale_price:0,favorite:0,promotion_price:null})),
        common_products:common,lines,customers:[],sales:[],frequencies:[],aliases:[],repayments:[],movements:[],ledger:[],shift:[{id:1,created:new Date().toISOString(),user_id:1,cashier:'Prueba'}],cuts:[],settings:[{key:'store_name',value:'Tienda de prueba'},{key:'sound',value:'0'}],stats:[{today:0,tickets:0}],pending:[{count:0}],expiry_alerts:[{count:0}],
      };
      return [];
    }};
    localStorage.setItem('grid_kiosk_theme',theme);
    localStorage.setItem('grid_input_mode_v1',mode);
  },{permissions,theme,mode});
  await page.goto('/');
  await page.getByRole('button',{name:/Prueba/}).click();
  await page.locator('input[name=password]').fill('test-password');
  await page.getByRole('button',{name:'Entrar',exact:false}).click();
  await expect(page.getByRole('button',{name:/^Filtros/})).toBeVisible();
}

test('producto común: acceso con Ctrl+P, importe, guardado y aislamiento del catálogo',async({page})=>{
  await login(page);
  await page.keyboard.press('Control+p');
  const dialog=page.getByRole('dialog',{name:'Producto común'});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Descripción').fill('Dulces sueltos');
  await dialog.getByLabel('Cantidad',{exact:true}).fill('2.5');
  await dialog.getByLabel('Precio unitario ($)',{exact:true}).fill('12');
  await expect(dialog.getByRole('status')).toContainText('$30.00');
  await dialog.getByRole('button',{name:/Agregar al ticket/}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.ticket-lines')).toContainText('Dulces sueltos');
  await expect(page.locator('.total .number-ticker')).toHaveAttribute('aria-label','$30.00');
  expect(await page.evaluate(()=>(window as any).auditCalls.find((c:any)=>c.command==='mutate').args.action)).toEqual({type:'common',ticket:1,name:'Dulces sueltos',quantity:2500,price:1200,cost:null});
  await expect(page.locator('.product-grid')).not.toContainText('Dulces sueltos');
});

test('el permiso restringe botón y atajo de producto común',async({page})=>{
  await login(page,['sales.create','shifts.open','shifts.close']);
  await expect(page.getByRole('button',{name:'Producto común',exact:true})).toHaveCount(0);
  await page.keyboard.press('Control+p');
  await expect(page.getByRole('dialog',{name:'Producto común'})).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('No tienes permiso');
});

test('filtros paginados y desmontados al cerrar',async({page})=>{
  await login(page);
  await expect(page.locator('.master-options input')).toHaveCount(0);
  await page.getByRole('button',{name:/^Filtros/}).click();
  await expect(page.locator('.master-options input')).toHaveCount(40);
  await page.locator('.master-options input').first().check();
  await page.getByRole('navigation',{name:'Páginas de productos para filtrar'}).getByRole('button',{name:'Siguiente'}).click();
  await expect(page.locator('.master-options input')).toHaveCount(40);
  await page.keyboard.press('Escape');
  await expect(page.locator('.master-options input')).toHaveCount(0);
  await page.getByRole('button',{name:/^Filtros/}).click();
  await page.getByRole('navigation',{name:'Páginas de productos para filtrar'}).getByRole('button',{name:'Anterior'}).click();
  await expect(page.locator('.master-options input').first()).toBeChecked();
});

for(const theme of ['light','dark'])for(const mode of ['pc','touch']) {
  test(`Caja legible a 1050x720: ${theme}, ${mode}`,async({page},testInfo)=>{
    await login(page,null,theme,mode);
    await page.waitForTimeout(600);
    await page.screenshot({path:testInfo.outputPath('caja.png')});
    const bounds=await page.locator('.product-card').first().evaluate(e=>({card:e.getBoundingClientRect().bottom,area:e.parentElement!.getBoundingClientRect().bottom}));
    expect(bounds.card).toBeLessThanOrEqual(bounds.area);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1050);
    await expect(page.getByText('DEMO',{exact:true})).toHaveCount(0);
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,reason:n.failureSummary}))}))).toEqual([]);
  });
}


test('importación: vista previa y confirmación antes de guardar',async({page})=>{
 await login(page);
 await page.getByRole('navigation',{name:'Áreas principales'}).getByRole('button',{name:'Productos',exact:true}).click();
 await page.getByText('Importar productos desde Excel o CSV',{exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'prueba.csv',mimeType:'text/csv',buffer:Buffer.from('OK')});
 await expect(page.getByText('1 nuevos · 0 actualizados · 0 sin cambios')).toBeVisible();
 expect(await page.evaluate(()=>(window as any).auditCalls.filter((c:any)=>c.command==='catalog_apply').length)).toBe(0);
 await page.getByRole('button',{name:'Confirmar importación de 1 productos'}).click();
 await expect(page.getByRole('status').filter({hasText:'Listo: 1 nuevos'})).toBeVisible();
});
test('importación: errores bloquean la confirmación',async({page})=>{
 await login(page);
 await page.getByRole('navigation',{name:'Áreas principales'}).getByRole('button',{name:'Productos',exact:true}).click();
 await page.getByText('Importar productos desde Excel o CSV',{exact:true}).click();
 await page.locator('input[type=file]').setInputFiles({name:'prueba.csv',mimeType:'text/csv',buffer:Buffer.from('BAD')});
 await expect(page.getByText('Fila 2: Código repetido en el archivo')).toBeVisible();
 await expect(page.getByRole('button',{name:/Confirmar importación/})).toHaveCount(0);
});
test('CFDI: revisión y credenciales de prueba antes del envío',async({page})=>{
 await login(page);
 await page.getByRole('navigation',{name:'Áreas principales'}).getByRole('button',{name:'Ventas',exact:true}).click();
 await page.locator('button[data-section="CFDI"]').click();
 await page.getByLabel('Venta pagada').selectOption('sale-test');
 await page.getByLabel('RFC del receptor').fill('URE180429TM6');
 await page.getByLabel('Razón social exacta').fill('UNIVERSIDAD ROBOTICA ESPAÑOLA');
 await page.getByLabel('Régimen fiscal (clave)').fill('601');
 await page.getByLabel('Código postal fiscal').fill('86991');
 await page.getByLabel('Uso CFDI (clave)').fill('G03');
 await page.getByLabel('Código postal de expedición').fill('78000');
 await page.getByLabel('Clave SAT de producto (8 dígitos)').fill('01010101');
 await page.getByLabel('Impuesto incluido en precio').selectOption('iva16');
 await page.getByRole('button',{name:'Revisar factura',exact:true}).click();
 const send=page.getByRole('button',{name:'Enviar a Facturama · solo pruebas'});
 await expect(send).toBeDisabled();
 await page.getByLabel('Usuario API de pruebas').fill('test-api');
 await page.getByLabel('Contraseña API de pruebas').fill('test-secret');
 await page.getByRole('button',{name:'Conectar pruebas'}).click();
 await expect(send).toBeEnabled();
 await send.click();
 await expect(page.getByRole('status').filter({hasText:'Facturama confirmó el comprobante de prueba.'})).toBeVisible();
});

test('pantalla de acceso limpia: monograma de iniciales, sin elementos arcade y multicaja no invasiva',async({page})=>{
 await page.addInitScript(()=>{
  const w=window as any;
  w.isTauri=true;
  w.__TAURI_INTERNALS__={invoke:async(command:string,args:any)=>{
   if(command==='connection_call'){command=args.command;args=args.args;}
   if(command==='connection_status')return {remote:false,name:'Caja principal'};
   if(command==='auth_status')return {setup:false,profiles:[{id:1,username:'charly',name:'Charlydev',role:'owner',permissions:[]}]};
   return [];
  }};
 });
 await page.goto('/');
 const choice=page.getByRole('button',{name:/Charlydev/});
 await expect(choice).toBeVisible();
 await expect(choice.locator('.profile-monogram')).toHaveText('CH');
 await expect(page.getByRole('button',{name:'Entrar',exact:false})).toBeVisible();
 const multicaja=page.locator('.kiosk-network-wrapper .network-settings');
 await expect(multicaja).toBeVisible();
 await expect(multicaja).not.toHaveAttribute('open');
});
