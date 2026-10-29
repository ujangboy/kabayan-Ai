"""Test konsistensi sumber versi aplikasi (release-please).

Satu sumber kebenaran: version.txt di root. Di-sync oleh release-please
bersama frontend/package.json + package-lock.json; backend membacanya
lewat settings_service.APP_VERSION.
"""
import json
from pathlib import Path

from app.services.settings_service import APP_VERSION

ROOT = Path(__file__).resolve().parents[1]


def test_sumber_versi_saling_sinkron():
    version_txt = (ROOT / "version.txt").read_text(encoding="utf-8").strip()
    package_json = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))["version"]
    package_lock = json.loads((ROOT / "frontend" / "package-lock.json").read_text(encoding="utf-8"))
    manifest = json.loads((ROOT / ".release-please-manifest.json").read_text(encoding="utf-8"))["."]

    assert version_txt == APP_VERSION == package_json == manifest
    assert package_lock["version"] == package_json
    # Catatan: packages[""].version di dalam lockfile sengaja TIDAK di-sync
    # (jsonpath tunggal $.version) — npm ci tetap jalan; drift di situ aman.
