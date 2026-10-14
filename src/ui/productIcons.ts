import {
  Amphora, Apple, Baby, Banana, Bandage, Bath, BatteryFull, Bean, Beer, Bone, Brush, Bug, CakeSlice, Candy, Carrot, Cat, Cherry,
  Cigarette, Citrus, Coffee, Container, Cookie, CookingPot, Croissant, CupSoda, Cylinder, Dessert, Dog, Droplet, Droplets, Drumstick,
  Egg, Feather, Fish, Flame, FlaskRound, Flower2, Gift, GlassWater, Grape, Ham, Hand, HeartPulse, IceCreamBowl, IceCreamCone, Layers,
  Leaf, Lightbulb, Lollipop, Milk, Notebook, Nut, Package, Paperclip, PawPrint, PencilRuler, PenLine, Pill, Pizza, Popcorn, Popsicle,
  Salad, Sandwich, Scissors, ScrollText, Shirt, ShoppingBag, ShoppingBasket, Smile, Snowflake, Soup, Sparkles, SprayCan, Triangle,
  Utensils, UtensilsCrossed, WashingMachine, Wheat, Wind, Wine, Zap, type LucideIcon,
} from 'lucide-react';
import type { Product } from '../model';

/** Every icon a product can wear. The key is what gets stored as `i:<key>` in products.icon. */
export const productIcons: Record<string, { Icon: LucideIcon; label: string; group: string }> = {
  agua: { Icon: GlassWater, label: 'Agua', group: 'Bebidas' },
  refresco: { Icon: CupSoda, label: 'Refresco', group: 'Bebidas' },
  jugo: { Icon: Citrus, label: 'Jugo', group: 'Bebidas' },
  cafe: { Icon: Coffee, label: 'Café / té', group: 'Bebidas' },
  suero: { Icon: HeartPulse, label: 'Suero', group: 'Bebidas' },
  energia: { Icon: Zap, label: 'Energizante', group: 'Bebidas' },
  cerveza: { Icon: Beer, label: 'Cerveza', group: 'Bebidas' },
  vino: { Icon: Wine, label: 'Vino / licor', group: 'Bebidas' },
  leche: { Icon: Milk, label: 'Leche', group: 'Refrigerados' },
  yogur: { Icon: IceCreamBowl, label: 'Yogur', group: 'Refrigerados' },
  helado: { Icon: IceCreamCone, label: 'Helado', group: 'Refrigerados' },
  paleta_hielo: { Icon: Popsicle, label: 'Paleta helada', group: 'Refrigerados' },
  congelado: { Icon: Snowflake, label: 'Congelado', group: 'Refrigerados' },
  jamon: { Icon: Ham, label: 'Carnes frías', group: 'Refrigerados' },
  pollo: { Icon: Drumstick, label: 'Pollo', group: 'Refrigerados' },
  huevo: { Icon: Egg, label: 'Huevo', group: 'Refrigerados' },
  sandwich: { Icon: Sandwich, label: 'Preparado', group: 'Refrigerados' },
  pizza: { Icon: Pizza, label: 'Pizza', group: 'Refrigerados' },
  pan: { Icon: Croissant, label: 'Pan', group: 'Panadería' },
  pastelito: { Icon: CakeSlice, label: 'Pastelito', group: 'Panadería' },
  galleta: { Icon: Cookie, label: 'Galleta', group: 'Panadería' },
  postre: { Icon: Dessert, label: 'Gelatina / postre', group: 'Panadería' },
  dulce: { Icon: Candy, label: 'Dulce', group: 'Dulces y botanas' },
  paleta: { Icon: Lollipop, label: 'Paleta', group: 'Dulces y botanas' },
  regalo: { Icon: Gift, label: 'Chocolate / regalo', group: 'Dulces y botanas' },
  papas: { Icon: Popcorn, label: 'Papas / botana', group: 'Dulces y botanas' },
  nachos: { Icon: Triangle, label: 'Totopos', group: 'Dulces y botanas' },
  picante: { Icon: Flame, label: 'Picante', group: 'Dulces y botanas' },
  cacahuate: { Icon: Nut, label: 'Cacahuate / semilla', group: 'Dulces y botanas' },
  granos: { Icon: Wheat, label: 'Granos / harina', group: 'Abarrotes' },
  frijol: { Icon: Bean, label: 'Frijol / leguminosa', group: 'Abarrotes' },
  sopa: { Icon: Soup, label: 'Sopa', group: 'Abarrotes' },
  pasta: { Icon: CookingPot, label: 'Pasta / guiso', group: 'Abarrotes' },
  aceite: { Icon: Droplet, label: 'Aceite', group: 'Abarrotes' },
  lata: { Icon: Cylinder, label: 'Enlatado', group: 'Abarrotes' },
  pescado: { Icon: Fish, label: 'Atún / sardina', group: 'Abarrotes' },
  frasco: { Icon: Amphora, label: 'Frasco / salsa', group: 'Abarrotes' },
  canasta: { Icon: ShoppingBasket, label: 'Abarrote', group: 'Abarrotes' },
  manzana: { Icon: Apple, label: 'Fruta', group: 'Frutas y verduras' },
  platano: { Icon: Banana, label: 'Plátano', group: 'Frutas y verduras' },
  citrico: { Icon: Citrus, label: 'Cítrico', group: 'Frutas y verduras' },
  zanahoria: { Icon: Carrot, label: 'Zanahoria', group: 'Frutas y verduras' },
  uva: { Icon: Grape, label: 'Uva', group: 'Frutas y verduras' },
  cereza: { Icon: Cherry, label: 'Fresa / cereza', group: 'Frutas y verduras' },
  verdura: { Icon: Salad, label: 'Verdura', group: 'Frutas y verduras' },
  hierba: { Icon: Leaf, label: 'Hierbas', group: 'Frutas y verduras' },
  detergente: { Icon: WashingMachine, label: 'Detergente', group: 'Limpieza' },
  cloro: { Icon: FlaskRound, label: 'Cloro', group: 'Limpieza' },
  limpiador: { Icon: Sparkles, label: 'Limpiador', group: 'Limpieza' },
  suavizante: { Icon: Wind, label: 'Suavizante', group: 'Limpieza' },
  esponja: { Icon: Layers, label: 'Esponja / fibra', group: 'Limpieza' },
  escoba: { Icon: Brush, label: 'Escoba', group: 'Limpieza' },
  insecticida: { Icon: Bug, label: 'Insecticida', group: 'Limpieza' },
  bolsa: { Icon: ShoppingBag, label: 'Bolsa', group: 'Limpieza' },
  trastes: { Icon: UtensilsCrossed, label: 'Lavatrastes', group: 'Limpieza' },
  shampoo: { Icon: Droplets, label: 'Shampoo', group: 'Cuidado personal' },
  jabon: { Icon: Bath, label: 'Jabón', group: 'Cuidado personal' },
  dental: { Icon: Smile, label: 'Dental', group: 'Cuidado personal' },
  papel: { Icon: ScrollText, label: 'Papel', group: 'Cuidado personal' },
  desodorante: { Icon: SprayCan, label: 'Desodorante', group: 'Cuidado personal' },
  rastrillo: { Icon: Scissors, label: 'Rastrillo', group: 'Cuidado personal' },
  bebe: { Icon: Baby, label: 'Bebé', group: 'Cuidado personal' },
  femenino: { Icon: Flower2, label: 'Higiene femenina', group: 'Cuidado personal' },
  algodon: { Icon: Feather, label: 'Algodón', group: 'Cuidado personal' },
  crema: { Icon: Hand, label: 'Crema', group: 'Cuidado personal' },
  medicina: { Icon: Pill, label: 'Medicina', group: 'Farmacia' },
  curacion: { Icon: Bandage, label: 'Curación', group: 'Farmacia' },
  cigarro: { Icon: Cigarette, label: 'Cigarro', group: 'Hogar' },
  fuego: { Icon: Flame, label: 'Encendedor / vela', group: 'Hogar' },
  pila: { Icon: BatteryFull, label: 'Pila', group: 'Hogar' },
  foco: { Icon: Lightbulb, label: 'Foco', group: 'Hogar' },
  desechable: { Icon: Utensils, label: 'Desechable', group: 'Hogar' },
  ropa: { Icon: Shirt, label: 'Ropa / textil', group: 'Hogar' },
  perro: { Icon: Dog, label: 'Perro', group: 'Mascotas' },
  gato: { Icon: Cat, label: 'Gato', group: 'Mascotas' },
  hueso: { Icon: Bone, label: 'Premio mascota', group: 'Mascotas' },
  mascota: { Icon: PawPrint, label: 'Mascota', group: 'Mascotas' },
  cuaderno: { Icon: Notebook, label: 'Cuaderno', group: 'Papelería' },
  pluma: { Icon: PenLine, label: 'Pluma / lápiz', group: 'Papelería' },
  clip: { Icon: Paperclip, label: 'Pegamento / clip', group: 'Papelería' },
  escolar: { Icon: PencilRuler, label: 'Escolar', group: 'Papelería' },
  granel: { Icon: Container, label: 'A granel', group: 'Otros' },
  paquete: { Icon: Package, label: 'Paquete', group: 'Otros' },
};

// Ordered: the first matching rule wins, so specific words go before broad ones.
// A rule may be limited to categories so a shared word ("agua", "crema") is read in context.
const rules: [RegExp, string, RegExp?][] = [
  [/oxigenada|alcohol|curita|venda|gasa|merthiolate|isodine/i, 'curacion'],
  [/pastilla|tabs?\b|tableta|c[aá]psula|forte|\bmg\b|jarabe|antigripal|\bcold\b|tempra|aspirina|paracetamol|ibuprofeno|naproxeno|xl ?3|sedalmerck|desenfriol|alka|pepto|sal de uvas|suero oral/i, 'medicina'],
  [/electrolit|suerox|vida suero|gatorade|powerade/i, 'suero'],
  [/red ?bull|monster|vive ?100|\bvolt\b|boost|amper|predator|energ/i, 'energia'],
  [/cigarr|marlboro|camel|pall ?mall|delicados|benson|lucky|montana|chesterfield|faros/i, 'cigarro'],
  [/encendedor|cerillo|veladora|vela\b|cirio/i, 'fuego'],
  [/\bpila|bater[ií]a|duracell|energizer|rayovac/i, 'pila'],
  [/\bfoco/i, 'foco'],
  [/whiskas|minino|felix|gato|\bcat\b|arena para/i, 'gato', /mascota/i],
  [/hueso|premio|snack/i, 'hueso', /mascota/i],
  [/.*/, 'perro', /mascota/i],
  [/cuaderno|libreta|block/i, 'cuaderno'],
  [/pluma|bol[ií]grafo|l[aá]piz|\bbic\b|marcador|plumon|crayola|color(es)?\b/i, 'pluma', /papeler/i],
  [/pegamento|resistol|cinta|diurex|clip|grapa|silic[oó]n/i, 'clip'],
  [/.*/, 'escolar', /papeler/i],
  [/cerveza|caguama|corona|modelo|victoria|tecate|indio|\bxx\b|heineken|michelob|ultra|carta blanca|sol\b|bohemia|pacifico|amstel|stella|bud/i, 'cerveza', /cerveza/i],
  [/.*/, 'cerveza', /cerveza/i],
  [/.*/, 'vino', /vino|licor/i],
  [/barra|detergente|le[oó]n|zote|jab[oó]n de lavander/i, 'detergente', /limpieza/i],
  [/pa[ñn]al|huggies|kleen ?bebe|toallitas? h[uú]medas|chicolastic|\bbeb[eé]/i, 'bebe'],
  [/kotex|saba|naturella|always|toalla femenina|protector/i, 'femenino'],
  [/cotonete|algod[oó]n/i, 'algodon'],
  [/pasta dental|colgate|crest|cepillo dental|cepillo de dientes|enjuague|listerine|oral/i, 'dental'],
  [/higi[eé]nico|p[eé]talo|regio|suavel|kleenex|pa[ñn]uelo|\bbasico\b|servitoalla|toalla de cocina|\bpapel\b/i, 'papel'],
  [/desodorante|rexona|\baxe\b|speed ?stick|lady ?speed|old spice|perfume|loci[oó]n|antitranspirante|brut/i, 'desodorante'],
  [/rastrillo|gillette|prestobarba|navaja|bic comfort|rasurar/i, 'rastrillo'],
  [/shampoo|champ[uú]|sedal|caprice|pantene|head ?&? ?shoulders|savile|acondicionador|para peinar|\bgel\b|tinte|koleston|herbal/i, 'shampoo'],
  [/hinds|nivea|lubriderm|vasel|teatrical|crema corporal|crema para manos|pond/i, 'crema'],
  [/cloro|cloralex|blanqueador|clorox/i, 'cloro'],
  [/suavizante|downy|suavitel|ensue[ñn]o|vel rosita/i, 'suavizante'],
  [/lavatrastes|axion|salvo|\bdish\b|tersso/i, 'trastes'],
  [/detergente|ariel|\bfoca\b|\broma\b|carisma|espumil|\bace\b|persil|zote|\bbarra\b|le[oó]n|blanca nieves|ma[sz] color|vivere|bold/i, 'detergente'],
  [/raid|baygon|insecticida|raidolitos|h24|matamoscas|cucaracha/i, 'insecticida'],
  [/escoba|trapeador|recogedor|cubeta|mechud/i, 'escoba'],
  [/esponja|scotch|fibra|pa[ñn]o|microfib|trapo|jerga|guante/i, 'esponja'],
  [/bolsa|basura/i, 'bolsa'],
  [/jab[oó]n|zest|escudo|palmolive|\bdove\b|camay|neutro|protex|lirio|rosa venus/i, 'jabon'],
  [/pinol|fabuloso|flash|limpiador|aromatizante|glade|ambientador|maestro limpio|vanish|quitamanchas|lysol|harpic|destapa|sarricida/i, 'limpiador'],
  [/plato|vaso|cuchara|tenedor|popote|unicel|charola|desechable|cuchillo/i, 'desechable'],
  [/pel[ií]cula|aluminio|encerado|emplaye/i, 'esponja', /hogar/i],
  [/servilleta/i, 'papel'],
  [/at[uú]n|sardina|pescado|marisco|camar[oó]n|surimi/i, 'pescado'],
  [/aceite|oliva|nutrioli|patrona|1-2-3|capullo|cristal|oleico/i, 'aceite'],
  [/agua(?! oxigenada)|ciel\b|bonafont|epura|skarch|santorini|e-pura/i, 'agua'],
  [/caf[eé]|nescaf|carmelita|legal|\bt[eé]\b|\bt[eé]\s+de\b|manzanilla|canela|yerbabuena|lipton|mccormick te/i, 'cafe'],
  [/coca|pepsi|sprite|fanta|fresca|manzanita|sidral|squirt|jarritos|pe[ñn]afiel|7 ?up|mirinda|red cola|big cola|soda|refresco|mundet|sangr[ií]a se[ñn]orial|delaware|kas\b|topo chico|mineral/i, 'refresco'],
  [/jugo|n[eé]ctar|jumex|boing|del valle|frutsi|\btang\b|kool|arizona|bida|pulpy|lulu|valle/i, 'jugo'],
  [/yogur|yoghurt|danone|activia|danonino|vitalinea|yakult|alpura vaso|\bvaso\b|bebible/i, 'yogur'],
  [/helado|nieve|holanda/i, 'helado'],
  [/leche|lala|alpura|nesquik|santa clara|nutri ?leche|carnation|nido|clavel|evaporada|condensada|chocomilk|cal-c-tose/i, 'leche'],
  [/queso|quesillo|crema|mantequilla|margarina|panela|reques[oó]n|oaxaca|manchego|chihuahua|philadelphia/i, 'leche', /l[aá]cteo|refriger|abarrote/i],
  [/jam[oó]n|salchicha|chorizo|tocino|salami|bolonia|pechuga de pavo|peperoni|longaniza/i, 'jamon'],
  [/pollo|nugget|pechuga/i, 'pollo'],
  [/huevo/i, 'huevo'],
  [/at[uú]n|sardina|pescado|marisco|camar[oó]n|surimi/i, 'pescado'],
  [/sopa|maruchan|nissin|caldo|consom|knorr|ramen|cup ?noodles/i, 'sopa'],
  [/pasta|spaghetti|espagueti|fideo|codito|moderna|munyeca|macarr|lasa[ñn]a/i, 'pasta'],
  [/frijol|lenteja|garbanzo|haba|soya/i, 'frijol'],
  [/arroz|harina|maseca|minsa|az[uú]car|\bsal\b|avena|cereal|zucaritas|corn ?flakes|choco ?krispis|froot|kellogg|maicena|tortilla|tostada|salvado|granola|empanizado|pan molido/i, 'granos'],
  [/gelatina|flan|d ?gar[yi]|pud[ií]n|jell-?o|chocochoco|rompope/i, 'postre'],
  [/salsa|valentina|catsup|ketchup|mayonesa|mostaza|vinagre|adobo|mole|cajeta|mermelada|miel|aderezo|jarabe|maggi|jugo maggi|inglesa|tajin|ch[ae]moy|consom/i, 'frasco'],
  [/chile|chipotle|jalape|rajas|serrano|habanero|picante|fuego|takis|flamin|hot/i, 'picante'],
  [/lata|coste[ñn]a|herdez|elote|champi|champiñ|ñones|pur[eé] de tomate|ensalada de|chicharo|duraznos en alm|piña en alm|clemente/i, 'lata'],
  [/galleta|oreo|emperador|chokis|mar[ií]as|gamesa|crackets|saladitas|ritz|pr[ií]ncipe|triki|florentina|arcoiris|mamut|canelitas|habaneras|animalitos|polvor/i, 'galleta'],
  [/gansito|pinguino|ping[uü]ino|chocorol|submarino|pastel|mantecada|panqu[eé]|negrito|choco ?roles|roles|bomb[oó]n|twinkie|nito|barritas|suavicremas|tortuga|rocko/i, 'pastelito'],
  [/\bpan\b|bimbo|bolillo|concha|dona|telera|baguette|tortillinas|medias noches|integral|wonder|tia rosa|t[ií]a rosa/i, 'pan'],
  [/paleta|chupa|tutsi|vero|bubaloo|rockaleta|payaso|lollipop/i, 'paleta'],
  [/chocolate|carlos v|snickers|kinder|ferrero|hershey|milky|abuelita|chocolat|kit ?kat|m&m|crunch|bubu|duvalín|duvalin|mazap|nutella|reese/i, 'regalo'],
  [/chicle|trident|halls|clorets|gomita|pulparindo|mazap[aá]n|dulce|caramelo|bombones|skwinkles|panditas|lucas|pelon|rellerindos|tama-?roca|kranky|freskas|mentita|winis|picafresa|chocoretas/i, 'dulce'],
  [/doritos|tostitos|totopo|nachos|crujitos/i, 'nachos'],
  [/cacahuate|nuez|semilla|pistache|almendra|pepita|garapi[ñn]ado|mix|kiyakis|japon[eé]s|enchilados/i, 'cacahuate'],
  [/papas|sabritas|ruffles|cheetos|fritos|runners|churrumais|palomitas|popcorn|botana|chicharr|cuerito|rancheritos|sabritones|chips|paketaxo|cheese|karate|pringles|bokados|hot nuts|tostachos|fritura|chetos/i, 'papas'],
  [/pl[aá]tano/i, 'platano'],
  [/manzana(?!.*(t[eé]|jugo|sidral))/i, 'manzana', /fruta|verdura/i],
  [/lim[oó]n|naranja|toronja|mandarina/i, 'citrico', /fruta|verdura/i],
  [/zanahoria/i, 'zanahoria'],
  [/\buva/i, 'uva', /fruta|verdura/i],
  [/fresa|cereza/i, 'cereza', /fruta|verdura/i],
  [/cilantro|perejil|epazote|hierba|yerba/i, 'hierba'],
  [/jitomate|tomate|cebolla|\bpapa\b|lechuga|pepino|calabaza|aguacate|chayote|ajo/i, 'verdura'],
  [/hielo|congelad/i, 'congelado'],
  [/granel|kilo\b|\bkg\b/i, 'granel'],
];

// When no word matches, the category still says a lot. Brand categories map to what they sell.
const categoryIcons: [RegExp, string][] = [
  [/skarch|agua/i, 'agua'],
  [/coca|pepsi|jarritos|pe[ñn]afiel|red cola|otras bebidas|bebida/i, 'refresco'],
  [/jumex|boing|tang|arizona|jugo/i, 'jugo'],
  [/electrolit|suerox/i, 'suero'],
  [/cerveza/i, 'cerveza'],
  [/vino|licor/i, 'vino'],
  [/l[aá]cteo|refriger/i, 'leche'],
  [/marinela/i, 'pastelito'],
  [/bimbo|t[ií]a rosa|panader/i, 'pan'],
  [/gamesa|oreo|galleta/i, 'galleta'],
  [/sabritas|barcel|botana|chidas|leo/i, 'papas'],
  [/dulce|chocolate/i, 'dulce'],
  [/limpieza/i, 'limpiador'],
  [/cuidado personal/i, 'jabon'],
  [/hogar|desechable/i, 'desechable'],
  [/farmacia/i, 'medicina'],
  [/tabaco/i, 'cigarro'],
  [/mascota/i, 'mascota'],
  [/papeler/i, 'escolar'],
  [/fruta|verdura/i, 'manzana'],
  [/granel/i, 'granel'],
  [/abarrote/i, 'canasta'],
];

export function parseBrandBadge(iconStr?: string | null): { tone: string; label: string; detail: string } | null {
  if (!iconStr || !iconStr.startsWith('brand:')) return null;
  const parts = iconStr.slice(6).split(':');
  if (parts.length < 2) return null;
  const tone = parts[0] || 'cola';
  const label = parts[1] || '';
  const detail = parts.slice(2).join(':') || '';
  return { tone, label, detail };
}

export function formatBrandBadge(tone: string, label: string, detail: string): string {
  const cleanTone = tone.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'cola';
  const cleanLabel = label.trim().replace(/[:\n\r]/g, ' ') || 'Marca';
  const cleanDetail = detail.trim().replace(/[:\n\r]/g, ' ');
  return `brand:${cleanTone}:${cleanLabel}:${cleanDetail}`;
}

export const BRAND_PRESETS = [
  { label: 'Coca-Cola', detail: 'Bebidas', tone: 'cola' },
  { label: 'Skarch', detail: 'Bebidas', tone: 'skarch' },
  { label: 'Bimbo', detail: 'Panadería', tone: 'bimbo' },
  { label: 'Sabritas', detail: 'Botanas', tone: 'sabritas' },
  { label: 'Nutrioli', detail: 'Aceites', tone: 'nutrioli' },
  { label: 'Patrona', detail: 'Aceites', tone: 'patrona' },
  { label: 'Lala', detail: 'Lácteos', tone: 'lala' },
  { label: 'Alpura', detail: 'Lácteos', tone: 'alpura' },
  { label: 'Marinela', detail: 'Panadería', tone: 'marinela' },
  { label: 'Gamesa', detail: 'Galletas', tone: 'gamesa' },
  { label: 'Doritos', detail: 'Botanas', tone: 'doritos' },
  { label: 'Takis', detail: 'Botanas', tone: 'takis' },
  { label: 'FUD', detail: 'Cremería', tone: 'fud' },
  { label: 'Jarritos', detail: 'Bebidas', tone: 'jarritos' },
  { label: 'Peñafiel', detail: 'Bebidas', tone: 'penafiel' },
  { label: 'Jumex', detail: 'Jugos', tone: 'jugos' },
  { label: 'Boing', detail: 'Jugos', tone: 'boing' },
  { label: 'Del Valle', detail: 'Jugos', tone: 'valle' },
  { label: 'McCormick', detail: 'Aderezos', tone: 'mccormick' },
  { label: 'La Costeña', detail: 'Enlatados', tone: 'costena' },
  { label: 'La Moderna', detail: 'Pastas', tone: 'moderna' },
  { label: 'Cloralex', detail: 'Limpieza', tone: 'cloralex' },
  { label: 'Zote', detail: 'Limpieza', tone: 'zote' },
  { label: 'AriZona', detail: 'Bebidas', tone: 'arizona' },
  { label: 'Pepsi', detail: 'Bebidas', tone: 'pepsi' },
  { label: 'Red Cola', detail: 'Bebidas', tone: 'redcola' },
  { label: 'Danone', detail: 'Lácteos', tone: 'danone' },
  { label: 'Tía Rosa', detail: 'Panadería', tone: 'tiarosa' },
  { label: 'Electrolit', detail: 'Bebidas', tone: 'electrolit' },
  { label: 'Suerox', detail: 'Bebidas', tone: 'suerox' },
  { label: 'Corona', detail: 'Bebidas', tone: 'corona' },
  { label: 'Nestlé', detail: 'Abarrotes', tone: 'nestle' },
];

export const BRAND_TONES = [
  { tone: 'cola', name: 'Rojo Cola' },
  { tone: 'skarch', name: 'Cian Skarch' },
  { tone: 'lala', name: 'Azul Lala' },
  { tone: 'bimbo', name: 'Azul Bimbo' },
  { tone: 'sabritas', name: 'Amarillo Sabritas' },
  { tone: 'nutrioli', name: 'Verde Nutrioli' },
  { tone: 'patrona', name: 'Dorado Aceite' },
  { tone: 'takis', name: 'Morado Takis' },
  { tone: 'doritos', name: 'Naranja Doritos' },
  { tone: 'fud', name: 'Rojo FUD' },
  { tone: 'jugos', name: 'Naranja Cítrico' },
  { tone: 'cloralex', name: 'Verde Limpieza' },
  { tone: 'zote', name: 'Rosa Zote' },
  { tone: 'tiarosa', name: 'Rosa Tía Rosa' },
  { tone: 'penafiel', name: 'Celeste Mineral' },
  { tone: 'corona', name: 'Azul Marino' },
];

export function customIconKey(product: Pick<Product, 'icon'>): string | null {
  return product.icon?.startsWith('i:') && productIcons[product.icon.slice(2)] ? product.icon.slice(2) : null;
}

export function autoIconKey(product: Pick<Product, 'name' | 'category'> & { code?: string }): string {
  const name = (product.name?.trim() || product.code?.trim() || '');
  for (const [match, key, category] of rules) {
    if (category && !category.test(product.category)) continue;
    if (match.test(name)) return key;
  }
  return categoryIcons.find(([match]) => match.test(product.category))?.[1] ?? 'paquete';
}

export function iconKeyFor(product: Pick<Product, 'name' | 'category' | 'icon'> & { code?: string }): string {
  return customIconKey(product) ?? autoIconKey(product);
}

// Each family has its own hue so a shelf of mixed products reads like a real store aisle.
const families: [RegExp, number][] = [
  [/skarch|agua/i, 199], [/coca|pepsi|red cola/i, 356], [/jarritos|pe[ñn]afiel|otras bebidas/i, 16],
  [/jumex|boing|tang|arizona/i, 32], [/electrolit|suerox/i, 186], [/cerveza/i, 43], [/vino|licor/i, 330],
  [/l[aá]cteo|refriger/i, 210], [/marinela/i, 12], [/bimbo|t[ií]a rosa/i, 28], [/gamesa|oreo|galleta|pan y/i, 30],
  [/sabritas/i, 48], [/barcel/i, 8], [/botana|chidas|leo/i, 38], [/dulce|chocolate/i, 322],
  [/limpieza/i, 176], [/cuidado personal/i, 268], [/hogar|desechable/i, 222], [/farmacia/i, 150],
  [/tabaco/i, 25], [/mascota/i, 95], [/papeler/i, 240], [/fruta|verdura/i, 115], [/abarrote/i, 60],
];

export function categoryHue(category: string): number {
  const found = families.find(([match]) => match.test(category));
  if (found) return found[1];
  let hash = 0;
  for (const char of category) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

/** "Agua Skarch 10L" → "10 L"; "Coca Cola 600ml" → "600 ml". */
export function presentation(name: string): string | null {
  const found = name.match(/(\d+(?:[.,]\d+)?)\s*(ml|mililitros?|lts?|litros?|l|grs?|gramos?|g|kgs?|kilos?|oz|pzas?|pz|piezas?|pzs|tabs|caps)\b/i);
  if (!found) return null;
  const unit = found[2].toLowerCase();
  const normalized = /^ml|^mili/.test(unit) ? 'ml' : /^l/.test(unit) ? 'L' : /^kg|^kilo/.test(unit) ? 'kg' : /^g/.test(unit) ? 'g'
    : unit === 'oz' ? 'oz' : /^p/.test(unit) ? 'pz' : unit;
  return `${found[1].replace(',', '.')} ${normalized}`;
}
