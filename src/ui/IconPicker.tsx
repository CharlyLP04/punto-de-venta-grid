import { useMemo, useState, type CSSProperties } from 'react';
import { Sparkles, Search, Check, Tag, Package, Palette, BookmarkPlus, X } from 'lucide-react';
import {
  autoIconKey,
  categoryHue,
  customIconKey,
  formatBrandBadge,
  parseBrandBadge,
  productIcons,
  BRAND_PRESETS,
  BRAND_TONES,
} from './productIcons';
import { brandBadges } from './ProductCard';
import type { Product } from '../model';

const STORAGE_KEY = 'grid_custom_brand_badges_v1';

export type CustomBrand = {
  tone: string;
  label: string;
  detail: string;
};

export function loadSavedBrands(): CustomBrand[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list.filter((b): b is CustomBrand => !!(b && typeof b.label === 'string' && b.label.trim() && b.tone));
    }
  } catch {}
  return [];
}

export function saveBrandToStorage(brand: CustomBrand) {
  try {
    const existing = loadSavedBrands();
    const cleanLabel = brand.label.trim();
    if (!cleanLabel) return;
    const filtered = existing.filter(
      b => !(b.label.trim().toLowerCase() === cleanLabel.toLowerCase() && b.tone === brand.tone)
    );
    const updated = [
      { tone: brand.tone, label: cleanLabel, detail: (brand.detail || '').trim() },
      ...filtered,
    ].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function removeBrandFromStorage(label: string, tone: string) {
  try {
    const existing = loadSavedBrands();
    const filtered = existing.filter(
      b => !(b.label.trim().toLowerCase() === label.trim().toLowerCase() && b.tone === tone)
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {}
}

type Props = {
  product?: Partial<Product> | null;
  products?: Product[];
  name?: string;
  category?: string;
};

type Mode = 'auto' | 'brand' | 'icon';

export default function IconPicker({ product, products, name = '', category = '' }: Props) {
  const effectiveProduct = useMemo(
    () => ({
      name: name || product?.name || '',
      category: category || product?.category || 'Abarrotes',
      icon: product?.icon || '',
      code: product?.code || '',
    }),
    [product, name, category]
  );

  const parsedBrand = useMemo(() => parseBrandBadge(effectiveProduct.icon), [effectiveProduct.icon]);
  const initialCustomIcon = customIconKey(effectiveProduct);

  const initialMode: Mode = parsedBrand ? 'brand' : initialCustomIcon ? 'icon' : 'auto';
  const [mode, setMode] = useState<Mode>(initialMode);

  // Icon state
  const [selectedKey, setSelectedKey] = useState<string | null>(initialCustomIcon);
  const [iconQuery, setIconQuery] = useState('');

  // Brand state
  const autoBrandMatch = useMemo(
    () => brandBadges.find((b) => b.match.test(effectiveProduct.name)),
    [effectiveProduct.name]
  );

  const defaultBrandLabel = parsedBrand?.label || autoBrandMatch?.label || effectiveProduct.name.split(' ')[0] || 'Marca';
  const defaultBrandDetail = parsedBrand?.detail || autoBrandMatch?.detail || effectiveProduct.category || 'Abarrotes';
  const defaultBrandTone = parsedBrand?.tone || autoBrandMatch?.tone || 'cola';

  const [brandLabel, setBrandLabel] = useState(defaultBrandLabel);
  const [brandDetail, setBrandDetail] = useState(defaultBrandDetail);
  const [brandTone, setBrandTone] = useState(defaultBrandTone);
  const [brandQuery, setBrandQuery] = useState('');

  // Reusable custom brands
  const [savedBrands, setSavedBrands] = useState<CustomBrand[]>(() => loadSavedBrands());

  // Aggregate custom brands from DB products + localStorage
  const allCustomBrands = useMemo(() => {
    const map = new Map<string, CustomBrand>();
    if (products) {
      for (const p of products) {
        const b = parseBrandBadge(p.icon);
        if (b && b.label.trim()) {
          const key = `${b.tone}:${b.label.trim().toLowerCase()}`;
          if (!map.has(key)) map.set(key, { tone: b.tone, label: b.label.trim(), detail: b.detail.trim() });
        }
      }
    }
    for (const b of savedBrands) {
      const key = `${b.tone}:${b.label.trim().toLowerCase()}`;
      map.set(key, b);
    }
    return Array.from(map.values());
  }, [products, savedBrands]);

  // Is current typed brand already saved?
  const isCurrentBrandSaved = useMemo(() => {
    const clean = brandLabel.trim().toLowerCase();
    if (!clean) return false;
    return allCustomBrands.some(
      b => b.label.trim().toLowerCase() === clean && b.tone === brandTone
    );
  }, [brandLabel, brandTone, allCustomBrands]);

  const handleSaveCurrentBrand = () => {
    if (!brandLabel.trim()) return;
    const item: CustomBrand = {
      tone: brandTone,
      label: brandLabel.trim(),
      detail: brandDetail.trim(),
    };
    saveBrandToStorage(item);
    setSavedBrands(loadSavedBrands());
  };

  const handleRemoveBrand = (e: React.MouseEvent, b: CustomBrand) => {
    e.stopPropagation();
    removeBrandFromStorage(b.label, b.tone);
    setSavedBrands(loadSavedBrands());
  };

  // Auto icon
  const autoKey = useMemo(() => autoIconKey(effectiveProduct), [effectiveProduct]);
  const activeKey = selectedKey || autoKey;
  const activeDef = productIcons[activeKey] ?? productIcons.paquete;
  const ActiveIcon = activeDef.Icon;
  const hue = categoryHue(effectiveProduct.category);

  // Filtered icons
  const filteredIcons = useMemo(() => {
    const q = iconQuery.trim().toLowerCase();
    const entries = Object.entries(productIcons);
    if (!q) return entries;
    return entries.filter(
      ([key, def]) =>
        key.includes(q) || def.label.toLowerCase().includes(q) || def.group.toLowerCase().includes(q)
    );
  }, [iconQuery]);

  // Filtered brand presets
  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return BRAND_PRESETS;
    return BRAND_PRESETS.filter(
      (b) => b.label.toLowerCase().includes(q) || b.detail.toLowerCase().includes(q)
    );
  }, [brandQuery]);

  // Filtered custom brands
  const filteredCustomBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return allCustomBrands;
    return allCustomBrands.filter(
      (b) => b.label.toLowerCase().includes(q) || b.detail.toLowerCase().includes(q)
    );
  }, [brandQuery, allCustomBrands]);

  // Current hidden value sent to backend
  const hiddenValue = useMemo(() => {
    if (mode === 'auto') return '';
    if (mode === 'icon') return selectedKey ? `i:${selectedKey}` : '';
    if (mode === 'brand') return formatBrandBadge(brandTone, brandLabel, brandDetail);
    return '';
  }, [mode, selectedKey, brandTone, brandLabel, brandDetail]);

  const isBrandVisual = mode === 'brand' || (mode === 'auto' && !!autoBrandMatch);
  const activeBrandTone = mode === 'brand' ? brandTone : autoBrandMatch?.tone || 'cola';
  const activeBrandLabel = mode === 'brand' ? brandLabel : autoBrandMatch?.label || 'Marca';
  const activeBrandDetail = mode === 'brand' ? brandDetail : autoBrandMatch?.detail || '';

  const selectBrandPreset = (preset: { tone: string; label: string; detail: string }) => {
    setMode('brand');
    setBrandTone(preset.tone);
    setBrandLabel(preset.label);
    setBrandDetail(preset.detail);
  };

  return (
    <div className="icon-picker">
      <input type="hidden" name="icon" value={hiddenValue} />

      {/* Head preview */}
      <div className="icon-picker-head">
        {isBrandVisual ? (
          <span
            className={`product-visual brand-badge brand-${activeBrandTone}`}
            style={{
              width: '88px',
              height: '56px',
              minHeight: '56px',
              position: 'relative',
              transform: 'none',
              boxShadow: 'none',
              padding: '8px 10px',
              borderRadius: '12px',
            }}
            aria-hidden="true"
          >
            <span className="brand-lettering" style={{ fontSize: '15px' }}>
              {activeBrandLabel}
            </span>
            {activeBrandDetail && (
              <span className="brand-detail" style={{ fontSize: '7px' }}>
                {activeBrandDetail}
              </span>
            )}
          </span>
        ) : (
          <span className="product-tile" style={{ '--tile-hue': hue } as CSSProperties} aria-hidden="true">
            <ActiveIcon strokeWidth={1.6} />
          </span>
        )}

        <div style={{ flex: 1 }}>
          <strong>
            {mode === 'auto'
              ? autoBrandMatch
                ? `Insignia de marca: ${autoBrandMatch.label} (automática)`
                : `${activeDef.label} (automático)`
              : mode === 'brand'
              ? `Insignia de marca: ${brandLabel || 'Personalizada'}`
              : `Icono: ${activeDef.label}`}
          </strong>
          <small>
            {mode === 'auto'
              ? 'Detectado automáticamente según el nombre y la categoría'
              : mode === 'brand'
              ? 'Tarjeta visual de marca guardada para este producto'
              : 'Icono personalizado de abarrotes guardado'}
          </small>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="icon-picker-tabs" role="tablist" aria-label="Tipo de presentación visual">
        <button
          type="button"
          className={`icon-picker-tab ${mode === 'auto' ? 'active' : ''}`}
          onClick={() => {
            setMode('auto');
            setSelectedKey(null);
          }}
        >
          <Sparkles size={13} style={{ marginRight: '4px' }} />
          Automático {mode === 'auto' && <Check size={13} style={{ marginLeft: '4px' }} />}
        </button>

        <button
          type="button"
          className={`icon-picker-tab ${mode === 'brand' ? 'active' : ''}`}
          onClick={() => {
            setMode('brand');
          }}
        >
          <Tag size={13} style={{ marginRight: '4px' }} />
          Insignia de Marca (como Coca-Cola, Bimbo...) {mode === 'brand' && <Check size={13} style={{ marginLeft: '4px' }} />}
        </button>

        <button
          type="button"
          className={`icon-picker-tab ${mode === 'icon' ? 'active' : ''}`}
          onClick={() => {
            setMode('icon');
            if (!selectedKey) setSelectedKey(autoKey);
          }}
        >
          <Package size={13} style={{ marginRight: '4px' }} />
          Icono de Abarrotes {mode === 'icon' && <Check size={13} style={{ marginLeft: '4px' }} />}
        </button>
      </div>

      {/* Mode Content: BRAND */}
      {mode === 'brand' && (
        <div className="brand-picker-box">
          <div className="brand-custom-fields">
            <label>
              <span>Nombre de la marca (ej. Coca-Cola, Imperial, Peñafiel)</span>
              <input
                type="text"
                maxLength={30}
                value={brandLabel}
                onChange={(e) => setBrandLabel(e.target.value)}
                placeholder="Nombre de la marca"
              />
            </label>
            <label>
              <span>Detalle / Subtítulo (ej. Bebidas, Aceites, Botanas)</span>
              <input
                type="text"
                maxLength={25}
                value={brandDetail}
                onChange={(e) => setBrandDetail(e.target.value)}
                placeholder="Categoría o subtítulo"
              />
            </label>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Palette size={13} style={{ opacity: 0.7 }} />
              <small style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Color y estilo de la tarjeta:</small>
            </div>
            <div className="brand-tone-grid">
              {BRAND_TONES.map((t) => (
                <button
                  type="button"
                  key={t.tone}
                  className="brand-tone-chip"
                  aria-pressed={brandTone === t.tone}
                  onClick={() => setBrandTone(t.tone)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Action button to save & reuse this badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', paddingBottom: '4px' }}>
            <button
              type="button"
              className="save-brand-btn"
              onClick={handleSaveCurrentBrand}
              disabled={!brandLabel.trim() || isCurrentBrandSaved}
            >
              <BookmarkPlus size={14} />
              {isCurrentBrandSaved ? 'Marca guardada en tu catálogo' : 'Guardar esta marca para reutilizarla'}
            </button>
            {isCurrentBrandSaved && (
              <span className="saved-badge-indicator">
                <Check size={13} /> Lista para reutilizar
              </span>
            )}
          </div>

          {/* Section: User's saved / created brands */}
          {allCustomBrands.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={13} style={{ color: 'var(--accent-gold)' }} />
                  <small style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    Tus marcas creadas ({allCustomBrands.length}):
                  </small>
                </div>
                <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Toca para aplicar</small>
              </div>

              <div className="brand-picker-presets" style={{ maxHeight: '130px' }}>
                {filteredCustomBrands.map((custom) => {
                  const isSelected =
                    brandTone === custom.tone &&
                    brandLabel.trim().toLowerCase() === custom.label.trim().toLowerCase();
                  return (
                    <div key={`custom-${custom.tone}-${custom.label}`} className="brand-preset-wrapper">
                      <button
                        type="button"
                        className={`brand-preset-btn brand-${custom.tone}`}
                        aria-pressed={isSelected}
                        onClick={() => selectBrandPreset(custom)}
                        style={{
                          background: 'var(--badge-bg)',
                          color: 'var(--badge-ink)',
                          borderColor: 'var(--badge-border)',
                          width: '100%',
                        }}
                      >
                        <span className="brand-lettering" style={{ fontSize: '13px', lineHeight: 1.1 }}>
                          {custom.label}
                        </span>
                        {custom.detail && (
                          <span className="brand-detail" style={{ fontSize: '6px', marginTop: '2px' }}>
                            {custom.detail}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="remove-brand-chip-btn"
                        title="Quitar de marcas guardadas"
                        onClick={(e) => handleRemoveBrand(e, custom)}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Popular Mexican brands */}
          <div style={{ borderTop: allCustomBrands.length > 0 ? '1px solid var(--border-subtle)' : undefined, paddingTop: allCustomBrands.length > 0 ? '10px' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <small style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>O elige una marca popular mexicana:</small>
              <div style={{ position: 'relative', width: '180px' }}>
                <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }} />
                <input
                  type="search"
                  placeholder="Filtrar marcas..."
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  style={{ paddingLeft: '24px', fontSize: '11px', height: '26px' }}
                />
              </div>
            </div>

            <div className="brand-picker-presets">
              {filteredBrands.map((preset) => {
                const isSelected = brandTone === preset.tone && brandLabel === preset.label;
                return (
                  <button
                    type="button"
                    key={`${preset.tone}-${preset.label}`}
                    className={`brand-preset-btn brand-${preset.tone}`}
                    aria-pressed={isSelected}
                    onClick={() => selectBrandPreset(preset)}
                    style={{ background: 'var(--badge-bg)', color: 'var(--badge-ink)', borderColor: 'var(--badge-border)' }}
                  >
                    <span className="brand-lettering" style={{ fontSize: '13px', lineHeight: 1.1 }}>
                      {preset.label}
                    </span>
                    <span className="brand-detail" style={{ fontSize: '6px', marginTop: '2px' }}>
                      {preset.detail}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mode Content: ICON */}
      {mode === 'icon' && (
        <>
          <div className="icon-picker-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '4px 0' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}
              />
              <input
                type="search"
                placeholder="Buscar icono (ej. leche, jabón, carne, atún)..."
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
                style={{ paddingLeft: '30px', fontSize: '12px', height: '34px' }}
              />
            </div>
          </div>

          <div className="icon-picker-grid" role="group" aria-label="Catálogo de iconos para el producto">
            {filteredIcons.map(([key, def]) => {
              const ItemIcon = def.Icon;
              const isSelected = selectedKey === key;
              return (
                <button
                  type="button"
                  key={key}
                  aria-pressed={isSelected}
                  title={`${def.label} (${def.group})`}
                  onClick={() => setSelectedKey(key)}
                >
                  <ItemIcon size={20} strokeWidth={isSelected ? 2 : 1.5} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
