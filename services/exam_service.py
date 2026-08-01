"""
Exam Analyzer Service — Hybrid Engine v2
AI is used ONLY for:  Blueprint (once), Question generation (once per topic).
Python handles:       Scoring, evaluation, analytics, study plan, retry.
"""
import json
import re
import random
import logging
import datetime
from typing import Optional, List
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status

from services.ai_service import ai_service
from services.assessment_engine import assemble_evaluation, generate_study_plan, fallback_activity_description, TIME_SLOTS
from repositories.exam_repository import exam_blueprint_repository, exam_session_repository
from repositories.question_bank_repository import question_bank_repository
from repositories.exam_history_repository import exam_attempt_repo, study_plan_repo, study_plan_item_repo
from models import ExamSession, ExamAttempt, ExamReview, StudyPlan, StudyPlanItem
from schemas.ai_output import ExamQuestionOutput
from prompts.exam_analyzer import (
    ANALYSIS_PROMPT,
    BLUEPRINT_PROMPT,
    QUESTION_GEN_PROMPT,
    EVALUATION_PROMPT,
)

logger = logging.getLogger(__name__)
MAX_CONTEXT_WORDS = 1500
# Minimum questions in bank before we skip AI generation
BANK_MIN_RATIO = 0.8   # need ≥ 80% of requested questions already in bank


# ─── History Helpers ─────────────────────────────────────────────────────────

def _calc_grade(score: int) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "E"


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_json_response(response: str, label: str = "AI") -> dict:
    from services.json_utils import parse_ai_json
    try:
        return parse_ai_json(response, label)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"{label} tidak mengembalikan JSON valid: {e}\nResponse: {str(response)[:400]}"
        )


def _gather_context(db: Session, subject_id: int, materials) -> str:
    from services.rag_context_service import rag_context_service
    from models import Note, Flashcard

    subject_name = ""
    if materials:
        subject_name = getattr(materials[0], "filename", "")
    context = rag_context_service.gather_context(
        materials, max_words=MAX_CONTEXT_WORDS, query=subject_name or f"materi kuliah"
    )
    word_count = len(context.split())

    if word_count < MAX_CONTEXT_WORDS:
        extras = []
        for note in db.query(Note).filter(Note.subject_id == subject_id).all():
            if note.content:
                snippet = f"[Catatan: {note.title}]\n{note.content}"
                extras.append(snippet)
                word_count += len(snippet.split())
            if word_count >= MAX_CONTEXT_WORDS:
                break

        for card in db.query(Flashcard).filter(
            Flashcard.subject_id == subject_id
        ).limit(30).all():
            snippet = f"Q: {card.question}\nA: {card.answer}"
            extras.append(snippet)
            word_count += len(snippet.split())
            if word_count >= MAX_CONTEXT_WORDS:
                break

        if extras:
            context = context + "\n\n---\n\n" + "\n\n".join(extras) if context else "\n\n".join(extras)

    return context


def _bank_row_to_question(row, global_id: int) -> dict:
    """Convert a QuestionBank ORM row to the question dict format used by sessions."""
    choices = {}
    if row.choices_json:
        try:
            choices = json.loads(row.choices_json)
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

        # Hanya gunakan materi yang sudah Ready untuk context AI
        ready_materials = [m for m in materials if m.status == "Ready"]

        note_count      = db.query(Note).filter(Note.subject_id == subject_id).count()
        flashcard_count = db.query(Flashcard).filter(Flashcard.subject_id == subject_id).count()
        quiz_count      = db.query(Quiz).filter(Quiz.subject_id == subject_id).count()
        bank_count      = question_bank_repository.count_by_topic(
            db, subject_id, topic="", difficulty=""
        )

        context = _gather_context(db, subject_id, ready_materials)
        if not context.strip():
            processing = [m for m in materials if m.status == "Processing"]
            if processing:
                raise ValueError(
                    f"Ada {len(processing)} materi yang masih diproses (Processing). "
                    "Tunggu beberapa saat hingga status berubah menjadi 'Ready', lalu coba lagi."
                )
            raise ValueError(
                "Tidak ada konten materi. Pastikan sudah mengunggah materi dan statusnya Ready."
            )

        response = ai_service.generate(
            capability="reasoning",
            prompt_template=ANALYSIS_PROMPT,
            input_variables={"context": context, "subject_name": subject.name},
            use_cache=True,
        )
        data = _parse_json_response(response, "Analysis AI")
        if isinstance(data, list):
            logger.warning("Analysis AI returned a list, wrapping or unpacking it.")
            if len(data) > 0 and isinstance(data[0], dict) and "overview" in data[0]:
                data = data[0]
            else:
                data = {
                    "overview": {
                        "total_topics": len(data),
                        "estimated_study_hours": 2,
                        "complexity_level": "Menengah",
                        "summary": "Analisis AI dikonversi dari array list."
                    },
                    "topic_priority": data,
                    "knowledge_map": [],
                    "weakness_indicators": []
                }
        
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
        material_ids: Optional[str] = None,
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
            temperature=0.5,
        )
        blueprint_data = _parse_json_response(response, "Blueprint AI")
        # Gracefully handle AI returning an array instead of an object
        if isinstance(blueprint_data, list):
            logger.warning("Blueprint AI returned a list — wrapping in blueprint_items")
            blueprint_data = {"blueprint_items": blueprint_data}
        if "title" not in blueprint_data:
            blueprint_data["title"] = f"Blueprint {exam_type.upper()} - {subject.name}"

        # Attach multi-subject metadata if provided
        if subject_ids:
            blueprint_data["subject_ids"] = subject_ids
        if material_ids:
            blueprint_data["material_ids"] = material_ids

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
            blueprint_material_ids = blueprint_data.get("material_ids")
            if blueprint_material_ids:
                ids = [int(x.strip()) for x in blueprint_material_ids.split(",") if x.strip()]
                if ids:
                    materials = [m for m in materials if m.id in ids]
            full_ctx  = _gather_context(db, blueprint.subject_id, materials)
            context   = " ".join(full_ctx.split()[:1500])

            capped = min(needed, 8)
            try:
                if not context.strip():
                    logger.warning(f"Empty context for topic '{topic}' — skipping AI, using bank")
                    for row in bank_rows:
                        q = _bank_row_to_question(row, question_id_offset)
                        all_questions.append(q)
                        question_id_offset += 1
                    continue

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
                    temperature=0.7,
                )
                if not response or not str(response).strip():
                    logger.warning(f"Empty AI response for topic '{topic}' — using bank")
                    for row in bank_rows:
                        q = _bank_row_to_question(row, question_id_offset)
                        all_questions.append(q)
                        question_id_offset += 1
                    continue

                q_data = _parse_json_response(response, f"QuestionGen[{topic}]")
                # AI might return a list directly instead of {"questions": [...]}
                if isinstance(q_data, list):
                    new_qs = q_data
                else:
                    new_qs = q_data.get("questions", [])

                if not new_qs:
                    logger.warning(f"AI returned no questions for topic '{topic}' — using bank")
                    for row in bank_rows:
                        q = _bank_row_to_question(row, question_id_offset)
                        all_questions.append(q)
                        question_id_offset += 1
                    continue

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
        topic_filter: Optional[str] = None,
    ) -> dict:
        """
        Create a new exam session by shuffling from the question bank.
        No AI call. Prioritizes weak topics (70% weak, 20% other, 10% strong).
        If topic_filter is set, only pull questions from that specific topic.
        """
        blueprint = exam_blueprint_repository.get(db, blueprint_id)
        if not blueprint:
            raise ValueError("Blueprint tidak ditemukan.")

        blueprint_data = json.loads(blueprint.blueprint_json)
        items          = blueprint_data.get("blueprint_items", [])
        total_needed   = blueprint.total_questions or sum(
            i.get("question_count", 1) for i in items
        )

        # Blueprint difficulty (pemula/menengah/sulit) vs bank difficulty (mudah/menengah/sulit)
        diff_map = {
            "pemula": "mudah",
            "sedang": "menengah",
            "menengah": "menengah",
            "ahli": "sulit",
            "sulit": "sulit",
        }
        mapped_diff = diff_map.get(blueprint.difficulty) if blueprint.difficulty != "campuran" else None

        # Determine question_type from blueprint
        question_type = blueprint.question_type if blueprint.question_type and blueprint.question_type != "mixed" else None

        if topic_filter:
            # Topic-specific practice: pull only from this topic
            all_rows = question_bank_repository.get_by_topic(
                db, blueprint.subject_id, topic_filter,
                difficulty=mapped_diff,
                question_type=question_type,
                limit=total_needed * 5,
            )
            if not all_rows:
                all_rows = question_bank_repository.get_by_topic(
                    db, blueprint.subject_id, topic_filter,
                    limit=total_needed * 5,
                )
            selected = all_rows[:total_needed]
            random.shuffle(selected)
        else:
            # General retry: pull all, partition by weak/other
            weak_set = set(
                w.get("topic", w) if isinstance(w, dict) else w
                for w in (weak_topics or [])
            )

            all_rows = question_bank_repository.get_by_subject(
                db, blueprint.subject_id,
                difficulty=mapped_diff,
                question_type=question_type,
                limit=total_needed * 5,
            )
            if not all_rows:
                all_rows = question_bank_repository.get_by_subject(
                    db, blueprint.subject_id,
                    question_type=question_type,
                    limit=total_needed * 5,
                )
            if not all_rows:
                all_rows = question_bank_repository.get_by_subject(
                    db, blueprint.subject_id, limit=total_needed * 5,
                )

            if not all_rows:
                raise ValueError(
                    "Question bank kosong untuk blueprint ini. Generate soal terlebih dahulu."
                )

            weak_rows  = [r for r in all_rows if r.topic in weak_set]
            other_rows = [r for r in all_rows if r.topic not in weak_set]

            random.shuffle(weak_rows)
            random.shuffle(other_rows)

            n_weak  = min(len(weak_rows),  int(total_needed * 0.7)) if weak_rows else 0
            n_other = min(len(other_rows), total_needed - n_weak)

            selected = weak_rows[:n_weak] + other_rows[:n_other]
            random.shuffle(selected)

            if len(selected) < total_needed:
                remaining = [r for r in all_rows if r not in selected]
                random.shuffle(remaining)
                selected += remaining[:total_needed - len(selected)]

        if not selected:
            raise ValueError(
                "Question bank kosong untuk blueprint ini. Generate soal terlebih dahulu."
            )

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

    @staticmethod
    def fetch_practice_questions(
        db: Session,
        session_id: int,
        topic_filter: Optional[str] = None,
    ) -> dict:
        """
        Fetch questions for practice WITHOUT creating a new session.
        Used by "Latih Topik Lemah" button inside InlinePractice.
        """
        if not (session := exam_session_repository.get(db, session_id)):
            raise ValueError(f"Sesi ujian ID {session_id} tidak ditemukan.")

        blueprint_id = session.blueprint_id
        if not blueprint_id:
            if not (blueprint := exam_blueprint_repository.get_latest_by_subject(db, session.subject_id)):
                raise ValueError("Tidak ada blueprint untuk subjek ini.")
            blueprint_id = blueprint.id
        else:
            blueprint = exam_blueprint_repository.get(db, blueprint_id)

        if not blueprint:
            raise ValueError("Blueprint tidak ditemukan.")

        blueprint_data = json.loads(blueprint.blueprint_json)
        items          = blueprint_data.get("blueprint_items", [])
        total_needed   = blueprint.total_questions or sum(
            i.get("question_count", 1) for i in items
        )

        diff_map = {
            "pemula": "mudah", "sedang": "menengah",
            "menengah": "menengah", "ahli": "sulit", "sulit": "sulit",
        }
        mapped_diff = diff_map.get(blueprint.difficulty) if blueprint.difficulty != "campuran" else None
        question_type = blueprint.question_type if blueprint.question_type and blueprint.question_type != "mixed" else None

        if topic_filter:
            all_rows = question_bank_repository.get_by_topic(
                db, blueprint.subject_id, topic_filter,
                difficulty=mapped_diff, question_type=question_type,
                limit=total_needed * 5,
            )
            if not all_rows:
                all_rows = question_bank_repository.get_by_topic(
                    db, blueprint.subject_id, topic_filter,
                    limit=total_needed * 5,
                )
        else:
            all_rows = question_bank_repository.get_by_subject(
                db, blueprint.subject_id,
                difficulty=mapped_diff, question_type=question_type,
                limit=total_needed * 5,
            )
            if not all_rows:
                all_rows = question_bank_repository.get_by_subject(
                    db, blueprint.subject_id, question_type=question_type,
                    limit=total_needed * 5,
                )
            if not all_rows:
                all_rows = question_bank_repository.get_by_subject(
                    db, blueprint.subject_id, limit=total_needed * 5,
                )

        if not all_rows:
            raise ValueError("Question bank kosong untuk topik ini.")

        # Untuk latihan topik spesifik, batasi ke 5 soal agar tidak terlalu panjang
        max_practice = 5 if topic_filter else total_needed
        selected = all_rows[:max_practice]
        random.shuffle(selected)

        all_questions = [
            _bank_row_to_question(row, i + 1) for i, row in enumerate(selected)
        ]

        return {
            "title":      f"Latihan — {blueprint_data.get('title', '')}",
            "questions":  all_questions,
            "subject_id": blueprint.subject_id,
        }

    # ── 5. Submit & Evaluate — Python engine, AI only for subjective ──────────
    @staticmethod
    def submit_and_evaluate(
        db: Session,
        session_id: int,
        answers: dict,
    ) -> dict:
        from services.subject_service import subject_service as subj_svc

        try:
            if not (session := exam_session_repository.get(db, session_id)):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Sesi ujian ID {session_id} tidak ditemukan",
                )
            if session.submitted_at:
                return json.loads(session.evaluation_json)

            questions_data = json.loads(session.questions_json)
            questions      = questions_data.get("questions", [])
            exam_type      = questions_data.get("exam_type", "simulasi")
            subject        = subj_svc.get_by_id(db, session.subject_id)
            subject_name   = subject.name if subject else "Mata Kuliah"

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

            eval_data = assemble_evaluation(
                questions, answers, subject_name, exam_type, ai_subjective
            )

            session.answers_json         = json.dumps(answers, ensure_ascii=False)
            session.score                = eval_data["score"]
            session.total_correct        = eval_data["total_correct"]
            session.total_wrong          = eval_data["total_wrong"]
            session.evaluation_json      = json.dumps(eval_data, ensure_ascii=False)
            session.submitted_at         = datetime.datetime.utcnow()

            grade_val = eval_data.get("grade") or _calc_grade(eval_data["score"])
            session.status               = "completed"
            session.latest_score         = eval_data["score"]
            session.best_score           = eval_data["score"] if session.best_score is None else max(session.best_score, eval_data["score"])
            session.grade                = grade_val
            session.progress             = eval_data["score"]
            session.subject_name         = subject_name
            session.title                = questions_data.get("title", f"Simulasi {exam_type} - {subject_name}")
            session.exam_type            = exam_type
            session.difficulty           = questions_data.get("difficulty", "menengah")
            session.bloom_level          = questions_data.get("bloom_level", "mixed")
            session.question_type        = questions_data.get("question_type", "mixed")
            session.total_questions      = len(questions)
            session.weak_topics_json     = json.dumps(eval_data.get("weak_topics", []), ensure_ascii=False)
            session.strong_topics_json   = json.dumps(eval_data.get("strong_topics", []), ensure_ascii=False)
            session.updated_at           = datetime.datetime.utcnow()

            attempt = ExamAttempt(
                session_id=session_id,
                attempt_number=exam_attempt_repo.next_attempt_number(db, session_id),
                score=eval_data["score"],
                grade=grade_val,
                total_correct=eval_data["total_correct"],
                total_wrong=eval_data["total_wrong"],
                questions_json=session.questions_json,
                answers_json=json.dumps(answers, ensure_ascii=False),
                evaluation_json=json.dumps(eval_data, ensure_ascii=False),
                created_at=datetime.datetime.utcnow(),
            )
            db.add(attempt)
            db.flush()

            questions_data_local = json.loads(session.questions_json) if session.questions_json else {}
            qs = questions_data_local.get("questions", [])
            answers_local = json.loads(session.answers_json) if session.answers_json else {}
            per_q_fb = {str(f["question_id"]): f for f in eval_data.get("per_question_feedback", [])}
            review_rows = []
            for q in qs:
                qid     = str(q.get("id", ""))
                fb      = per_q_fb.get(qid, {})
                user_ans = answers_local.get(qid, "")
                review_rows.append({
                    "attempt_id": attempt.id,
                    "question_number": q.get("id", 0),
                    "topic": q.get("topic", ""),
                    "question_text": q.get("question", ""),
                    "question_type": q.get("type", ""),
                    "bloom_level": q.get("bloom_level", ""),
                    "difficulty": q.get("difficulty", ""),
                    "user_answer": user_ans,
                    "correct_answer": fb.get("correct_answer") or q.get("answer", ""),
                    "is_correct": 1 if fb.get("is_correct") else 0,
                    "ai_explanation": fb.get("feedback") or q.get("explanation", ""),
                    "material_ref": q.get("material_reference", ""),
                    "tips": q.get("tips", ""),
                    "item_score": 100 if fb.get("is_correct") else 0,
                })
            for row in review_rows:
                db.add(ExamReview(**row))

        except HTTPException:
            raise
        except SQLAlchemyError as err:
            logger.error(f"submit_and_evaluate DB error: {err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gagal memproses data ujian karena kendala database.",
            )
        except Exception as exc:
            logger.error(f"submit_and_evaluate unexpected error: {exc}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gagal menyimpan hasil ujian.",
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
            db=db,
            subject_id=session.subject_id,
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

    # ── 9. Unified Session Management ─────────────────────────────────────────
    @staticmethod
    def get_blueprints(db: Session, subject_id: int) -> list:
        from sqlalchemy import desc
        bps = (
            db.query(ExamBlueprint)
            .options(selectinload(ExamBlueprint.sessions))
            .filter(ExamBlueprint.subject_id == subject_id)
            .order_by(desc(ExamBlueprint.created_at))
            .all()
        )
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
    def get_session_detail(db: Session, session_id: int) -> dict:
        s = (
            db.query(ExamSession)
            .options(
                selectinload(ExamSession.attempts).selectinload(ExamAttempt.reviews),
                selectinload(ExamSession.plan).selectinload(StudyPlan.items),
            )
            .filter(ExamSession.id == session_id)
            .first()
        )
        if not s:
            raise ValueError("Sesi tidak ditemukan.")
        questions_data = json.loads(s.questions_json) if s.questions_json else {}
        evaluation     = json.loads(s.evaluation_json) if s.evaluation_json else None
        answers        = json.loads(s.answers_json) if s.answers_json else {}

        attempt_data = []
        for a in s.attempts:
            attempt_data.append({
                "id": a.id, "attempt_number": a.attempt_number,
                "score": a.score, "grade": a.grade,
                "total_correct": a.total_correct, "total_wrong": a.total_wrong,
                "duration_seconds": a.duration_seconds,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "reviews": [
                    {"id": r.id, "question_number": r.question_number,
                     "topic": r.topic, "question_text": r.question_text,
                     "question_type": r.question_type, "bloom_level": r.bloom_level,
                     "difficulty": r.difficulty, "user_answer": r.user_answer,
                     "correct_answer": r.correct_answer, "is_correct": bool(r.is_correct),
                     "ai_explanation": r.ai_explanation, "material_ref": r.material_ref,
                     "tips": r.tips, "item_score": r.item_score}
                    for r in a.reviews
                ],
            })

        plan_data = None
        if s.plan:
            plan_data = {
                "id": s.plan.id, "title": s.plan.title,
                "motivational_message": s.plan.motivational_message,
                "priority_actions": json.loads(s.plan.priority_actions_json) if s.plan.priority_actions_json else [],
                "total_days": s.plan.total_days, "completed_days": s.plan.completed_days,
                "progress": s.plan.progress,
                "start_date": s.plan.start_date.isoformat() if s.plan.start_date else None,
                "items": [{"id": i.id, "order_number": i.order_number, "day_label": i.day_label,
                           "topic": i.topic,
                           "activity": i.activity or fallback_activity_description(i.topic, i.activity_type or "review"),
                           "activity_type": i.activity_type,
                           "duration_minutes": i.duration_minutes,
                           "time_slot": i.time_slot or TIME_SLOTS[i.order_number % len(TIME_SLOTS)] if i.order_number is not None else "",
                           "resources": i.resources,
                           "completed": bool(i.completed)} for i in s.plan.items],
            }

        return {
            "id": s.id, "blueprint_id": s.blueprint_id, "subject_id": s.subject_id,
            "subject_name": s.subject_name, "title": s.title,
            "exam_type": s.exam_type, "difficulty": s.difficulty,
            "bloom_level": s.bloom_level, "question_type": s.question_type,
            "total_questions": s.total_questions,
            "score": s.score, "best_score": s.best_score, "latest_score": s.latest_score,
            "grade": s.grade, "progress": s.progress, "status": s.status or "active",
            "total_correct": s.total_correct, "total_wrong": s.total_wrong,
            "weak_topics": json.loads(s.weak_topics_json) if s.weak_topics_json else [],
            "strong_topics": json.loads(s.strong_topics_json) if s.strong_topics_json else [],
            "overall_feedback": evaluation.get("overall_feedback", "") if evaluation else "",
            "performance_level": evaluation.get("performance_level", "") if evaluation else "",
            "submitted": s.submitted_at is not None,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            **questions_data,
            "answers": answers,
            "evaluation": evaluation,
            "attempts": attempt_data,
            "study_plan": plan_data,
        }

    @staticmethod
    def get_unified_sessions(db: Session, subject_id: Optional[int] = None) -> list:
        """Return all sessions (history + active), ordered by started_at desc."""
        from sqlalchemy import desc
        query = (
            db.query(ExamSession)
            .options(
                selectinload(ExamSession.attempts),
                selectinload(ExamSession.plan),
            )
            .order_by(desc(ExamSession.started_at))
        )
        if subject_id:
            query = query.filter(ExamSession.subject_id == subject_id)
        sessions = query.limit(200).all()

        # Pre-load material names from blueprint_json for all sessions at once
        blueprint_ids = list({s.blueprint_id for s in sessions if s.blueprint_id})
        blueprint_material_map: dict = {}  # blueprint_id → list[str] of material names
        if blueprint_ids:
            from models import ExamBlueprint, Material
            bps = db.query(ExamBlueprint).filter(ExamBlueprint.id.in_(blueprint_ids)).all()
            # Collect all material ids needed
            all_mat_ids: set = set()
            bp_mat_ids: dict = {}  # blueprint_id → [material_id, ...]
            for bp in bps:
                try:
                    bp_data = json.loads(bp.blueprint_json) if bp.blueprint_json else {}
                    raw = bp_data.get("material_ids", "")
                    if raw:
                        ids = [int(x.strip()) for x in str(raw).split(",") if x.strip().isdigit()]
                        bp_mat_ids[bp.id] = ids
                        all_mat_ids.update(ids)
                except Exception:
                    pass
            if all_mat_ids:
                mats = db.query(Material).filter(Material.id.in_(all_mat_ids)).all()
                mat_name_map = {m.id: m.filename or f"Materi #{m.id}" for m in mats}
                for bp_id, ids in bp_mat_ids.items():
                    blueprint_material_map[bp_id] = [mat_name_map[i] for i in ids if i in mat_name_map]

        result = []
        for s in sessions:
            attempts = exam_attempt_repo.get_by_session(db, s.id)
            attempt_list = [
                {"id": a.id, "attempt_number": a.attempt_number, "score": a.score,
                 "grade": a.grade, "total_correct": a.total_correct, "total_wrong": a.total_wrong,
                 "created_at": a.created_at.isoformat() if a.created_at else None}
                for a in attempts
            ]
            plan = study_plan_repo.get_by_session(db, s.id)
            material_names = blueprint_material_map.get(s.blueprint_id, []) if s.blueprint_id else []
            result.append({
                "id": s.id, "subject_id": s.subject_id,
                "subject_name": s.subject_name,
                "title": s.title or f"Sesi #{s.id}",
                "exam_type": s.exam_type, "difficulty": s.difficulty,
                "question_type": s.question_type,
                "total_questions": s.total_questions,
                "best_score": s.best_score, "latest_score": s.latest_score,
                "grade": s.grade, "progress": s.progress, "status": s.status or "active",
                "weak_topics": json.loads(s.weak_topics_json) if s.weak_topics_json else [],
                "strong_topics": json.loads(s.strong_topics_json) if s.strong_topics_json else [],
                "attempt_count": len(attempts), "attempts": attempt_list,
                "has_study_plan": plan is not None,
                "study_plan_progress": plan.progress if plan else 0,
                "study_plan_start_date": plan.start_date.isoformat() if (plan and plan.start_date) else None,
                "material_names": material_names,
                "created_at": s.started_at.isoformat() if s.started_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            })
        return result

    @staticmethod
    def retry_inplace(
        db: Session,
        session_id: int,
        weak_topics: Optional[List[str]] = None,
        question_type: Optional[str] = None,
    ) -> dict:
        """
        Reset the SAME ExamSession with fresh questions from the bank.
        - If question_type matches (or is not provided), reset in-place (same session row).
        - If question_type DIFFERS from the blueprint's type, create a NEW session row.
        No AI call in either case.
        """
        try:
            if not (session := exam_session_repository.get(db, session_id)):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Sesi ujian ID {session_id} tidak ditemukan.",
                )

            blueprint_id = session.blueprint_id
            if not blueprint_id:
                if not (blueprint := exam_blueprint_repository.get_latest_by_subject(db, session.subject_id)):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Tidak ada blueprint untuk subjek ini.",
                    )
                blueprint_id = blueprint.id
            else:
                blueprint = exam_blueprint_repository.get(db, blueprint_id)

            if not blueprint:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Blueprint tidak ditemukan.",
                )

            # Determine if question_type differs from blueprint → need new session
            blueprint_qtype = blueprint.question_type or "mixed"
            requested_qtype = question_type or blueprint_qtype
            create_new_session = (
                question_type is not None
                and question_type != blueprint_qtype
                and question_type != "mixed"
            )

            # Resolve weak topics: use provided, or fall back to session's evaluated weak topics
            effective_weak = weak_topics
            if not effective_weak:
                try:
                    raw = json.loads(session.weak_topics_json) if session.weak_topics_json else []
                    effective_weak = [
                        w.get("topic", w) if isinstance(w, dict) else w
                        for w in raw
                    ]
                except (json.JSONDecodeError, TypeError):
                    effective_weak = []

            blueprint_data = json.loads(blueprint.blueprint_json)
            items = blueprint_data.get("blueprint_items", [])
            total_needed = blueprint.total_questions or sum(
                i.get("question_count", 1) for i in items
            )

            diff_map = {
                "pemula": "mudah", "sedang": "menengah",
                "menengah": "menengah", "ahli": "sulit", "sulit": "sulit",
            }
            mapped_diff = diff_map.get(blueprint.difficulty) if blueprint.difficulty != "campuran" else None
            # Use requested_qtype for filtering (may differ from blueprint if user chose new type)
            effective_qtype = requested_qtype if requested_qtype and requested_qtype != "mixed" else None

            weak_set = set(effective_weak or [])
            all_rows = question_bank_repository.get_by_subject(
                db, blueprint.subject_id,
                difficulty=mapped_diff,
                question_type=effective_qtype,
                limit=total_needed * 5,
            )
            if not all_rows:
                # Fallback: ignore question_type filter
                all_rows = question_bank_repository.get_by_subject(
                    db, blueprint.subject_id, limit=total_needed * 5,
                )
            if not all_rows:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Question bank kosong. Generate soal terlebih dahulu.",
                )

            weak_rows  = [r for r in all_rows if r.topic in weak_set]
            other_rows = [r for r in all_rows if r.topic not in weak_set]
            random.shuffle(weak_rows)
            random.shuffle(other_rows)

            n_weak  = min(len(weak_rows),  int(total_needed * 0.7)) if weak_rows else 0
            n_other = min(len(other_rows), total_needed - n_weak)
            selected = weak_rows[:n_weak] + other_rows[:n_other]
            random.shuffle(selected)

            if len(selected) < total_needed:
                remaining = [r for r in all_rows if r not in selected]
                random.shuffle(remaining)
                selected += remaining[:total_needed - len(selected)]

            question_bank_repository.increment_used(db, [r.id for r in selected])

            all_questions = [
                _bank_row_to_question(row, i + 1) for i, row in enumerate(selected)
            ]

            # Build title that reflects question type if changed
            qtype_label = requested_qtype.replace('_', ' ').title() if requested_qtype and requested_qtype != "mixed" else None
            base_title = blueprint_data.get('title', '')
            new_title = f"Latihan Ulang — {base_title}"
            if create_new_session and qtype_label:
                new_title = f"Latihan Ulang ({qtype_label}) — {base_title}"

            new_payload = {
                "title":            new_title,
                "exam_type":        blueprint.exam_type,
                "difficulty":       blueprint.difficulty,
                "bloom_level":      blueprint.bloom_level,
                "question_type":    requested_qtype,
                "duration_minutes": blueprint.duration_minutes,
                "questions":        all_questions,
                "is_retry":         True,
            }

            if create_new_session:
                # Different question type → create a NEW session row (new history entry)
                new_session = exam_session_repository.create_session(
                    db=db,
                    blueprint_id=blueprint_id,
                    subject_id=blueprint.subject_id,
                    questions_json=json.dumps(new_payload, ensure_ascii=False),
                )
                new_session.subject_name = session.subject_name
                new_session.exam_type    = blueprint.exam_type
                new_session.difficulty   = blueprint.difficulty
                new_session.bloom_level  = blueprint.bloom_level
                new_session.question_type = requested_qtype
                new_session.total_questions = len(all_questions)
                new_session.title        = new_title
                new_session.status       = "active"
                db.flush()
                return {"session_id": new_session.id, "is_new_session": True, **new_payload}
            else:
                # Same question type → reset in-place (preserve history row)
                session.questions_json  = json.dumps(new_payload, ensure_ascii=False)
                session.answers_json    = None
                session.score           = None
                session.total_correct   = None
                session.total_wrong     = None
                session.evaluation_json = None
                session.submitted_at    = None
                session.status          = "active"
                session.started_at      = datetime.datetime.utcnow()
                session.updated_at      = datetime.datetime.utcnow()
                db.flush()
                return {"session_id": session.id, "is_new_session": False, **new_payload}

        except HTTPException:
            raise
        except ValueError as err:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(err),
            )
        except SQLAlchemyError as err:
            logger.error(f"retry_inplace DB error: {err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gagal memulai latihan ulang.",
            )

    @staticmethod
    def unified_retry(
        db: Session,
        session_id: int,
        weak_topics: Optional[List[str]] = None,
        topic_filter: Optional[str] = None,
    ) -> dict:
        """Create a new session from question bank (zero AI) under the same session."""
        try:
            if not (session := exam_session_repository.get(db, session_id)):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Sesi ujian ID {session_id} tidak ditemukan.",
                )
            blueprint_id = session.blueprint_id
            if not blueprint_id:
                if not (blueprint := exam_blueprint_repository.get_latest_by_subject(db, session.subject_id)):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Tidak ada blueprint untuk subjek ini.",
                    )
                blueprint_id = blueprint.id

            # Use provided weak_topics, or fall back to session's evaluated weak topics
            effective_weak = weak_topics
            if not effective_weak and not topic_filter:
                try:
                    raw = json.loads(session.weak_topics_json) if session.weak_topics_json else []
                    effective_weak = [
                        w.get("topic", w) if isinstance(w, dict) else w
                        for w in raw
                    ]
                except (json.JSONDecodeError, TypeError):
                    effective_weak = []

            result = ExamService.retry_from_bank(
                db, blueprint_id,
                weak_topics=effective_weak or [],
                topic_filter=topic_filter,
            )
            return result

        except ValueError as err:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(err),
            )

        except HTTPException:
            raise
        except SQLAlchemyError as err:
            logger.error(f"unified_retry DB error: {err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gagal memulai latihan ulang.",
            )

    @staticmethod
    def save_study_plan(db: Session, session_id: int, plan_data: dict) -> dict:
        """Save/replace study plan for a session."""
        try:
            existing = study_plan_repo.get_by_session(db, session_id)
            if existing:
                db.delete(existing)

            sp_items = plan_data.get("study_plan", [])

            start_date_val = None
            raw_date = plan_data.get("start_date")
            if raw_date:
                try:
                    start_date_val = datetime.date.fromisoformat(str(raw_date)[:10])
                except (ValueError, TypeError):
                    start_date_val = None

            plan = StudyPlan(
                session_id=session_id,
                title=plan_data.get("title", "Rencana Belajar"),
                motivational_message=plan_data.get("motivational_message", ""),
                priority_actions_json=json.dumps(plan_data.get("priority_actions", []), ensure_ascii=False),
                total_days=len(sp_items),
                completed_days=0, progress=0,
                start_date=start_date_val,
                created_at=datetime.datetime.utcnow(),
                updated_at=datetime.datetime.utcnow(),
            )
            db.add(plan)
            db.flush()
            for idx, day in enumerate(sp_items):
                db.add(StudyPlanItem(
                    plan_id=plan.id, order_number=idx,
                    day_label=day.get("label", f"Hari {idx+1}"),
                    topic=day.get("topic", ""),
                    activity=day.get("activity", ""),
                    activity_type=day.get("type", "review"),
                    duration_minutes=day.get("duration_minutes"),
                    time_slot=day.get("time_slot", ""),
                    resources=day.get("resources", ""),
                    completed=0,
                ))

            return {"status": "saved"}
        except HTTPException:
            raise
        except SQLAlchemyError as err:
            logger.error(f"save_study_plan DB error: {err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gagal menyimpan rencana belajar.",
            )
        except Exception as exc:
            logger.error(f"save_study_plan error: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gagal menyimpan rencana belajar.",
            )

    @staticmethod
    def toggle_plan_item(db: Session, item_id: int) -> dict:
        item = study_plan_item_repo.toggle_completed(db, item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item tidak ditemukan.",
            )
        plan = study_plan_repo.get(db, item.plan_id)
        return {
            "item_id": item.id, "completed": bool(item.completed),
            "plan_progress": plan.progress if plan else 0,
            "plan_completed_days": plan.completed_days if plan else 0,
        }

    @staticmethod
    def delete_session(db: Session, session_id: int) -> bool:
        try:
            if not (session := exam_session_repository.get(db, session_id)):
                return False
            db.delete(session)
            return True
        except HTTPException:
            raise
        except SQLAlchemyError as err:
            logger.error(f"delete_session DB error: {err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Gagal menghapus sesi.",
            )


exam_service = ExamService()
