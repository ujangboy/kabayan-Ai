# Cara Rilis Kabayan Pintar (Otomatis)

Rilis versi aplikasi dijalanhan release-please (GitHub Action, manifest
mode). Sumber kebenaran versi = `version.txt` di root repo; backend
membacanya (`settings_service.APP_VERSION`) dan `frontend/package.json`
disinkronkan lewat konfigurasi.

## Alur

1. **Kembangkan dengan commit Conventional** ke `main`:
   - `feat: ...` → naik **minor** (0.1.1 → 0.2.0)
   - `fix: ...` → (tetap minor sesuai aturan `always-bump-minor`)
   - `feat!:` / `BREAKING CHANGE:` → naik major
2. **Release PR dibuka otomatis** oleh workflow `.github/workflows/release-please.yml`
   setiap push ke `main` — isinya: bump `version.txt`,
   `frontend/package.json`, `frontend/package-lock.json`, dan tulis
   `CHANGELOG.md`.
3. **Merge Release PR** → otomatis: tag `vX.Y.Z`, GitHub Release, dan
   CHANGELOG final.
4. Halaman Pengaturan > Tentang menampilkan versi dari `version.txt`
   (tidak perlu edit manual lagi).

## File penting

| File | Peran |
|---|---|
| `version.txt` | sumber versi (root) |
| `release-please-config.json` | aturan bump + extra-files JSON frontend |
| `.release-please-manifest.json` | versi terakhir yang dirilis |
| `docs/CHANGELOG.md` | — `CHANGELOG.md` dibuat oleh release-please di root |

## Aturan

- JANGAN edit `version.txt` / `frontend/package.json` versi secara manual —
  biarkan Release PR yang mengubahnya (guard: `tests/test_version_consistency.py`).
- Commit yang tidak Conventional (`chore`, `docs`, `test`) tidak memicu
  bump, tapi Release PR tetap diperbarui jika sudah berjalan.
