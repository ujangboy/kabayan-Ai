"""Regresi: handler yang memanggil AI sinkron wajib berjalan di threadpool.

FastAPI menjalankan `def` di threadpool, sedangkan `async def` berjalan langsung
di event loop. Satu worker uvicorn berarti panggilan AI 30-90 detik di `async def`
membekukan seluruh aplikasi (health check, polling, streaming).
"""
import inspect

from app.routers import chat, flashcards, notes, quizzes

CASES = [
    (quizzes.router, "/api/quizzes/generate"),
    (flashcards.router, "/api/flashcards/generate"),
    (notes.router, "/api/notes/{note_id}/action"),
    (notes.router, "/api/notes/generate"),
    (notes.router, "/api/notebook/detect-context"),
    (notes.router, "/api/notebook/generate-title"),
    (chat.router, "/api/chat/vision"),
    (chat.router, "/api/export/flashcards"),
]


def test_ai_routes_run_in_threadpool():
    for router, path in CASES:
        route = next(r for r in router.routes if getattr(r, "path", None) == path)
        assert not inspect.iscoroutinefunction(route.endpoint), path
