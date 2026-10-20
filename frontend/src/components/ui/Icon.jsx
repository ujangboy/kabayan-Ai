import { forwardRef } from 'react';
import {
  FALLBACK_ICON,
  FALLBACK_ICON_NAME,
  MATERIAL_ICONS,
} from '@/lib/iconMap';
import { cn } from '@/utils';

/**
 * Icon — wrapper terpusat untuk Google Material Symbols (style Rounded).
 *
 * Satu-satunya cara render icon di Kabayan AI. Nama icon WAJIB diambil dari
 * registry ICONS (src/lib/icons.js), jangan hardcode / import package langsung.
 *
 * Props:
 * - name        (string, wajib) — nama glyph Material Symbols (snake_case),
 *                mis. ICONS.actions.search.
 * - size        (number, default 24) — ukuran piksel. Minimum 20px untuk
 *                icon interaktif, 16px untuk dekoratif kecil.
 * - weight      (number, default 400) — hanya weight 400 yang di-bundle.
 *                Nilai lain tetap diterima agar API kompatibel.
 * - fill        (number|boolean, default 0) — 0 = outline, 1/truthy = filled.
 * - className   (string) — class tambahan (warna via text-*, ukuran via size).
 * - ariaLabel   (string) — label aksesibilitas untuk icon fungsional.
 * - ariaHidden  (boolean, default true) — sembunyikan dari screen reader
 *                untuk icon dekoratif.
 *
 * Aksesibilitas:
 * - Icon fungsional (tombol icon-only): berikan ariaLabel.
 * - Icon dekoratif: biarkan default (aria-hidden=true).
 */
const Icon = forwardRef(function Icon(
  {
    name,
    size = 24,
    weight = 400,
    fill = 0,
    className,
    ariaLabel,
    ariaHidden = true,
    style,
    ...props
  },
  ref
) {
  const entry = MATERIAL_ICONS[name] || MATERIAL_ICONS[FALLBACK_ICON_NAME];
  const isFilled = Boolean(fill);
  const path = isFilled ? entry.filled || entry.regular : entry.regular;
  const accessible = Boolean(ariaLabel);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="none"
      className={cn(
        'material-symbols select-none',
        `material-symbols_${name}`,
        className
      )}
      style={style}
      data-icon={name}
      data-weight={weight}
      data-fill={isFilled ? '1' : '0'}
      aria-hidden={accessible ? undefined : ariaHidden}
      role={accessible ? 'img' : undefined}
      {...props}
    >
      {accessible && <title>{ariaLabel}</title>}
      <path d={path || FALLBACK_ICON} fill="currentColor" />
    </svg>
  );
});

export { Icon };
export default Icon;
