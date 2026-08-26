---
version: 2.0
name: kabayan-agent-design-system
description: >
  Design system Kabayan AI — Modern Minimalist & Polish. Berakar pada palet
  Zinc netral (60% base / 30% surface / 10% aksen), border hairline 1px,
  tanpa drop-shadow tebal, dan motion berbasis physics 60 FPS.
  Referensi gaya: Linear, Vercel/Geist, shadcn-ui.
---

# Design System & UI Specification — Modern Minimalist & Polish

## 1. Overview & Core Philosophy

Standar UI dan panduan interaksi untuk menghapus karakteristik "generic AI slop"
(gradien jenuh, nested cards, glow tebal, animasi kaku).

Prinsip utama:
- **Functional Minimalism:** 90% warna netral (Zinc), 10% aksen interaktif (teal).
- **Micro-precision:** Border 1px presisi, tipografi terkalibrasi, grid kelipatan 4px/8px.
- **Natural Motion:** Animasi berbasis physics (spring), 60 FPS, GPU-accelerated
  (hanya `transform` + `opacity`).
- **Adaptive Theming:** Light & Dark mode via CSS Variables tanpa FOUC
  (script init di `index.html`, class `.dark` pada `<html>`).

## 2. Color Palette & Adaptive Tokens

Semantic tokens berbasis CSS Variables (didefinisikan di `src/index.css`,
dipetakan ke Tailwind di `tailwind.config.js`):

| Token | Light (`:root`) | Dark (`.dark`) | Peruntukan |
| :--- | :--- | :--- | :--- |
| `--bg-base` | `#ffffff` | `#09090b` Zinc-950 | Background halaman |
| `--bg-subtle` | `#f4f4f5` Zinc-100 | `#18181b` Zinc-900 | Sidebar, rail, container |
| `--bg-surface` | `#ffffff` | `#131316` | Card, dialog, panel |
| `--popover` | `#ffffff` | `#1c1c1f` | Dropdown, tooltip, menu |
| `--border-subtle` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.08)` | Border default 1px |
| `--border-strong` | `rgba(0,0,0,0.16)` | `rgba(255,255,255,0.16)` | Border hover/aktif |
| `--text-primary` | `#09090b` | `#fafafa` Zinc-50 | Heading, teks utama |
| `--text-secondary` | `#71717a` Zinc-500 | `#a1a1aa` Zinc-400 | Subtitle, helper |
| `--text-muted` | `#a1a1aa` | `#71717a` | Disabled, footnote |
| `--accent` | `#0d9488` Teal-600 | `#14b8a6` Teal-500 | Brand / CTA (satu-satunya aksen) |
| `--accent-hover` | `#0f766e` | `#2dd4bf` | Hover state aksen |

Aturan 60-30-10:
- **60%** `bg-base` — kanvas halaman.
- **30%** `bg-subtle` / `bg-surface` — sidebar, kartu, panel.
- **10%** `accent` teal — CTA primer, link, focus ring, indikator aktif. Tidak untuk dekorasi.

Warna semantik status tetap ada dan hemat: `success #22c55e`, `danger #ef4444`,
`warning #f59e0b`, `info #38bdf8` — hanya untuk status/notifikasi/validasi.
Badge mata kuliah boleh multi-hue (functional color-coding), bukan chrome.

## 3. Typography Hierarchy

Font: **Monaspace Neon** (self-hosted, weight 400/500/600/700) — dipakai global
untuk UI, prose AI, editor, dan kode (identitas "neon coding"; ligatur aktif di
kode, dimatikan di prose panjang demi keterbacaan).

- **Display / H1:** `text-3xl`–`text-4xl`, `font-semibold`, `tracking-headline` (-0.02em), `leading-tight`
- **Heading / H2-H3:** `text-xl`–`text-2xl`, `font-medium`, `tracking-headline`
- **Body:** `text-sm`–`text-base`, `font-normal`, `leading-relaxed` (1.55)
- **Caption / Meta:** `text-xs`, `font-normal`, warna `text-secondary`

Maksimal 2 font weight per komponen.

## 4. Components & Layout Rules

- **Nested card di dalam card dilarang keras.** Pakai `border-t border-border`
  atau perbedaan surface untuk memisahkan data.
- **Radius:** `rounded-lg` (8px) card · `rounded-md` (6px) input/dropdown ·
  `rounded-xl` (12px) modal · `rounded-full` khusus badge & avatar.
- **Elevation:**
  - Dark Mode: `shadow-none` — elevasi dari kontras surface + border 1px.
  - Light Mode: `shadow-card = 0 1px 2px rgba(0,0,0,0.05)` (sangat halus).
- **Iconography:** Material Symbols rounded, stroke seragam. Ukuran standar:
  16px inline, 20px action button, 24px header/nav.
- **Spacing:** kelipatan 4px/8px; beri ruang (whitespace) lega antar-section —
  section padding minimum `p-5`, gap antar-kartu `gap-3`–`gap-4`.

## 5. Motion & Interaction Standards

Library: framer-motion (tokens terpusat di `src/utils/index.js`).

- **Hover & Press tombol:** `transition-[background-color,color,border-color,transform] duration-150 ease-out`,
  active `scale-[0.98]`.
- **Modal / Popover / Dropdown:**
  initial `{ opacity: 0, scale: 0.96, y: -4 }` → animate `{ opacity: 1, scale: 1, y: 0 }`,
  spring `{ stiffness: 400, damping: 30 }` (`SPRING`).
- **List rendering:** stagger `staggerContainer()` default **0.04s** antar-item.
- **Performance rule:** hanya animasikan `transform` & `opacity`. Dilarang
  menganimasi `height`, `width`, `margin`. Progress bar pakai `scaleX`.
- `MotionConfig reducedMotion="user"` wajib aktif (sudah di `AppLayout`).

## 6. Do's and Don'ts

### Do
- Pakai token semantik (`bg-base`, `bg-surface`, `border-border`, `text-text`) — bukan hex/palette mentah.
- Aksen teal hanya untuk interaksi (CTA/link/focus/aktif).
- Bangun elevasi dari surface ladder + hairline border.
- Gunakan komponen `ui/` yang ada; semua modal via `Modal`/`ConfirmDialog`.

### Don't
- Gradien dekoratif, glow shadow, backdrop-blur pada kartu konten.
- Nested card dengan border/shadow ganda.
- Hardcode warna slate/zinc/hex langsung di komponen.
- Animasi layout-shifting (`width`/`height`/`top`/`left`).
