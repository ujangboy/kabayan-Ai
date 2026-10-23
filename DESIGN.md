---
version: 3.0
name: kabayan-agent-design-system
description: >
  Design system Kabayan AI v3 — "Meja Belajar". Kanvas sage sejuk, tinta hijau
  hutan, aksen pandan, dan kunyit untuk momen penting. Tipografi dua peran:
  Plus Jakarta Sans untuk judul, Inter untuk UI dan bacaan. Motion ringan,
  reduced-motion aware, dan navigasi datar yang mengikuti ritme harian.
---

# Design System & UI Specification — "Meja Belajar"

## 1. Overview & Core Philosophy

Kabayan AI adalah ruang belajar harian, bukan dashboard metrik. Antarmuka
harus terasa tenang, hangat, dan langsung bisa dipakai.

Prinsip utama:
- **Daily-first:** hal yang dibutuhkan hari ini (lanjut belajar, kartu jatuh
  tempo, rencana) muncul sebelum angka perpustakaan.
- **Calm contrast:** 90% permukaan netral-hijau, 10% aksen pandan; kunyit hanya
  untuk penanda momen/streak, bukan chrome.
- **Two-role typography:** judul tegas dan bersahabat, body netral dan mudah
  dibaca panjang.
- **Flat navigation:** tiga kelompok (Hari ini / Belajar / Koleksi), tanpa
  submenu dinamis per mata kuliah atau deck. Konteks dikelola di halaman.
- **Adaptive theming:** Light & Dark via CSS variables tanpa FOUC.

## 2. Color Palette & Adaptive Tokens

Token didefinisikan di `frontend/src/index.css` dan dipetakan ke Tailwind di
`frontend/tailwind.config.js`.

| Token | Light (`:root`) | Dark (`.dark`) | Peruntukan |
| :--- | :--- | :--- | :--- |
| `--bg-base` | `#f7f9f5` | `#101815` | Kanvas halaman |
| `--bg-subtle` | `#edf2eb` | `#17211d` | Sidebar, rail, input lembut |
| `--bg-surface` | `#ffffff` | `#18231e` | Card, dialog, panel |
| `--popover` | `#ffffff` | `#1e2a25` | Dropdown, tooltip, menu |
| `--border-subtle` | `rgba(20,34,29,.08)` | `rgba(236,245,240,.07)` | Border default 1px |
| `--border-strong` | `rgba(20,34,29,.15)` | `rgba(236,245,240,.14)` | Border hover/aktif |
| `--text-primary` | `#14221d` | `#ecf5f0` | Heading, teks utama |
| `--text-secondary` | `#5c6b64` | `#a9b8b0` | Subtitle, helper |
| `--text-muted` | `#8b9891` | `#72827a` | Caption, meta, disabled |
| `--accent` | `#0d7a58` Pandan | `#34d399` Pandan terang | CTA, link, focus, aktif |
| `--accent-hover` | `#0a6247` | `#6ee7b7` | Hover aksen |
| `--accent-light` | `#0a6247` | `#a7f3d0` | Teks aksen di permukaan terang/gelap |
| `--sun` | `#e8a23a` Kunyit | `#fbbf24` | Streak, highlight, aksen logo |

Aturan 60-30-10:
- **60%** `bg-base` — kanvas.
- **30%** `bg-subtle` / `bg-surface` — sidebar, kartu, panel.
- **10%** `accent` — CTA, link, focus ring, indikator aktif. Tidak untuk dekorasi.
- `sun` dipakai sangat hemat (satu highlight per layar).

Status: `success #15803d`, `danger #b91c1c`, `warning #b45309`,
`info #0369a1` (versi terang di dark). Hanya untuk status/validasi.

## 3. Typography Hierarchy

- **Display / H1:** Plus Jakarta Sans Variable, `text-3xl`–`text-4xl`,
  `font-extrabold`, `tracking-[-0.04em]`, `leading-tight`.
- **Heading / H2-H3:** Plus Jakarta Sans Variable, `text-xl`–`text-2xl`,
  `font-bold`, `tracking-[-0.03em]`.
- **Body & UI:** Inter Variable, `text-sm`–`text-base`, `leading-relaxed`
  (1.6–1.72). Fitur `cv02/cv03/cv04/cv11` aktif.
- **Caption / Meta:** Inter, `text-[10px]`–`text-xs`, `text-text-muted`;
  label seksi memakai `font-display`, uppercase, tracking `0.14em`.
- **Code / teknis:** Monaspace Neon, `font-mono`.

Maksimal dua weight per komponen. Jangan memakai monospace untuk body, prose AI,
atau NoteEditor — gunakan Inter agar bacaan panjang nyaman.

## 4. Components & Layout Rules

- **Nested card di dalam card dilarang.** Pakai `border-t border-border` atau
  perbedaan surface.
- **Radius:** card `16px` (`rounded-card`), button/input `10px`
  (`rounded-btn`/`rounded-input`), dialog `20px` (`rounded-dialog`), pill penuh.
- **Elevation:** dark `shadow-none`; light `shadow-card` berlapis sangat halus
  (`0 1px 2px` + ambient lembut). Hover kartu hanya lift 2px + border strong,
  tanpa mengubah warna permukaan.
- **Iconography:** Material Symbols rounded; 16px inline, 18–20px action,
  24px header.
- **Spacing:** kelipatan 4/8px; section `space-y-8`, padding halaman
  `p-5 md:p-8 lg:p-10`, kartu `p-4`–`p-6`.
- **Sidebar:** lebar 264px, rail 76px. Kelompok navigasi statis, item 40px,
  indikator aktif berupa pill `primary/10` + garis kiri 3px. Tanpa pencarian
  duplikat (pencarian global ada di TopBar) dan tanpa meter penyimpanan
  duplikat (ada di Pengaturan → Data).
- **TopBar:** tinggi 64px, pencarian global sebagai fokus; di mobile menjadi
  ikon pencarian agar tema/avatar tetap terlihat.

## 5. Brand

- **Mark:** huruf K dari dua sapuan + bintang kunyit di kanan atas. Latar
  gradien pandan `#148a63 → #084f3d`, radius 12/40.
- **Wordmark:** `kabayan` Plus Jakarta Sans extrabold, tracking rapat, dengan
  badge `AI` kecil berwarna pandan.
- **Favicon:** `public/favicon.svg`, versi mark yang sama.
- Logo dipakai di sidebar, drawer mobile, TopBar mobile, empty state Chat, dan
  About.

## 6. Motion & Interaction Standards

Token terpusat di `frontend/src/lib/motion.js`:
`easeOut [0.16,1,0.3,1]`, `pageTransition 280ms`, `fadeUp 320ms`,
`staggerContainer 45ms`, `springWave`, `springLift`.

- **Page transition:** fade + naik 8px, 280ms.
- **Hover & press:** 150–200ms ease-out; press `scale-[0.985]`.
- **Modal/popover:** opacity + scale 0.97–1, 200ms.
- **List:** stagger 45ms; hanya `transform` dan `opacity`.
- **Active nav:** indikator meluncur dengan spring lembut (`layoutId`).
- `MotionConfig reducedMotion="user"` wajib aktif (sudah di `AppLayout`).
- Tidak ada glow berlebihan, bounce, atau animasi yang menghalangi input.

## 7. Do's and Don'ts

### Do
- Pakai token semantik (`bg-base`, `bg-surface`, `border-border`, `text-text`).
- Pertahankan aksen pandan untuk interaksi; kunyit sangat hemat.
- Bangun elevasi dari surface ladder + hairline border.
- Gunakan komponen `ui/`; semua modal via `Modal`/`ConfirmDialog`.
- Uji light & dark, desktop & 390px mobile, serta `prefers-reduced-motion`.

### Don't
- Gradien dekoratif penuh layar, glow tebal, atau backdrop-blur pada kartu isi.
- Nested card dengan border/shadow ganda.
- Hardcode warna slate/zinc/hex langsung di komponen.
- Animasi layout-shifting (`width`/`height`/`top`/`left`) selain sidebar/drawer
  yang memang perlu.
- Monospace untuk teks bacaan panjang.
