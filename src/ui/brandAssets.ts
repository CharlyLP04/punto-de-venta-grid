const logos=import.meta.glob('../assets/supplier-brands/*.{svg,png,gif,webp}',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const supplierBrands=[
 ['Bimbo','BI','bimbo'],['Grupo Bimbo','GB','grupo-bimbo'],['Marinela','MA','marinela'],['Tía Rosa','TR'],['Wonder','WO'],['Barcel','BA','barcel'],
 ['Coca-Cola','CC','coca-cola'],['Pepsi','PE','pepsi'],['Jarritos','JA'],['Peñafiel','PÑ'],['Jumex','JU'],['Boing','BO','boing'],['Bonafont','BF'],['Ciel','CI'],['Epura','EP'],
 ['Sabritas','SA','sabritas'],['Gamesa','GA','gamesa'],['Ricolino','RI'],['De la Rosa','DR'],['Nestlé','NE','nestle'],['Herdez','HE','herdez'],['La Costeña','LC'],['La Moderna','LM'],
 ['Lala','LA','lala'],['Alpura','AL'],['Danone','DA'],['Yakult','YA','yakult'],['Santa Clara','SC'],['FUD','FU'],['Zwan','ZW'],['Nutrioli','NU','nutrioli'],['Patrona','PA'],['Verde Valle','VV','verde-valle'],['Cloralex','CL'],['Zote','ZO']
];

const logoByKey=new Map(Object.entries(logos).map(([path,url])=>[path.replace(/^.*\//,'').replace(/\.[^.]+$/,''),url]));
export function brandLogo(name:string){
 const brand=supplierBrands.find(b=>normalize(b[0])===normalize(name));
 return brand?.[2]?logoByKey.get(brand[2]):undefined;
}
/** Match whole brand names, never category or manufacturer guesses. */
export function productBrandName(name:string){
 const words=` ${normalize(name)} `;
 return [...supplierBrands].sort((a,b)=>b[0].length-a[0].length).find(b=>words.includes(` ${normalize(b[0])} `))?.[0];
}
