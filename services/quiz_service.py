from services.ai_service import ai_service
from prompts.quiz import QUIZ_PROMPT
from repositories.quiz_repository import quiz_repository
from sqlalchemy.orm import Session
import json
import re
import datetime


def _sanitize_json_str(s: str) -> str:
    s = re.sub(r'\\([^"\\bfnrtu/])', r'\\\\\1', s)
    s = re.sub(r',\s*([}\]])', r'\1', s)
    return s


def _extract_json(raw: str) -> str:
    s = raw.strip()
    for pat in [r'```json\s*([\s\S]*?)\s*```', r'```\s*([\s\S]*?)\s*```']:
        m = re.search(pat, s)
        if m:
            return m.group(1).strip()
    start = s.find('{')
    if start >= 0:
        depth, end = 0, start
        for i, ch in enumerate(s[start:], start):
            if ch == '{': depth += 1
            elif ch == '}': depth -= 1
            if depth == 0:
                end = i + 1
                break
        if end > start:
            return s[start:end]
    return s


class QuizService:
    @staticmethod
    def _normalize_options(options) -> list:
        if isinstance(options, list):
            return options
        if isinstance(options, dict):
            return [f"{k}. {v}" for k, v in options.items()]
        return []

    @staticmethod
    def _normalize_answer(answer: str, options: list) -> str:
        if not isinstance(options, list):
            return answer
        if answer in options:
            return answer
        for opt in options:
            if isinstance(opt, str) and opt.startswith(f"{answer}."):
                return opt
        return answer

    @staticmethod
    def generate_quiz(db: Session, subject_id: int, context: str,
                      mcq_count: int = 5, essay_count: int = 0, title: str = None):
        result = ai_service.generate(
            capability="quiz",
            prompt_template=QUIZ_PROMPT,
            input_variables={"context": context, "mcq_count": mcq_count, "essay_count": essay_count},
            use_cache=False,
        )

        try:
            json_str = _extract_json(str(result))
            json_str = _sanitize_json_str(json_str)
            data = json.loads(json_str)
            if isinstance(data, list):
                data = {"mcq": data}

            if not data.get("mcq"):
                raise ValueError("AI tidak menghasilkan soal MCQ.")

            for q in data.get("mcq", []):
                normalized_opts = QuizService._normalize_options(q.get("options", []))
                normalized_ans = QuizService._normalize_answer(q.get("answer", ""), normalized_opts)
                q["options"] = normalized_opts
                q["answer"] = normalized_ans

            import models
            quiz_record = models.Quiz(
                subject_id=subject_id,
                title=title,
                score=None,
                questions_json=json.dumps(data, ensure_ascii=False),
                created_at=datetime.datetime.utcnow(),
            )
            db.add(quiz_record)
            db.flush()
            db.refresh(quiz_record)

            return {"id": quiz_record.id, **data}

        except (json.JSONDecodeError, Exception) as e:
            snippet = str(result)[:300] if result else ""
            raise ValueError(f"AI gagal: {e}\nResponse: {snippet}")

    @staticmethod
    def save_score(db: Session, quiz_id: int, score: int):
        """Update score setelah user selesai mengerjakan quiz."""
        quiz = quiz_repository.get(db, quiz_id)
        if quiz:
            quiz.score = score
            db.flush()
            db.refresh(quiz)
        return quiz

quiz_service = QuizService()
