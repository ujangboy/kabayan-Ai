"""
Exam Analyzer Service — Hybrid Engine v2
AI is used ONLY for:  Blueprint (once), Question generation (once per topic).
Python handles:       Scoring, evaluation, analytics, study plan, retry.
"""
import json
import re
import random
import logging
from typing import Optional, List
from sqlalchemy.orm import Session

from services.ai_service import ai_service
from services.rag_service import rag_service
from services.assessment_engine import assemble_evaluation, generate_study_plan
from repositories.exam_repository import exam_blueprint_repository, exam_session_repository
from repositories.question_bank_repository import question_bank_repository
from prompts.exam_analyzer import (
    ANALYSIS_PROMPT,
    BLUEPRINT_PROMPT,
    QUESTION_GEN_PROMPT,
    EVALUATION_PROMPT,
    RECOMMENDATION_PROMPT,
)

logger = logging.getLogger(__name__)
MAX_CONTEXT_WORDS = 3000
# Minimum questions in bank before we skip AI generation
BANK_MIN_RATIO = 0.8   # need ≥ 80% of requested questions already in bank


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_json_response(response: str, label: str = "AI") -> dict:
    match = re.search(r'```json\s*([\s\S]*?)\s*```', response)
    if match:
        json_str = match.group(1)
    else:
        json_match = re.search(r'\{[\s\S]*\}', response)
        json_str = json_match.group(0) if json_match else response
    try:
        return json.loads(json_str.strip())
    except json.JSONDecodeError as e:
        raise ValueError(
            f"{label} tidak mengembalikan JSON valid: {e}\nResponse: {response[:400]}"
        )


def _gather_context(db: Session, subject_id: int, materials) -> str:
    from parsers.document_parser import extract_text
    import os

    doc_ids = [f"mat_{m.id}" for m in materials]
    context_parts = []
    word_count = 0

    if rag_service.index is not None and rag_service.index.ntotal > 0:
        for meta in rag_service.chunk_metadata:
            if meta["doc_id"] in doc_ids:
                content = meta["content"]
                context_parts.append(content)
                word_count += len(content.split())
                if word_count >= MAX_CONTEXT_WORDS:
                    break

    if word_count < 500:
        for m in materials:
            if m.filepath and os.path.exists(m.filepath):
                try:
                    text = extract_text(m.filepath)
                    if text:
                        words = text.split()
                        take = words[:MAX_CONTEXT_WORDS - word_count]
                        context_parts.append(" ".join(take))
                        word_count += len(take)
                except Exception as exc:
                    logger.warning(f"Failed to read {m.filepath}: {exc}")
            if word_count >= MAX_CONTEXT_WORDS:
                break

    if word_count < MAX_CONTEXT_WORDS:
        from models import Note
        for note in db.query(Note).filter(Note.subject_id == subject_id).all():
            if note.content:
                snippet = f"[Catatan: {note.title}]\n{note.content}"
                context_parts.append(snippet)
                word_count += len(snippet.split())
            if word_count >= MAX_CONTEXT_WORDS:
                break

    if word_count < MAX_CONTEXT_WORDS:
        from models import Flashcard
        for card in db.query(Flashcard).filter(
            Flashcard.subject_id == subject_id
        ).limit(30).all():
            snippet = f"Q: {card.question}\nA: {card.answer}"
            context_parts.append(snippet)
            word_count += len(snippet.split())
            if word_count >= MAX_CONTEXT_WORDS:
                break

    return "\n\n---\n\n".join(context_parts)


def _bank_row_to_question(row, global_id: int) -> dict:
    """Convert a QuestionBank ORM row to the question dict format used by sessions."""
    import json as _json
    choices = {}
    if row.choices_json:
        try:
            choices = _json.loads(row.choices_json)
        except Exception:
            pass
    options_list = [f"{k}. {v}" for k, v in choices.items()] if choices else []
    return {
        "id":               global_id,
        "bank_id":          row.id,       # keep reference for explanation lazy-load
        "topic":            row.topic or "",
        "type":             row.question_type or "mcq",
        "bloom_level":      row.bloom_level or "",
        "difficulty":       row.difficulty or "menengah",
        "question":         row.question,
        "options":          choices,
        "options_list":     options_list,
        "answer":           row.correct_answer or "",
        "explanation":      row.explanation or "",
        "material_reference": row.material_ref or "",
        "tips":             row.tips or "",
    }


# ─── Exam Service ─────────────────────────────────────────────────────────────

class ExamService:

    # ── 1. Analyze ────────────────────────────────────────────────────────────
    @staticmethod
    def analyze(db: Session, subject_id: int) -> dict:
        from services.material_service import material_service
        from services.subject_service import subject_service as subj_svc
        from models import Note, Flashcard, Quiz

        subject = subj_svc.get_by_id(db, subject_id)
        if not subject:
            raise ValueError("Mata kuliah tidak ditemukan.")

        materials = material_service.get_by_subject(db, subject_id)
        material_count  = len(materials)
        note_count      = db.query(Note).filter(Note.subject_id == subject_id).count()
        flashcard_count = db.query(Flashcard).filter(Flashcard.subject_id == subject_id).count()
        quiz_count      = db.query(Quiz).filter(Quiz.subject_id == subject_id).count()
        bank_count      = question_bank_repository.count_by_topic(
            db, subject_id, topic="", difficulty=""
        ) if False else db.query(
            __import__("models").QuestionBank
        ).filter(
            __import__("models").QuestionBank.subject_id == subject_id
        ).count()

        context = _gather_context(db, subject_id, materials)
        if not context.strip():
            raise ValueError(
                "Tidak ada konten materi. Pastikan sudah mengunggah materi."
            )

        response = ai_service.generate(
            capability="reasoning",
            prompt_template=ANALYSIS_PROMPT,
            input_variables={"context": context, "subject_name": subject.name},
            use_cache=True,
        )
        data = _parse_json_response(response, "Analysis AI")
        data["stats"] = {
            "material_count": material_count,
            "note_count":     note_count,
            "flashcard_count": flashcard_count,
            "quiz_count":     quiz_count,
            "bank_count":     bank_count,
        }
        return data


    # ── 2. Generate Blueprint (AI, cached) ────────────────────────────────────
    @staticmethod
    def generate_blueprint(
        db: Session,
        subject_id: int,
        exam_type: str,
        total_questions: int,
        difficulty: str,
        bloom_level: str,
        question_type: str,
        focus_material: str,
        duration_minutes: Optional[int],
        analysis_json: Optional[str] = None,
        subject_ids: Optional[List[int]] = None,  # multi-subject
    ) -> dict:
        from services.subject_service import subject_service as subj_svc

        subject = subj_svc.get_by_id(db, subject_id)
        if not subject:
            raise ValueError("Mata kuliah tidak ditemukan.")

        topic_priority_str = "[]"
        if analysis_json:
            try:
                parsed = json.loads(analysis_json)
                topic_priority_str = json.dumps(
                    parsed.get("topic_priority", []), ensure_ascii=False
                )
            except Exception:
                pass

        response = ai_service.generate(
            capability="reasoning",
            prompt_template=BLUEPRINT_PROMPT,
            input_variables={
                "subject_name":       subject.name,
                "exam_type":          exam_type,
                "total_questions":    total_questions,
                "difficulty":         difficulty,
                "bloom_level":        bloom_level,
                "question_type":      question_type,
                "focus_material":     focus_material,
                "topic_priority_json": topic_priority_str,
            },
            use_cache=False,
        )
        blueprint_data = _parse_json_response(response, "Blueprint AI")

        # Attach multi-subject metadata if provided
        if subject_ids:
            blueprint_data["subject_ids"] = subject_ids

        record = exam_blueprint_repository.create_blueprint(
            db=db,
            subject_id=subject_id,
            title=blueprint_data.get("title", f"Blueprint {exam_type.upper()} - {subject.name}"),
            exam_type=exam_type,
            difficulty=difficulty,
            bloom_level=bloom_level,
            question_type=question_type,
            total_questions=total_questions,
            duration_minutes=duration_minutes,
            blueprint_json=json.dumps(blueprint_data, ensure_ascii=False),
            analysis_json=analysis_json,
        )
        return {"blueprint_id": record.id, **blueprint_data}


    # ── 3. Generate Questions — Question Bank first, AI only if needed ─────────
    @staticmethod
    def generate_questions(db: Session, blueprint_id: int) -> dict:
        from services.material_service import material_service

        blueprint = exam_blueprint_repository.get(db, blueprint_id)
        if not blueprint:
            raise ValueError("Blueprint tidak ditemukan.")

        blueprint_data = json.loads(blueprint.blueprint_json)
        items          = blueprint_data.get("blueprint_items", [])
        subject_ids    = blueprint_data.get("subject_ids", [blueprint.subject_id])
        if isinstance(subject_ids, int):
            subject_ids = [subject_ids]

        all_questions = []
        question_id_offset = 1

        for item in items:
            topic    = item.get("topic", "")
            needed   = item.get("question_count", 1)
            diff     = item.get("difficulty", blueprint.difficulty)
            qtypes   = item.get("question_types", [blueprint.question_type])
            qtype    = qtypes[0] if len(qtypes) == 1 else "mixed"
            bloom    = item.get("bloom_level", blueprint.bloom_level)
            concepts = ", ".join(item.get("key_concepts", [topic]))

            # ── Try Question Bank first ──
            bank_rows = question_bank_repository.get_by_topic(
                db, blueprint.subject_id, topic, diff, qtype, limit=needed * 3
            )
            random.shuffle(bank_rows)
            bank_rows = bank_rows[:needed]

            if len(bank_rows) >= max(1, int(needed * BANK_MIN_RATIO)):
                # Enough in bank — use them, no AI call
                question_bank_repository.increment_used(db, [r.id for r in bank_rows])
                for row in bank_rows:
                    q = _bank_row_to_question(row, question_id_offset)
                    all_questions.append(q)
                    question_id_offset += 1
                continue   # ← next blueprint item

            # ── Not enough in bank — call AI ──
            materials = material_service.get_by_subject(db, blueprint.subject_id)
            full_ctx  = _gather_context(db, blueprint.subject_id, materials)
            context   = " ".join(full_ctx.split()[:1500])

            capped = min(needed, 8)
            try:
                response = ai_service.generate(
                    capability="quiz",
                    prompt_template=QUESTION_GEN_PROMPT,
                    input_variables={
                        "context":        context,
                        "topic":          topic,
                        "question_count": capped,
                        "question_types": ", ".join(qtypes),
                        "bloom_level":    bloom,
                        "difficulty":     diff,
                        "key_concepts":   concepts,
                    },
                    use_cache=False,
                )
                q_data    = _parse_json_response(response, f"QuestionGen[{topic}]")
                new_qs    = q_data.get("questions", [])

                # Save to bank for future reuse
                question_bank_repository.bulk_insert(
                    db, blueprint.subject_id, blueprint_id, new_qs
                )

                for q in new_qs:
                    q["id"] = question_id_offset
                    question_id_offset += 1
                    if q.get("type") in ("mcq", "truefalse") and isinstance(q.get("options"), dict):
                        q["options_list"] = [f"{k}. {v}" for k, v in q["options"].items()]
                    else:
                        q["options_list"] = []
                all_questions.extend(new_qs)

            except Exception as exc:
                logger.error(f"Question gen failed for topic '{topic}': {exc}")
                # Use whatever is in bank even if insufficient
                for row in bank_rows:
                    q = _bank_row_to_question(row, question_id_offset)
                    all_questions.append(q)
                    question_id_offset += 1

        if not all_questions:
            raise ValueError("Tidak ada soal tersedia. Coba lagi.")

        payload = {
            "title":            blueprint_data.get("title", f"Simulasi {blueprint.exam_type.upper()}"),
            "exam_type":        blueprint.exam_type,
            "difficulty":       blueprint.difficulty,
            "bloom_level":      blueprint.bloom_level,
            "duration_minutes": blueprint.duration_minutes,
            "questions":        all_questions,
        }

        session = exam_session_repository.create_session(
            db=db,
            blueprint_id=blueprint_id,
            subject_id=blueprint.subject_id,
            questions_json=json.dumps(payload, ensure_ascii=False),
        )
        return {"session_id": session.id, **payload}


    # ── 4. Retry — pure Python, zero AI ───────────────────────────────────────
    @staticmethod
    def retry_from_bank(
        db: Session,
        blueprint_id: int,
        weak_topics: Optional[List[str]] = None,
    ) -> dict:
        """
        Create a new exam session by shuffling from the question bank.
        No AI call. Prioritizes weak topics (70% weak, 20% other, 10% strong).
        """
        blueprint = exam_blueprint_repository.get(db, blueprint_id)
        if not blueprint:
            raise ValueError("Blueprint tidak ditemukan.")

        blueprint_data = json.loads(blueprint.blueprint_json)
        items          = blueprint_data.get("blueprint_items", [])
        total_needed   = blueprint.total_questions or sum(
            i.get("question_count", 1) for i in items
        )

        weak_set = set(weak_topics or [])

        # Pull all available questions from bank
        all_rows = question_bank_repository.get_by_subject(
            db, blueprint.subject_id,
            difficulty=blueprint.difficulty if blueprint.difficulty != "campuran" else None,
            limit=total_needed * 5,
        )

        if not all_rows:
            raise ValueError(
                "Question bank kosong untuk blueprint ini. Generate soal terlebih dahulu."
            )

        # Partition into weak / other
        weak_rows  = [r for r in all_rows if r.topic in weak_set]
        other_rows = [r for r in all_rows if r.topic not in weak_set]

        random.shuffle(weak_rows)
        random.shuffle(other_rows)

        # 70% weak, 30% other (if weak available)
        n_weak  = min(len(weak_rows),  int(total_needed * 0.7)) if weak_rows else 0
        n_other = min(len(other_rows), total_needed - n_weak)

        selected = weak_rows[:n_weak] + other_rows[:n_other]
        random.shuffle(selected)

        # Pad if still short
        if len(selected) < total_needed:
            remaining = [r for r in all_rows if r not in selected]
            random.shuffle(remaining)
            selected += remaining[:total_needed - len(selected)]

        question_bank_repository.increment_used(db, [r.id for r in selected])

        all_questions = [
            _bank_row_to_question(row, i + 1) for i, row in enumerate(selected)
        ]

        payload = {
            "title":            f"Latihan Ulang — {blueprint_data.get('title', '')}",
            "exam_type":        blueprint.exam_type,
            "difficulty":       blueprint.difficulty,
            "bloom_level":      blueprint.bloom_level,
            "duration_minutes": blueprint.duration_minutes,
            "questions":        all_questions,
            "is_retry":         True,
        }

        session = exam_session_repository.create_session(
            db=db,
            blueprint_id=blueprint_id,
            subject_id=blueprint.subject_id,
            questions_json=json.dumps(payload, ensure_ascii=False),
        )
        return {"session_id": session.id, **payload}


    # ── 5. Submit & Evaluate — Python engine, AI only for subjective ──────────
    @staticmethod
    def submit_and_evaluate(
        db: Session,
        session_id: int,
        answers: dict,
    ) -> dict:
        from services.subject_service import subject_service as subj_svc

        session = exam_session_repository.get(db, session_id)
        if not session:
            raise ValueError("Sesi ujian tidak ditemukan.")
        if session.submitted_at:
            return json.loads(session.evaluation_json)

        questions_data = json.loads(session.questions_json)
        questions      = questions_data.get("questions", [])
        exam_type      = questions_data.get("exam_type", "simulasi")
        subject        = subj_svc.get_by_id(db, session.subject_id)
        subject_name   = subject.name if subject else "Mata Kuliah"

        # Separate subjective questions for AI batch
        subjective_lines = []
        for q in questions:
            qid   = str(q.get("id", ""))
            qtype = q.get("type", "mcq")
            if qtype not in ("mcq", "truefalse"):
                user_ans = (answers.get(qid) or "").strip()
                correct  = q.get("answer", "")
                if user_ans and len(subjective_lines) < 8:
                    subjective_lines.append(
                        f"No.{qid} [{qtype}]\nTopik: {q.get('topic','')}\n"
                        f"Soal: {q.get('question','')[:200]}\n"
                        f"Jawaban User: {user_ans[:300]}\n"
                        f"Jawaban Ideal: {correct[:200]}"
                    )

        # AI batch evaluation for subjective only
        ai_subjective: dict = {}
        BATCH = 5
        for start in range(0, len(subjective_lines), BATCH):
            batch = subjective_lines[start: start + BATCH]
            try:
                resp = ai_service.generate(
                    capability="reasoning",
                    prompt_template=EVALUATION_PROMPT,
                    input_variables={
                        "subject_name": subject_name,
                        "exam_type":    exam_type,
                        "qa_pairs":     "\n---\n".join(batch),
                    },
                    use_cache=False,
                )
                data = _parse_json_response(resp, f"Eval batch {start//BATCH+1}")
                for fb in data.get("per_question_feedback", []):
                    ai_subjective[str(fb.get("question_id", ""))] = fb
            except Exception as exc:
                logger.warning(f"Subjective eval batch failed: {exc}")
                for line in batch:
                    m = re.match(r'No\.(\d+)', line)
                    if m:
                        ai_subjective[m.group(1)] = {
                            "is_correct": False, "score": 0,
                            "feedback": "Evaluasi tidak tersedia.", "explanation": "",
                        }

        # Python assessment engine assembles everything
        eval_data = assemble_evaluation(
            questions, answers, subject_name, exam_type, ai_subjective
        )

        exam_session_repository.submit_session(
            db=db,
            session_id=session_id,
            answers_json=json.dumps(answers, ensure_ascii=False),
            score=eval_data["score"],
            total_correct=eval_data["total_correct"],
            total_wrong=eval_data["total_wrong"],
            evaluation_json=json.dumps(eval_data, ensure_ascii=False),
        )
        return eval_data


    # ── 6. Recommendation — rule-based Python, no AI ──────────────────────────
    @staticmethod
    def get_recommendation(db: Session, session_id: int) -> dict:
        from services.subject_service import subject_service as subj_svc

        session = exam_session_repository.get(db, session_id)
        if not session or not session.evaluation_json:
            raise ValueError("Evaluasi belum tersedia untuk sesi ini.")

        eval_data    = json.loads(session.evaluation_json)
        questions_data = json.loads(session.questions_json)
        subject      = subj_svc.get_by_id(db, session.subject_id)
        subject_name = subject.name if subject else "Mata Kuliah"
        exam_type    = questions_data.get("exam_type", "simulasi")

        return generate_study_plan(
            weak_topics   = eval_data.get("weak_topics", []),
            strong_topics = eval_data.get("strong_topics", []),
            score         = eval_data.get("score", 0),
            subject_name  = subject_name,
        )

    # ── 7. Lazy AI explanation for one question ───────────────────────────────
    @staticmethod
    def get_explanation(
        db: Session,
        bank_id: Optional[int],
        question_text: str,
        correct_answer: str,
        topic: str,
    ) -> str:
        """
        Fetch explanation from question bank (cached) or generate via AI (lazy).
        Saves the result back to the bank for future reuse.
        """
        from prompts.exam_analyzer import EXPLANATION_PROMPT

        # Check bank cache first
        if bank_id:
            row = question_bank_repository.get(db, bank_id)
            if row and row.explanation:
                return row.explanation

        # Generate via AI
        response = ai_service.generate(
            capability="reasoning",
            prompt_template=EXPLANATION_PROMPT,
            input_variables={
                "question": question_text[:300],
                "answer":   correct_answer[:200],
                "topic":    topic,
            },
            use_cache=True,
        )

        # Save back to bank
        if bank_id:
            question_bank_repository.update_explanation(db, bank_id, response)

        return response

    # ── 8. Question Bank stats ────────────────────────────────────────────────
    @staticmethod
    def get_bank_stats(db: Session, subject_id: int) -> dict:
        return question_bank_repository.stats_by_subject(db, subject_id)

    # ── 9. History helpers (unchanged API) ────────────────────────────────────
    @staticmethod
    def get_blueprints(db: Session, subject_id: int) -> list:
        bps = exam_blueprint_repository.get_by_subject(db, subject_id)
        return [
            {
                "id":               bp.id,
                "title":            bp.title,
                "exam_type":        bp.exam_type,
                "difficulty":       bp.difficulty,
                "bloom_level":      bp.bloom_level,
                "total_questions":  bp.total_questions,
                "duration_minutes": bp.duration_minutes,
                "created_at":       bp.created_at.isoformat() if bp.created_at else None,
                "session_count":    len(bp.sessions),
            }
            for bp in bps
        ]

    @staticmethod
    def get_sessions(db: Session, subject_id: int) -> list:
        sessions = exam_session_repository.get_by_subject(db, subject_id)
        result = []
        for s in sessions:
            qdata = {}
            try:
                qdata = json.loads(s.questions_json) if s.questions_json else {}
            except Exception:
                pass
            result.append({
                "id":           s.id,
                "blueprint_id": s.blueprint_id,
                "title":        qdata.get("title", f"Sesi #{s.id}"),
                "exam_type":    qdata.get("exam_type", ""),
                "score":        s.score,
                "total_correct": s.total_correct,
                "total_wrong":  s.total_wrong,
                "submitted":    s.submitted_at is not None,
                "started_at":   s.started_at.isoformat() if s.started_at else None,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            })
        return result

    @staticmethod
    def get_session_detail(db: Session, session_id: int) -> dict:
        s = exam_session_repository.get(db, session_id)
        if not s:
            raise ValueError("Sesi tidak ditemukan.")
        questions_data = json.loads(s.questions_json) if s.questions_json else {}
        evaluation     = json.loads(s.evaluation_json) if s.evaluation_json else None
        answers        = json.loads(s.answers_json) if s.answers_json else {}
        return {
            "id":           s.id,
            "blueprint_id": s.blueprint_id,
            "subject_id":   s.subject_id,
            "score":        s.score,
            "total_correct": s.total_correct,
            "total_wrong":  s.total_wrong,
            "submitted":    s.submitted_at is not None,
            "started_at":   s.started_at.isoformat() if s.started_at else None,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            **questions_data,
            "answers":      answers,
            "evaluation":   evaluation,
        }


exam_service = ExamService()
