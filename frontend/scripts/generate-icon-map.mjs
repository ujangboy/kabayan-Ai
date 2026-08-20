/**
 * Generator iconMap.js — baca ICONS dari src/lib/icons.js, lalu hasilkan
 * src/lib/iconMap.js yang memetakan nama glyph Material Symbols (snake_case)
 * ke SVG components dari @material-symbols-svg/react (style Rounded, weight 100-700,
 * varian regular + filled).
 *
 * Jalankan: node scripts/generate-icon-map.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_SRC = resolve(ROOT, 'src/lib/icons.js');
const OUT = resolve(ROOT, 'src/lib/iconMap.js');
const PKG_ICONS_DIR = resolve(
  ROOT,
  'node_modules/@material-symbols-svg/react/dist/rounded/icons'
);

const src = readFileSync(ICONS_SRC, 'utf8');
const match = src.match(/export const ICONS = \{([\s\S]*?)\n\};/);
if (!match) {
  console.error('Tidak menemukan ICONS di', ICONS_SRC);
  process.exit(1);
}

const nameRe = /'([a-z0-9_]+)'/g;
const names = [...new Set([...match[1].matchAll(nameRe)].map((m) => m[1]))];

const fbMatch = src.match(/export const FALLBACK_ICON = '([a-z0-9_]+)'/);
if (!fbMatch) {
  console.error('Tidak menemukan FALLBACK_ICON di', ICONS_SRC);
  process.exit(1);
}
const fallback = fbMatch[1];
names.push(fallback);
const uniq = [...new Set(names)];

function pascal(name) {
  return name
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function kebab(name) {
  return name.replaceAll('_', '-');
}

const missing = uniq.filter((n) => !existsSync(resolve(PKG_ICONS_DIR, `${kebab(n)}.js`)));
if (missing.length > 0) {
  console.error('Icon file tidak ditemukan di package:', missing.join(', '));
  process.exit(1);
}

const lines = [];
lines.push('/**');
lines.push(' * AUTO-GENERATED — jangan edit manual.');
lines.push(' * Regenerate: node scripts/generate-icon-map.mjs');
lines.push(' */');
for (const n of uniq) {
  const P = pascal(n);
  lines.push(
    `import { ${P}W100, ${P}W200, ${P}W300, ${P}W400, ${P}W500, ${P}W600, ${P}W700, ` +
      `${P}FillW100, ${P}FillW200, ${P}FillW300, ${P}FillW400, ${P}FillW500, ${P}FillW600, ${P}FillW700 } ` +
      `from '@material-symbols-svg/react/rounded/icons/${kebab(n)}';`
  );
}
lines.push('');
lines.push('/** Map nama glyph → komponen SVG per weight (regular/filled). */');
lines.push('export const MATERIAL_ICONS = {');
for (const n of uniq) {
  const P = pascal(n);
  lines.push(`  '${n}': {`);
  lines.push(`    regular: { 100: ${P}W100, 200: ${P}W200, 300: ${P}W300, 400: ${P}W400, 500: ${P}W500, 600: ${P}W600, 700: ${P}W700 },`);
  lines.push(`    filled: { 100: ${P}FillW100, 200: ${P}FillW200, 300: ${P}FillW300, 400: ${P}FillW400, 500: ${P}FillW500, 600: ${P}FillW600, 700: ${P}FillW700 },`);
  lines.push('  },');
}
lines.push('};');
lines.push('');
lines.push('/** Komponen fallback bila nama tidak dikenal. */');
lines.push(`export const FALLBACK_ICON = MATERIAL_ICONS['${fallback}'].regular[400];`);
lines.push('');
lines.push('export const VALID_ICON_NAMES = new Set(Object.keys(MATERIAL_ICONS));');
lines.push('');

writeFileSync(OUT, lines.join('\n'));
console.log(`iconMap.js dihasilkan: ${names.length} icons -> ${OUT}`);