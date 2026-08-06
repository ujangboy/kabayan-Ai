"""
Test Retrieval Agent (CRAG-style) — agents/retrieval_agent.py.

Fokus uji:
  - Status verdict: no_docs / sufficient / partial / insufficient / empty
  - Siklus self-correction: query asli kurang → reformulasi → retry → broaden
  - needs_clarification=True saat retrieval gagal total (anti-halusinasi)
  - Evaluasi skor 0-token: keyword hit rate + coverage
  - Integrasi di tutor_service._handle_ai: cache key memuat status retrieval
"""
import pytest

from agents.retrieval_agent import retrieval_agent, RetrievalResult


# ─── Helper: fake search yang bisa diprogram per-query ───────────────────────

def _fake_search(plan, default=None):
    """plan: dict {query: {"text": str, "sources": list}} — kembalikan fake hasil."""
    def _search(query, doc_ids=None, top_k=5):
        entry = plan.get(query)
        if entry is None:
            return {"text": "", "sources": []}
        return {"text": entry.get("text", ""), "sources": entry.get("sources", [])}
    return _search


_SUFFICIENT_TEXT = (
    "Hukum Newton pertama menyatakan bahwa benda akan tetap diam atau bergerak "
    "lurus beraturan selama tidak ada gaya total yang bekerja padanya. Hukum "
    "Newton kedua menjelaskan hubungan antara gaya, massa, dan percepatan: "
    "F = m.a. Hukum Newton ketiga menyatakan aksi dan reaksi sama besar dan "
    "berlawanan arah. Ketiga hukum ini merupakan dasar mekanika klasik."
)


# ─── Verdict dasar ───────────────────────────────────────────────────────────

def test_no_docs_returns_no_docs():
    result = retrieval_agent.run("apa itu limit?", doc_ids=[])
    assert result.status == "no_docs"
    assert result.needs_clarification is False
    assert result.context == ""


def test_empty_query_returns_empty():
    result = retrieval_agent.run("   ", doc_ids=["mat_1"])
    assert result.status == "empty"
    assert result.needs_clarification is False


def test_sufficient_first_attempt(monkeypatch):
    monkeypatch.setattr(
        "services.rag_service.rag_service.search",
        _fake_search({
            "apa itu hukum newton?": {"text": _SUFFICIENT_TEXT, "sources": [{"doc_id": "mat_1", "content": "x"}]},
        }),
    )
    result = retrieval_agent.run("apa itu hukum newton?", doc_ids=["mat_1"])
    assert result.status == "sufficient"
    assert result.attempts == 1
    assert result.needs_clarification is False
    assert "hukum newton" in result.context.lower()


# ─── Self-correction: reformulasi + retry ────────────────────────────────────

def test_reformulation_retry_when_first_query_empty(monkeypatch):
    """Query asli tidak menghasilkan apa pun → agent reformulasi & retry."""
    calls = []

    def _search(query, doc_ids=None, top_k=5):
        calls.append((query, top_k))
        # Hanya query hasil reformulasi ("hukum newton") yang cocok —
        # query asli dengan kata tanya harus gagal.
        if query == "hukum newton":
            return {"text": _SUFFICIENT_TEXT, "sources": [{"doc_id": "mat_1", "content": "x"}]}
        return {"text": "", "sources": []}

    monkeypatch.setattr("services.rag_service.rag_service.search", _search)

    result = retrieval_agent.run("apa itu hukum newton?", doc_ids=["mat_1"])

    assert result.status == "sufficient"
    assert result.attempts >= 2
    assert result.reformulations, "harus ada reformulasi query"
    assert "hukum" in result.reformulations[0]


def test_broaden_gather_when_still_insufficient(monkeypatch):
    """Retry gagal semua → broaden ambil chunk dari rag_context_service."""
    monkeypatch.setattr(
        "services.rag_service.rag_service.search",
        _fake_search({}),  # semua query kosong
    )
    monkeypatch.setattr(
        "services.rag_context_service.rag_context_service._gather_chunks",
        lambda doc_ids, max_words: _SUFFICIENT_TEXT,
    )

    result = retrieval_agent.run("apa itu hukum newton?", doc_ids=["mat_1"])
    assert result.status == "sufficient"
    assert result.attempts == 2
    assert "hukum newton" in result.context.lower()


def test_total_failure_sets_needs_clarification(monkeypatch):
    """Gagal total → needs_clarification=True (minta user klarifikasi, bukan halusinasi)."""
    monkeypatch.setattr(
        "services.rag_service.rag_service.search",
        _fake_search({}),
    )
    monkeypatch.setattr(
        "services.rag_context_service.rag_context_service._gather_chunks",
        lambda doc_ids, max_words: "",
    )

    result = retrieval_agent.run("apa itu hukum newton?", doc_ids=["mat_1"])
    assert result.status == "empty"
    assert result.needs_clarification is True


def test_insufficient_when_score_below_threshold(monkeypatch):
    """Retrieval ada tapi skor evaluasi di bawah PARTIAL → insufficient + clarify."""
    weak_text = "materi ini membahas topik umum yang tidak relevan sama sekali dengan pertanyaan"

    def _search(query, doc_ids=None, top_k=5):
        return {"text": weak_text, "sources": [{"doc_id": "mat_1", "content": "x"}]}

    monkeypatch.setattr("services.rag_service.rag_service.search", _search)

    result = retrieval_agent.run("apa itu hukum newton?", doc_ids=["mat_1"])
    assert result.status == "insufficient"
    assert result.needs_clarification is True


# ─── Evaluasi 0-token ────────────────────────────────────────────────────────

def test_keywords_remove_question_words():
    kw = retrieval_agent._keywords("apa itu hukum newton kedua?")
    assert "hukum" in kw
    assert "newton" in kw
    assert "kedua" in kw
    assert "apa" not in kw
    assert "itu" not in kw


def test_evaluate_scoring():
    good = retrieval_agent._evaluate("apa itu hukum newton?", _SUFFICIENT_TEXT)
    bad = retrieval_agent._evaluate("apa itu hukum newton?", "konten tidak relevan")
    assert good > bad
    assert 0.0 <= good <= 1.0


# ─── Integrasi: tutor_service cache key memuat status retrieval ──────────────

def test_tutor_handle_ai_uses_retrieval_agent(monkeypatch):
    """_handle_ai memanggil retrieval_agent dan menambah status ke cache key."""
    import inspect
    from services.tutor_service import TutorService, _collect_doc_ids
    from agents.retrieval_agent import retrieval_agent as ra

    src = inspect.getsource(TutorService._handle_ai)
    assert "retrieval_agent.run" in src
    assert "needs_clarification" in src
    assert "retrieval.status" in src

    assert callable(_collect_doc_ids)


def test_chat_router_uses_retrieval_agent():
    """routers/chat.py memakai retrieval_agent (bukan rag_service.search langsung)."""
    import inspect
    from routers import chat as chat_router

    src = inspect.getsource(chat_router)
    assert "retrieval_agent.run" in src
