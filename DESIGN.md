---
version: 1.0
name: kabayan-agent-design-system
description: >
  Design system untuk frontend kabayan_agent — asisten belajar berbasis AI.
  Tema gelap (dark-first) dengan satu aksen ungu (violet #7C3AED) yang digunakan
  hemat: brand mark, primary CTA, focus ring, dan link. Elevasi dibangun dari
  "surface ladder" (base → rail → surface → card → card-hover) dipadukan dengan
  hairline border, bukan drop-shadow tebal. Icon menggunakan Google Material
  Symbols; micro-interaction & transisi pakai framer-motion (dengan
  MotionConfig reducedMotion="user"). Prinsip diadaptasi dari referensi
  awesome-design-md: Linear (single accent, surface ladder, hairline), Raycast
  (dark chrome, hairline depth, radius rapat), Cursor (sistem button/radius konsisten).

colors:
  primary: "#7C3AED"
  primary-hover: "#8B5CF6"
  primary-light: "#A78BFA"
  on-primary: "#FFFFFF"
  base: "#0E1520"
  rail: "#0B111B"
  surface: "#121A27"
  sidebar: "#121A27"
  card: "#1A2332"
  card-hover: "#212D40"
  border: "#263349"
  text: "#EDF1F7"
  text-secondary: "#8C97A9"
  text-muted: "#5C6675"
  success: "#22C55E"
  danger: "#EF4444"
  warning: "#F6B93B"
  info: "#29A8DF"
  accent-blue: "#29A8DF"
  accent-purple: "#8B5CF6"
  accent-teal: "#10B981"
  accent-pink: "#EC4899"
  overlay: "#000000"

typography:
  display-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.015em
  heading:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  subhead:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
  mono:
    fontFamily: "JetBrains Mono"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5

rounded:
  btn: 8px
  input: 8px
  card: 12px
  dialog: 16px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    backgroundImage: "linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    padding: 10px 16px
    height: 40px
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    borderColor: "{colors.border}"
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    padding: 10px 16px
    height: 40px
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    padding: 10px 16px
    height: 40px
  button-danger:
    backgroundColor: "{colors.danger}"
    opacity: 0.1
    textColor: "{colors.danger}"
    borderColor: "{colors.danger}"
    borderOpacity: 0.2
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    padding: 10px 16px
    height: 40px
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    borderColor: "{colors.border}"
    padding: 20px
    shadow: "0 2px 8px rgba(0,0,0,0.25)"
  card-hoverable:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    borderColor: "{colors.border}"
    padding: 20px
    shadow: "0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.15)"
  modal:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    borderColor: "{colors.border}"
    shadow: "0 20px 40px rgba(0,0,0,0.5)"
  text-input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    borderColor: "{colors.border}"
    typography: "{typography.body}"
    rounded: "{rounded.input}"
    padding: 10px 16px
    height: 42px
  badge:
    backgroundColor: "{colors.primary}"
    opacity: 0.15
    textColor: "{colors.primary-light}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  tooltip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    rounded: "{rounded.btn}"
    padding: 6px 10px

---

# DESIGN.md — kabayan_agent Frontend

Panduan otoritatif untuk membangun & memodifikasi UI frontend kabayan_agent.
Ikuti token & komponen di sini agar seluruh halaman konsisten. Semua komponen
ada di `frontend/src/components/ui/` (Button, Card, Modal, Input, Badge, Tooltip,
Spinner, Skeleton, ConfirmDialog) — **gunakan komponen tersebut, jangan buat
button/card/modal dari nol**.

## 1. Visual Theme & Atmosphere
Aplikasi tutor AI dengan nuansa "premium dark, tenang, fokus belajar". Kanvas
gelap dengan satu aksen violet yang dipakai hemat. Tidak ada tema terang.
Kedalaman dibangun dari surface ladder + hairline, bukan shadow tebal. Sedikit
glow ungu diperbolehkan pada elemen primer (CTA, focus ring, active state).

## 2. Color Palette & Roles
- **Primary violet `#7C3AED`** — satu-satunya aksen kromatik. Dipakai pada:
  brand mark (logo), primary CTA, focus ring, link, active nav indicator.
  Hover `#8B5CF6`, light `#A78BFA`.
- **Surface ladder** (untuk hierarki/elevasi): `base #0E1520` (canvas) →
  `rail #0B111B` (nav rail) → `surface #121A27` (topbar/sidebar) →
  `card #1A2332` (kartu) → `card-hover #212D40` (hover).
- **Text**: `text #EDF1F7` (utama), `text-secondary #8C97A9` (meta),
  `text-muted #5C6675` (disabled/footnote).
- **Semantic**: `success #22C55E`, `danger #EF4444`, `warning #F6B93B`,
  `info #29A8DF` — untuk status, notifikasi, validasi.
- **Accent (data-viz only)**: `accent-blue/purple/teal/pink` — HANYA untuk
  chart/visualisasi data & badge status, BUKAN chrome (button/nav/text).
- **Overlay**: `black/60` + `backdrop-blur` untuk scrim modal.

## 3. Typography
- Font: **Inter** (body/display) + **JetBrains Mono** (code).
- Display & heading pakai **negative letter-spacing** (-0.01em s/d -0.02em).
- Hierarchy: display-xl (40/700) untuk hero, heading (20/600) untuk judul
  kartu/bagian, body (14/400) default, caption (12) untuk meta.
- Jangan hardcode string UI — selalu lewat `i18n` (`t()`).

## 4. Components
Semua di `src/components/ui/`:
- **Button** (`variant`: primary/secondary/ghost/danger/outline/link;
  `size`: sm/md/lg/icon; `loading`; `asChild` via Radix Slot). Radius `btn` 8px,
  press `scale-[0.97]`, focus ring ungu. Submit button wajib `type="submit"`.
- **Card** (+ CardHeader/Title/Content/Footer). `bg-card border border-border
  rounded-card`. `hoverable` menambah shadow + `-translate-y-0.5`.
- **Modal** (Radix Dialog + framer-motion): `open`, `onClose`, `title`,
  `footer`, `size`. Otomatis focus-trap, scroll-lock, Esc, `aria-modal`.
- **ConfirmDialog** — modal konfirmasi hapus (pakai Modal + Button).
- **Input / Textarea / Select** — `input-base`, state `error`/`disabled`.
- **Badge** (`variant` primary/success/danger/warning/info/secondary).
- **Tooltip** (Radix) — untuk tombol icon-only.
- **Spinner / Skeleton** — loading state.
- **Domain components** — komponen spesifik halaman hasil ekstraksi revamp berada di
   `src/components/<domain>/` (mis. `chat/`, `flashcard/`, `exam/`, `studyplan/`, `materi/`,
   `quiz/`, `notebook/`, `layout/`). Tujuannya menjaga `src/pages/*.jsx` di bawah ~350 baris.
   Semua komponen ini murni presentasional dan **hanya memakai token/utilitas yang sudah ada**
   — tidak ada token warna/spacing/radius baru yang diperkenalkan selama revamp. `IconRail`
   (`src/components/layout/IconRail.jsx`)
  adalah nav rail kiri tunggal (item: Dashboard, Chat, Subjects, Materi, Notebook,
  Flashcard, Quiz, Exam Analyzer, Study Plan, Settings) dengan indikator aktif
  framer-motion (`layoutId="nav-active-indicator"`).

## 5. Layout & Spacing
- Base unit 4px. Spacing token: xxs 4 / xs 8 / sm 12 / md 16 / lg 24 / xl 32.
- Max content lebar ~1280px; grid kartu 3-up (desktop) → 2-up (tablet) → 1-up (mobile).
- Section rhythm: jarak antar-bagian `lg`/`xl`; tidak perlu whitespace ekstrem.
- Radius: button/input 8px, card 12px, dialog 16px, pill 999px. Konsisten.

## 6. Depth & Elevation
| Level | Treatment | Use |
|---|---|---|
| 0 | base canvas | background halaman |
| 1 | card + hairline border | kartu default |
| 2 | card-hover + shadow-card-hover | kartu hover / highlighted |
| 3 | gradient-primary + shadow-btn-primary | primary CTA, logo |
| focus | 2px ring primary/50 | elemen fokus keyboard |

Hindari shadow tebal di luar token (`shadow-modal` hanya untuk dialog).

## 7. Motion (framer-motion)
- Page transition: fade + slide-y 8px (`AppLayout`).
- Modal: overlay fade + content scale 0.96→1, y 8→0.
- Button: `active:scale-[0.97]` (press). Card hover: lift halus.
- List/grid: stagger entrance (`staggerChildren`).
- **Wajib**: `MotionConfig reducedMotion="user"` di root agar menghormati
  preferensi `prefers-reduced-motion`.

## 8. Icons
- **Google Material Symbols** (style **Rounded**) via `@material-symbols-svg/react`.
- Satu-satunya cara render: komponen `<Icon />` dari `@/components/ui` dengan
  prop `name` (wajib). Nama glyph WAJIB diambil dari registry semantik
  `ICONS` (`src/lib/icons.js`) — jangan hardcode string atau import package
  langsung.
- Registry `ICONS` mengelompokkan glyph per fungsi: `nav`, `actions`,
  `status`, `empty`, `files`, `learning`, `ui`, `editor`, `media`,
  `communication`.
- Prop `<Icon />`: `name`, `size` (default 24; minimum 20px icon interaktif,
  16px dekoratif kecil), `weight` (100–700, default 400), `fill` (0/1),
  `grade`, `opticalSize`, `className`, `ariaLabel`, `ariaHidden` (default true).
- Aksesibilitas: icon fungsional (tombol icon-only) wajib `ariaLabel`; icon
  dekoratif dibiarkan `aria-hidden` default.
- Peta glyph → komponen SVG di-generate ke `src/lib/iconMap.js`
  (AUTO-GENERATED, jangan edit manual; regenerate via
  `node scripts/generate-icon-map.mjs`). Nama Material Symbols 2024 tidak
  memakai suffix lama (`expand_more` → `keyboard_arrow_down`, `help_outline`
  → `help`, `star_border` → `star`, dst). Fallback global: `help`.

## 9. Do's and Don'ts
### Do
- Pakai violet HANYA sebagai aksen tunggal (brand/CTA/focus/link).
- Bangun elevasi dari surface ladder + hairline, bukan shadow tebal.
- Gunakan komponen `ui/` yang sudah ada; teruskan prop via `className` + `cn()`.
- Semua modal pakai `Modal`/`ConfirmDialog` (Radix) — jangan `fixed inset-0` manual.
- String UI selalu lewat `i18n`.
- Hormati `prefers-reduced-motion` (sudah dibungkus `MotionConfig`).

### Don't
- Jangan perkenalkan warna aksen kedua di chrome (button/nav/text).
- Jangan hardcode hex di JSX; gunakan token Tailwind (`bg-card`, `text-text-secondary`, dll).
- Jangan buat modal hand-rolled tanpa focus-trap/scroll-lock.
- Jangan pill-round CTA (selalu radius 8px kecuali badge/pill).
- Jangan tinggalkan tombol tanpa handler / `disabled` yang jelas.
- Jangan hardcode teks user-facing (selalu `t()`).

## 10. Responsive
- Breakpoint: mobile <768px (1-up), tablet 768–1024px (2-up), desktop >1024px (3-up).
- Touch target tombol ≥40px tinggi.
- Nav rail tetap 56px (w-14) di semua breakpoint; sidebar kanan bisa collapse.

## 11. Navigation & Wayfinding (PRD-01)
### Breadcrumb
- Komponen: `src/components/layout/Breadcrumbs.jsx` (auto-detect route, bukan props).
- Hierarki: akar Dashboard → seksi (`nav.*`) → entitas deep (`subjects/:id`, `flashcard/review`).
- `maxItems` default 4; bila lebih, segmen tengah dikolaps jadi "…" (non-link, `breadcrumb.more`).
- Crumb terakhir = halaman aktif: `span` non-link + `aria-current="page"`, font-medium.
- Icon crumb opsional 13px `text-primary-light`; separator `chevron_right` `text-text-muted/50`.
- Sembunyi di layar <640px (`hidden sm:flex`).
### Back Navigation
- Hook: `src/hooks/useBackNavigation.js` — `resolveBackDestination()` adalah satu-satunya sumber
  logika tujuan back; prioritas: `?from=` param → `document.referrer` (same-origin) → route induk → fallback `/dashboard`.
- Komponen: `src/components/layout/BackButton.jsx` — icon `arrow_back`, label dinamis
  `backButton.to` ("Kembali ke {{page}}"), sembunyi otomatis bila tujuan = fallback
  (kecuali `label` kustom di-override). Posisi: kiri atas header halaman.
- Jangan pakai `window.history.back()`; selalu lewat hook/komponen ini.
### Keyboard Shortcuts
- Modal: `src/components/KeyboardShortcuts.jsx` (Radix `Modal`, grid 2 kolom).
- `?` toggle; ⌘K / ⌘/ buka command search; ⌘N chat baru; `G` lalu `D`/`C` navigasi cepat;
  `1-9` quick nav (dashboard, chat, subjects, materi, notebook, flashcard, quiz, exam, study-plan).
- Shortcut nonaktif saat fokus di input/textarea/contenteditable (kecuali kombinasi ⌘/Ctrl).
### Mobile Drawer (ContextSidebar)
- `useSwipeGesture`: swipe kanan dari tepi kiri layar (<24px, `window` listener, mobile saja)
  buka drawer; swipe kiri di dalam drawer tutup.
- Threshold jarak 50px DAN kecepatan ≥500px/s; gerakan dominan vertikal diabaikan
  (`touch-action: pan-y` agar scroll tetap mulus).
### Settings
- Quick settings (bahasa + notifikasi + link pengaturan lengkap) di TopBar;
  full settings tetap di IconRail bawah (nav.settings).

## 12. Agent Prompt Guide
Warna cepat: violet `#7C3AED`, canvas `#0E1520`, card `#1A2332`, border `#263349`,
text `#EDF1F7`. Komponen: `import { Button, Card, Modal, Input, Badge } from '@/components/ui'`.
Prompt contoh: "Buat kartu pakai `<Card hoverable>` dengan `<Button variant=primary>`,
ikuti radius 12px & token warna di DESIGN.md."
