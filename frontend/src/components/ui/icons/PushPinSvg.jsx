import { forwardRef } from 'react';

/**
 * PushPin (thumbtack) — Material Symbols Rounded, vendored karena belum
 * tersedia di @material-symbols-svg@0.13.0. Path diambil dari
 * @material-symbols/svg-400 (viewBox 0 -960 960 960).
 * Didaftarkan di lib/iconMap.js via scripts/generate-icon-map.mjs (VENDORED).
 */
const PushPinSvg = forwardRef(function PushPinSvg(
  { size = 24, className, style, ...props },
  ref
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
      {...props}
    >
      <path d="m634-448 86 77v60H510v241l-30 30-30-30v-241H240v-60l80-77v-332h-50v-60h414v60h-50v332Zm-313 77h312l-59-55v-354H380v354l-59 55Zm156 0Z" />
    </svg>
  );
});

export { PushPinSvg };
export default PushPinSvg;
