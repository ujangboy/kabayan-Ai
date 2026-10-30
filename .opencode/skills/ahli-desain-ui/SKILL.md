---
name: ahli-desain-ui
description: Panduan mendesain dan membangun antarmuka (UI/UX) yang konsisten, aksesibel, dan reusable di frontend repo kabayan_pintar (React 19 + Tailwind + Radix UI)
---

# SKILL: Ahli Desain UI

Ringkasan
---
Panduan praktis untuk merancang dan mengimplementasikan UI di repo `kabayan_pintar`. Fokus pada konsistensi visual, komponen yang dapat dipakai ulang, aksesibilitas, dan keselarasan dengan design tokens yang sudah ada.

Ruang lingkup
---
- Workspace-scoped: berlaku untuk `frontend/` repo ini (`kabayan_pintar`).
- Stack saat ini: React 19, Vite, Tailwind CSS v3, Radix UI primitives, framer-motion, zustand (state), @tanstack/react-query (data), tiptap (rich text editor), i18next (multi-bahasa), react-router-dom v7.

Kapan dipakai
---
- Membuat halaman/komponen UI baru (mis. `frontend/src/pages`, `frontend/src/components`).
- Mengubah layout, tema, warna, tipografi, atau spacing.
- Memperbaiki inkonsistensi visual antar komponen.
- Menambah dukungan aksesibilitas (keyboard nav, ARIA, kontras).

Input yang dibutuhkan
---
- Tujuan layar/komponen dan user story singkat.
- Referensi komponen serupa yang sudah ada di `frontend/src/components` atau `frontend/src/layouts`.
- Constraint: bahasa (i18n) dan responsivitas (mobile/desktop).

Output yang diharapkan
---
- Komponen React yang reusable, menerima props yang jelas, dan pakai `clsx` + `tailwind-merge`/`class-variance-authority` untuk variant styling.
- Penyesuaian terhadap design tokens Tailwind (`tailwind.config.js`) dan CSS global (`src/index.css`).
- State lokal via `zustand` bila perlu; data fetch lewat `@tanstack/react-query` + `services/`.
- Catatan aksesibilitas & i18n (jangan hardcode teks, gunakan `i18n`).

Workflow langkah-demi-langkah
---
1. Audit & Rujukan
   - Cari komponen serupa di `frontend/src/components` dan `frontend/src/layouts` agar tidak duplikat.
   - Cek `tailwind.config.js` untuk token warna/spacing/typography yang tersedia.

2. Rencanakan Struktur
   - Tentukan apakah ini page (`src/pages`) atau reusable component (`src/components`).
   - Tentukan variant (size, intent/color) pakai `class-variance-authority` bila ada banyak state visual.
   - Gambar alur state: mana yang lokal (useState/zustand) vs mana yang dari server (react-query).

3. Implementasi
   - Gunakan Radix UI primitives (`@radix-ui/react-*`) untuk dialog, tabs, dropdown, tooltip, progress, separator — jangan buat dari nol.
   - Styling pakai Tailwind utility + `clsx`; gabungkan class dengan `tailwind-merge` (`cn()` helper bila ada).
   - Animasi pakai `framer-motion` untuk transisi halus (modal, list).
   - Semua teks user-facing lewat `i18n` (react-i18next), jangan string literal.

4. Aksesibilitas & Responsif
   - Pastikan kontras warna cukup, focus ring terlihat, dan navigasi keyboard berfungsi (Radix sudah menyediakan sebagian besar).
   - Uji breakpoint mobile & desktop (Tailwind responsive prefixes).

5. Integrasi Data
   - Fetch/mutate lewat `services/` + `react-query`; hindari fetch langsung di component tanpa abstraction.
   - Tampilkan loading/error/empty state yang jelas.

6. Verifikasi
   - Jalankan `npm run lint` (oxlint) dan `npm run build` di folder `frontend`.
   - Jalankan `npm run dev` untuk cek visual secara manual bila perlu.

Kriteria kualitas
---
- Komponen konsisten dengan yang sudah ada (warna, radius, spacing, tipografi).
- Tidak ada duplikasi komponen yang seharusnya dipakai ulang.
- Lulus `oxlint` dan `vite build` tanpa error.
- Mendukung i18n dan aksesibilitas dasar (keyboard + ARIA).
- State dipisah dengan benar: lokal vs server (react-query) vs global (zustand).

Decision points
---
- Komponen sering dipakai ulang & punya banyak variant? -> buat di `components/` dengan `cva`.
- Butuh interaksi复杂 (dialog, popover)? -> pakai Radix, jangan custom raw.
- Data dari API? -> lewat `services/` + `react-query`, jangan axios langsung di JSX.
- Teks statis? -> selalu lewat `i18n`.

Artefak yang dibuat
---
- Komponen di `frontend/src/components/<Nama>.jsx` atau page di `frontend/src/pages/<Nama>Page.jsx`.
- Penyesuaian token di `tailwind.config.js` / `src/index.css` bila diperlukan.
- Key i18n baru di `frontend/src/i18n`.

Contoh prompt untuk agen
---
- "Gunakan skill `ahli-desain-ui`: buat komponen `ExamCard` yang menampilkan soal, status, dan tombol aksi dengan variant size sm/lg, pakai Radix + Tailwind."
- "Perbaiki halaman `FlashcardReviewPage` agar responsif di mobile dan konsisten dengan token warna di `tailwind.config.js`."
- "Tambahkan dialog konfirmasi hapus di `DashboardPage` pakai Radix Dialog + framer-motion, dengan teks lewat i18n."
