import {brandLogo,productBrandName} from './brandAssets';
import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { money, quantity, type Product } from '../model';
import { reducedMotion } from './interaction';
import { categoryHue, customIconKey, iconKeyFor, parseBrandBadge, presentation, productIcons } from './productIcons';

export const brandBadges = [
  { match: /\b(?:coca[-\s]?cola)\b/i, label: 'Coca-Cola', tone: 'cola', detail: 'Bebidas' },
  { match: /\b(?:sabritas)\b/i, label: 'Sabritas', tone: 'sabritas', detail: 'Botanas' },
  { match: /\b(?:doritos)\b/i, label: 'Doritos', tone: 'doritos', detail: 'Botanas' },
  { match: /\b(?:barcel)\b/i, label: 'Barcel', tone: 'takis', detail: 'Botanas' },
  { match: /\b(?:takis)\b/i, label: 'Takis', tone: 'takis', detail: 'Botanas' },
  { match: /\b(?:bimbo)\b/i, label: 'Bimbo', tone: 'bimbo', detail: 'Panadería' },
  { match: /\b(?:gamesa)\b/i, label: 'Gamesa', tone: 'gamesa', detail: 'Galletas' },
  { match: /\b(?:marinela)\b/i, label: 'Marinela', tone: 'marinela', detail: 'Panadería' },
  { match: /\b(?:lala)\b/i, label: 'Lala', tone: 'lala', detail: 'Lácteos' },
  { match: /\b(?:alpura)\b/i, label: 'Alpura', tone: 'alpura', detail: 'Lácteos' },
  { match: /\b(?:danone)\b/i, label: 'Danone', tone: 'danone', detail: 'Lácteos' },
  { match: /\b(?:fud)\b/i, label: 'FUD', tone: 'fud', detail: 'Cremería' },
  { match: /\b(?:jarritos)\b/i, label: 'Jarritos', tone: 'jarritos', detail: 'Bebidas' },
  { match: /\b(?:pe[ñn]afiel)\b/i, label: 'Peñafiel', tone: 'penafiel', detail: 'Bebidas' },
  { match: /\b(?:jumex)\b/i, label: 'Jumex', tone: 'jugos', detail: 'Jugos' },
  { match: /\b(?:boing)\b/i, label: 'Boing', tone: 'boing', detail: 'Jugos' },
  { match: /\b(?:nutrioli)\b/i, label: 'Nutrioli', tone: 'nutrioli', detail: 'Aceites' },
  { match: /\b(?:patrona)\b/i, label: 'Patrona', tone: 'patrona', detail: 'Aceites' },
  { match: /\b(?:mccormick)\b/i, label: 'McCormick', tone: 'mccormick', detail: 'Aderezos' },
  { match: /\b(?:la moderna)\b/i, label: 'La Moderna', tone: 'moderna', detail: 'Pastas' },
  { match: /\b(?:la coste[ñn]a)\b/i, label: 'La Costeña', tone: 'costena', detail: 'Enlatados' },
  { match: /\b(?:cloralex)\b/i, label: 'Cloralex', tone: 'cloralex', detail: 'Limpieza' },
  { match: /\b(?:zote)\b/i, label: 'Zote', tone: 'zote', detail: 'Limpieza' },
  { match: /\b(?:pepsi)\b/i, label: 'Pepsi', tone: 'pepsi', detail: 'Bebidas' },
  { match: /\b(?:t[ií]a rosa)\b/i, label: 'Tía Rosa', tone: 'tiarosa', detail: 'Panadería' },
  { match: /\b(?:skarch)\b/i, label: 'Skarch', tone: 'skarch', detail: 'Bebidas' },
  { match: /\b(?:arizona)\b/i, label: 'AriZona', tone: 'arizona', detail: 'Bebidas' },
  { match: /\b(?:red cola)\b/i, label: 'Red Cola', tone: 'redcola', detail: 'Bebidas' },
  { match: /\b(?:del valle)\b/i, label: 'Del Valle', tone: 'valle', detail: 'Jugos' },
  { match: /\b(?:aspirin[ae]?|cafiaspirina)\b/i, label: 'Aspirina', tone: 'cola', detail: 'Farmacia' },
  { match: /\b(?:bayer|alka\s*seltzer|tabcin|bepanthen|canesten)\b/i, label: 'Bayer', tone: 'skarch', detail: 'Farmacia' },
  { match: /\b(?:pepto[\s-]?bismol)\b/i, label: 'Pepto-Bismol', tone: 'tiarosa', detail: 'Farmacia' },
  { match: /\b(?:cheetos)\b/i, label: 'Cheetos', tone: 'doritos', detail: 'Botanas' },
  { match: /\b(?:gatorade)\b/i, label: 'Gatorade', tone: 'jugos', detail: 'Bebidas' },
  { match: /\b(?:nescaf[eé])\b/i, label: 'Nescafé', tone: 'fud', detail: 'Café' },
  { match: /\b(?:colgate)\b/i, label: 'Colgate', tone: 'cola', detail: 'Cuidado personal' },
  { match: /\b(?:knorr)\b/i, label: 'Knorr', tone: 'nutrioli', detail: 'Abarrotes' },
  { match: /\b(?:red\s*bull)\b/i, label: 'Red Bull', tone: 'lala', detail: 'Bebidas' },
];

function compactBadgeText(label: string): string {
  const clean = label.trim();
  if (clean.length <= 8) return clean;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }
  return clean;
}

export const ProductVisual = memo(function ProductVisual({ product, compact = false }: { product: Product; compact?: boolean }) {
  const [failedLogo,setFailedLogo]=useState('');
  const custom = customIconKey(product);
  if (custom) {
    const { Icon } = productIcons[custom] ?? productIcons.paquete;
    return (
      <span className={`product-visual product-tile ${compact ? 'compact' : ''}`} style={{ '--tile-hue': categoryHue(product.category) } as CSSProperties} aria-hidden="true">
        <Icon strokeWidth={1.6}/>
      </span>
    );
  }

  const configuredBrand=parseBrandBadge(product.icon);
  if (configuredBrand) {
    const configuredLogo=brandLogo(configuredBrand.label);
    if(configuredLogo&&failedLogo!==configuredLogo){
      return <span className={`product-visual product-brand-logo ${compact?'compact':''}`} aria-hidden="true">
        <img src={configuredLogo} alt="" width={64} height={44} decoding="async" draggable={false} onError={()=>setFailedLogo(configuredLogo)}/>
      </span>;
    }
    return (
      <span className={`product-visual brand-badge brand-${configuredBrand.tone} ${compact ? 'compact' : ''}`} aria-hidden="true">
        <span className="brand-lettering">{compact ? compactBadgeText(configuredBrand.label) : configuredBrand.label}</span>
        {!compact && configuredBrand.detail && <span className="brand-detail">{configuredBrand.detail}</span>}
      </span>
    );
  }

  const namedBrand=productBrandName(product.name, product.category);
  const logo=brandLogo(namedBrand??'');
  if(logo&&failedLogo!==logo){
    return <span className={`product-visual product-brand-logo ${compact?'compact':''}`} aria-hidden="true">
      <img src={logo} alt="" width={64} height={44} decoding="async" draggable={false} onError={()=>setFailedLogo(logo)}/>
    </span>;
  }

  const autoBrand = brandBadges.find(b => b.match.test(product.name || ''));
  if (autoBrand) {
    return (
      <span className={`product-visual brand-badge brand-${autoBrand.tone} ${compact ? 'compact' : ''}`} aria-hidden="true">
        <span className="brand-lettering">{compact ? compactBadgeText(autoBrand.label) : autoBrand.label}</span>
        {!compact && <span className="brand-detail">{autoBrand.detail}</span>}
      </span>
    );
  }

  const { Icon } = productIcons[iconKeyFor(product)] ?? productIcons.paquete;
  return (
    <span className={`product-visual product-tile ${compact ? 'compact' : ''}`} style={{ '--tile-hue': categoryHue(product.category) } as CSSProperties} aria-hidden="true">
      <Icon strokeWidth={1.6}/>
    </span>
  );
});

export function StockBadge({ product }: { product: Product }) {
  const low = product.stock <= product.minimum;
  return <span className={`stock-badge ${product.stock<=0?'stock-unavailable':low ? 'stock-low' : ''}`} title={product.expired_stock>0?`${quantity(product.expired_stock)} vencidos, excluidos del disponible`:'Existencias disponibles'}>
    {product.stock>0&&<span className={`stock-battery ${low?'low':'good'}`} aria-hidden="true">{[1,2,3,4].map(n=><i key={n} className={n<=Math.ceil(product.stock/Math.max(1,product.stock,product.target,product.minimum)*4)?'filled':''}/>)}</span>}
    <span className="stock-label">{product.stock<=0?'Agotado':`${quantity(product.stock)} ${product.unit==='pieza'?'pzas':'kg'}`}</span>
    <span className="sr-only">{product.stock === 0 ? ', agotado' : low ? ', por agotarse' : ', disponible'}</span>
  </span>;
}

type Props = { product: Product; disabled: boolean; pulse: number; onAdd: (product: Product) => void };

function moveFocus(event: KeyboardEvent<HTMLButtonElement>) {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const grid = event.currentTarget.parentElement;
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll<HTMLButtonElement>('.sale-product-card'));
  const index = cards.indexOf(event.currentTarget);
  const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const step = event.key === 'ArrowDown' ? columns : event.key === 'ArrowUp' ? -columns : event.key === 'ArrowLeft' ? -1 : 1;
  let next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : index + step;
  event.preventDefault();
  while (next >= 0 && next < cards.length && cards[next].disabled) next += step;
  if (next >= 0 && next < cards.length) cards[next].focus();
}

export default memo(function ProductCard({ product, disabled, pulse, onAdd }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pulse || reducedMotion()) return;
    const animation = ref.current?.animate([{transform:'scale(1)'},{transform:'scale(.98)'},{transform:'scale(1)'}], { duration:160,easing:'ease-out' });
    return () => animation?.cancel();
  }, [pulse]);

  const tone = product.unit === 'kg' ? 'green'
    : /bebidas/i.test(product.category) ? 'coral'
    : /lácteos/i.test(product.category) ? 'blue'
    : /botanas|panadería/i.test(product.category) ? 'gold' : 'violet';

    return <button ref={ref} className="product-card sale-product-card" data-tone={tone} disabled={disabled||product.stock<=0} type="button" data-unavailable={product.stock<=0}
    onKeyDown={moveFocus} onClick={() => onAdd(product)}
    aria-label={`${product.stock<=0?'Agotado:':'Agregar'} ${product.name}, ${money(product.promotion_price??product.price)} por ${product.unit}. Disponible: ${quantity(product.stock)} ${product.unit}`}>

    <ProductCardContent product={product}/>
  </button>;
});



// Keep the costly visual subtree stable when only callbacks or pulse state change.
const ProductCardContent = memo(function ProductCardContent({product}:{product:Product}) {
 const pres=presentation(product.name || product.code);
 return <>
    <span className="product-face sale-product-face"><ProductVisual product={product} compact/></span>
    <span className="product-category sale-product-category">{product.category}{pres && <span className="category-size"> · {pres}</span>} <span>· {product.unit === 'kg' ? 'por kilo' : 'por pieza'}</span></span>
    <strong className="product-name sale-product-name" title={product.name || product.code}>{product.name || product.code}</strong>
    <span className="product-footer sale-product-footer"><b className="promo-price">{money(product.promotion_price??product.price)}{product.promotion_price!==null&&product.promotion_price<product.price&&<><del>{money(product.price)}</del><em>Oferta</em></>}</b><StockBadge product={product}/></span>
 </>;
});
