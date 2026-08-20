import { forwardRef } from 'react';
import { MATERIAL_ICONS, FALLBACK_ICON } from '@/lib/iconMap';
import { cn } from '@/utils';

const FALLBACK_ICON_LOOKUP = 'help';

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
 * - weight      (number, default 400) — 100–700 (glyph berbeda tiap weight).
 * - fill        (number|boolean, default 0) — 0 = outline, 1/truthy = filled.
 * - grade       (number, default 0) — -50..200. Hanya relevan untuk font
 *                variable; tidak berdampak pada render SVG.
 * - opticalSize (number, default 24) — 20..48. Hanya relevan untuk font
 *                variable; tidak berdampak pada render SVG.
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
    grade = 0,
    opticalSize = 24,
    className,
    ariaLabel,
    ariaHidden = true,
    style,
    ...props
  },
  ref
) {
  const entry = MATERIAL_ICONS[name] || MATERIAL_ICONS[FALLBACK_ICON_LOOKUP];
  const w = String(weight);
  const isFilled = Boolean(fill);
  const pool = isFilled ? entry.filled : entry.regular;
  const Component = pool[w] || entry.regular[400] || FALLBACK_ICON;

  const accessible = Boolean(ariaLabel);

  return (
    <Component
      ref={ref}
      size={size}
      className={cn('select-none', className)}
      style={style}
      data-icon={name}
      data-fill={isFilled ? '1' : '0'}
      aria-hidden={accessible ? undefined : ariaHidden}
      role={accessible ? 'img' : undefined}
      title={accessible ? ariaLabel : undefined}
      {...props}
    />
  );
});

export { Icon };
export default Icon;