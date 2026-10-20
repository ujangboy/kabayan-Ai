/**
 * Generator iconMap.js — baca ICONS dari src/lib/icons.js, lalu hasilkan
 * src/lib/iconMap.js berisi path SVG Material Symbols (style Rounded).
 *
 * Hanya weight 400 yang di-generate: UI tidak pernah memakai weight lain.
 * Path diekstrak langsung dari source package agar object `pathData` yang
 * berisi 14 varian per icon tidak ikut masuk ke bundle. Varian filled hanya
 * dihasilkan untuk icon yang memang memakai `fill` di UI.
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

// Icon yang tidak tersedia di package tapi di-vendor manual (path Material
// Symbols Rounded, viewBox 0 -960 960 960).
const VENDORED = {
  push_pin:
    'm634-448 86 77v60H510v241l-30 30-30-30v-241H240v-60l80-77v-332h-50v-60h414v60h-50v332Zm-313 77h312l-59-55v-354H380v354l-59 55Zm156 0Z',
};

// Icon yang memakai varian filled di UI. Tambahkan nama glyph di sini jika
// suatu saat memakai <Icon fill={1}>.
const FILLED_ICONS = new Set(['push_pin']);

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

function kebab(name) {
  return name.replaceAll('_', '-');
}

function extractPath(source, variant, name) {
  const block = source.match(
    new RegExp(`${variant}:\\s*\\{[\\s\\S]*?\\n\\s*\\}`, 'm')
  );
  if (!block) {
    console.error(`Varian ${variant} tidak ditemukan untuk ${name}`);
    process.exit(1);
  }
  const path = block[0].match(/"400":\s*"([^"]+)"/);
  if (!path) {
    console.error(`Path weight 400 tidak ditemukan untuk ${name} (${variant})`);
    process.exit(1);
  }
  return path[1];
}

const missing = uniq.filter(
  (n) => !VENDORED[n] && !existsSync(resolve(PKG_ICONS_DIR, `${kebab(n)}.js`))
);
if (missing.length > 0) {
  console.error('Icon file tidak ditemukan di package:', missing.join(', '));
  process.exit(1);
}

const paths = new Map();
for (const n of uniq) {
  if (VENDORED[n]) {
    paths.set(n, { regular: VENDORED[n], filled: VENDORED[n] });
    continue;
  }

  const source = readFileSync(resolve(PKG_ICONS_DIR, `${kebab(n)}.js`), 'utf8');
  paths.set(n, {
    regular: extractPath(source, 'regular', n),
    filled: FILLED_ICONS.has(n) ? extractPath(source, 'filled', n) : null,
  });
}

const lines = [];
lines.push('/**');
lines.push(' * AUTO-GENERATED — jangan edit manual.');
lines.push(' * Regenerate: node scripts/generate-icon-map.mjs');
lines.push(' *');
lines.push(' * Path Material Symbols Rounded weight 400, viewBox 0 -960 960 960.');
lines.push(' * Varian filled hanya tersedia untuk icon yang terdaftar di FILLED_ICONS.');
lines.push(' */');
lines.push('');
lines.push('/** Map nama glyph → path SVG (regular/filled). */');
lines.push('export const MATERIAL_ICONS = {');
for (const n of uniq) {
  const entry = paths.get(n);
  const filled = entry.filled == null ? '' : `, filled: ${JSON.stringify(entry.filled)}`;
  lines.push(`  ${JSON.stringify(n)}: { regular: ${JSON.stringify(entry.regular)}${filled} },`);
}
lines.push('};');
lines.push('');
lines.push(`/** Nama fallback bila glyph tidak dikenal. */`);
lines.push(`export const FALLBACK_ICON_NAME = ${JSON.stringify(fallback)};`);
lines.push('');
lines.push('/** Path fallback bila glyph tidak dikenal. */');
lines.push(`export const FALLBACK_ICON = MATERIAL_ICONS[FALLBACK_ICON_NAME].regular;`);
lines.push('');
lines.push('export const VALID_ICON_NAMES = new Set(Object.keys(MATERIAL_ICONS));');
lines.push('');

writeFileSync(OUT, lines.join('\n'));
console.log(`iconMap.js dihasilkan: ${uniq.length} icons -> ${OUT}`);
