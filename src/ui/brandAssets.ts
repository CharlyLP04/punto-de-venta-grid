const logos = import.meta.glob('../assets/supplier-brands/*.{svg,png,gif,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const supplierBrands = [
  ['Bimbo', 'BI', 'bimbo'],
  ['Grupo Bimbo', 'GB', 'grupo-bimbo'],
  ['Marinela', 'MA', 'marinela'],
  ['Tía Rosa', 'TR', 'tia-rosa'],
  ['Wonder', 'WO'],
  ['Barcel', 'BA', 'barcel'],
  ['Coca-Cola', 'CC', 'coca-cola'],
  ['Pepsi', 'PE', 'pepsi'],
  ['Jarritos', 'JA', 'jarritos'],
  ['Peñafiel', 'PÑ', 'penafiel'],
  ['Jumex', 'JU', 'jumex'],
  ['Boing', 'BO', 'boing'],
  ['Bonafont', 'BF', 'bonafont'],
  ['Ciel', 'CI', 'ciel'],
  ['Epura', 'EP'],
  ['Sabritas', 'SA', 'sabritas'],
  ['Gamesa', 'GA', 'gamesa'],
  ['Ricolino', 'RI', 'ricolino'],
  ['De la Rosa', 'DR', 'de-la-rosa'],
  ['Nestlé', 'NE', 'nestle'],
  ['Herdez', 'HE', 'herdez'],
  ['La Costeña', 'LC', 'la-costena'],
  ['La Moderna', 'LM', 'la-moderna'],
  ['Lala', 'LA', 'lala'],
  ['Alpura', 'AL', 'alpura'],
  ['Danone', 'DA'],
  ['Yakult', 'YA', 'yakult'],
  ['Santa Clara', 'SC'],
  ['FUD', 'FU', 'fud'],
  ['Zwan', 'ZW'],
  ['Nutrioli', 'NU', 'nutrioli'],
  ['Patrona', 'PA'],
  ['Verde Valle', 'VV', 'verde-valle'],
  ['Cloralex', 'CL', 'cloralex'],
  ['Zote', 'ZO', 'zote'],
  ['AriZona', 'AZ', 'arizona']
];

const logoByKey = new Map(Object.entries(logos).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.[^.]+$/, ''), url]));
const brandByName = new Map(supplierBrands.map(brand => [normalize(brand[0]), brand]));
const brandMatchers = [...supplierBrands].sort((a, b) => b[0].length - a[0].length)
  .map(brand => ({ name: brand[0], needle: ` ${normalize(brand[0])} ` }));

const subBrandMappings: [string, string][] = [
  // Barcel
  ['chips', 'Barcel'],
  ['takis', 'Barcel'],
  ['runners', 'Barcel'],
  ['kiyakis', 'Barcel'],
  ['toreadas', 'Barcel'],
  ['hot nuts', 'Barcel'],
  ['big mix', 'Barcel'],
  ['golden nuts', 'Barcel'],
  ['chicharron', 'Barcel'],
  ['chicharrones', 'Barcel'],
  ['karameladas', 'Barcel'],
  ['churritos barcel', 'Barcel'],

  // Sabritas
  ['doritos', 'Sabritas'],
  ['cheetos', 'Sabritas'],
  ['ruffles', 'Sabritas'],
  ['fritos', 'Sabritas'],
  ['tostitos', 'Sabritas'],
  ['crujitos', 'Sabritas'],
  ['poffets', 'Sabritas'],
  ['rancheritos', 'Sabritas'],
  ['sabritones', 'Sabritas'],
  ['sunbites', 'Sabritas'],
  ['paketaxo', 'Sabritas'],
  ['churrumais', 'Sabritas'],

  // Marinela
  ['gansito', 'Marinela'],
  ['pinguinos', 'Marinela'],
  ['choco roles', 'Marinela'],
  ['chocoroles', 'Marinela'],
  ['submarinos', 'Marinela'],
  ['barritas', 'Marinela'],
  ['principe', 'Marinela'],
  ['suavicremas', 'Marinela'],
  ['triki trakes', 'Marinela'],
  ['trikitrakes', 'Marinela'],
  ['polvorones marinela', 'Marinela'],

  // Gamesa
  ['emperador', 'Gamesa'],
  ['chokis', 'Gamesa'],
  ['mamut', 'Gamesa'],
  ['marias', 'Gamesa'],
  ['arcoiris', 'Gamesa'],
  ['cremax', 'Gamesa'],
  ['saladitas', 'Gamesa'],
  ['habaneras', 'Gamesa'],
  ['florentinas', 'Gamesa'],
  ['crackets', 'Gamesa'],
  ['piruetas', 'Gamesa'],

  // Bimbo
  ['pan blanco', 'Bimbo'],
  ['pan integral', 'Bimbo'],
  ['pan tostado', 'Bimbo'],
  ['medias noches', 'Bimbo'],
  ['colchones', 'Bimbo'],
  ['mantechadas', 'Bimbo'],
  ['mantechox', 'Bimbo'],
  ['madalenas', 'Bimbo'],
  ['panque', 'Bimbo'],
  ['negrito', 'Bimbo'],
  ['nito', 'Bimbo'],
  ['bimbollos', 'Bimbo'],

  // Coca-Cola
  ['coca cola', 'Coca-Cola'],
  ['coca-cola', 'Coca-Cola'],
  ['fanta', 'Coca-Cola'],
  ['sprite', 'Coca-Cola'],
  ['sidral mundet', 'Coca-Cola'],
  ['mundet', 'Coca-Cola'],
  ['del valle', 'Coca-Cola'],
  ['valle frut', 'Coca-Cola'],
  ['powerade', 'Coca-Cola'],
  ['fuze tea', 'Coca-Cola'],
  ['fresca', 'Coca-Cola'],

  // Pepsi
  ['pepsi', 'Pepsi'],
  ['7up', 'Pepsi'],
  ['7 up', 'Pepsi'],
  ['mirinda', 'Pepsi'],
  ['squirt', 'Pepsi'],
  ['manzanita sol', 'Pepsi'],
  ['epura', 'Pepsi'],
  ['gatorade', 'Pepsi'],
  ['lipton', 'Pepsi'],

  // AriZona
  ['arizona', 'AriZona'],

  // Boing
  ['boing', 'Boing'],
  ['pascual', 'Boing'],
  ['pato pascual', 'Boing'],

  // Lala
  ['lala', 'Lala'],
  ['nutrileche', 'Lala'],
  ['yomi', 'Lala'],

  // Alpura
  ['alpura', 'Alpura'],
  ['vaquitas', 'Alpura'],

  // Peñafiel
  ['penafiel', 'Peñafiel'],

  // Jumex
  ['jumex', 'Jumex'],
  ['pau pau', 'Jumex'],
  ['ami', 'Jumex'],

  // Herdez
  ['herdez', 'Herdez'],
  ['del fuerte', 'Herdez'],
  ['dona maria', 'Herdez'],

  // La Costeña
  ['la costena', 'La Costeña'],
  ['totis', 'La Costeña'],

  // La Moderna
  ['la moderna', 'La Moderna'],
  ['yemina', 'La Moderna'],

  // Nestlé
  ['nestle', 'Nestlé'],
  ['nido', 'Nestlé'],
  ['carnation', 'Nestlé'],
  ['nescafe', 'Nestlé'],
  ['carlos v', 'Nestlé'],
  ['abuelita', 'Nestlé'],
  ['media crema', 'Nestlé'],

  // Ricolino
  ['ricolino', 'Ricolino'],
  ['paleta payaso', 'Ricolino'],
  ['bubulubu', 'Ricolino'],
  ['kranky', 'Ricolino'],
  ['panditas', 'Ricolino'],
  ['bocadin', 'Ricolino'],
  ['duvalin', 'Ricolino'],
  ['chocoretas', 'Ricolino'],

  // De la Rosa
  ['de la rosa', 'De la Rosa'],
  ['mazapan', 'De la Rosa'],
  ['pulparindo', 'De la Rosa'],

  // Tía Rosa
  ['tia rosa', 'Tía Rosa'],
  ['tortillinas', 'Tía Rosa'],

  // Bonafont
  ['bonafont', 'Bonafont'],
  ['levite', 'Bonafont'],

  // Ciel
  ['ciel', 'Ciel'],

  // Jarritos
  ['jarritos', 'Jarritos'],

  // Zote
  ['zote', 'Zote'],
  ['jabon roma', 'Zote'],
  ['foca', 'Zote'],
  ['blanca nieves', 'Zote'],

  // Cloralex
  ['cloralex', 'Cloralex'],
  ['pinol', 'Cloralex'],

  // FUD
  ['fud', 'FUD'],
  ['chimex', 'FUD'],
  ['san rafael', 'FUD'],

  // Nutrioli
  ['nutrioli', 'Nutrioli'],

  // Verde Valle
  ['verde valle', 'Verde Valle'],

  // Yakult
  ['yakult', 'Yakult']
];

export function brandLogo(name: string) {
  const brand = brandByName.get(normalize(name));
  return brand?.[2] ? logoByKey.get(brand[2]) : undefined;
}

/** Detect brand matching both category and product name, including Mexican abarrotes sub-brands. */
export function productBrandName(name: string, category?: string) {
  // 1. Direct category match
  if (category) {
    const catNorm = normalize(category);
    const directCat = brandByName.get(catNorm);
    if (directCat) return directCat[0];
    const catWords = ` ${catNorm} `;
    const matchCat = brandMatchers.find(b => catWords.includes(b.needle));
    if (matchCat) return matchCat.name;
    for (const [sub, brand] of subBrandMappings) {
      if (catWords.includes(` ${sub} `)) return brand;
    }
  }

  // 2. Direct product name match
  const nameNorm = normalize(name);
  const nameWords = ` ${nameNorm} `;
  const matchName = brandMatchers.find(b => nameWords.includes(b.needle));
  if (matchName) return matchName.name;

  // 3. Sub-brand match (e.g. Chips -> Barcel, Doritos -> Sabritas)
  for (const [sub, brand] of subBrandMappings) {
    if (nameWords.includes(` ${sub} `) || nameNorm.startsWith(`${sub} `) || nameNorm === sub) {
      return brand;
    }
  }

  return undefined;
}
