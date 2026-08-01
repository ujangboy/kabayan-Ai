from services.ai_service import ai_service
from prompts.quiz import QUIZ_PROMPT
from repositories.quiz_repository import quiz_repository
from services.json_utils import parse_ai_json
from sqlalchemy.orm import Session
import json
import datetime


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
                      mcq_count: int = 5, essay_count: int = 0, title: str = None,
                      material_ids: str = None):
        result = ai_service.generate(
            capability="quiz",
            prompt_template=QUIZ_PROMPT,
            input_variables={"context": context, "mcq_count": mcq_count, "essay_count": essay_count},
            use_cache=False,
            temperature=0.7,
        )

        try:
            data = parse_ai_json(result, "Quiz AI")
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
                material_ids=material_ids,
                created_at=datetime.datetime.utcnow(),
            )
            db.add(quiz_record)
            db.flush()
            db.refresh(quiz_record)

            return {"id": quiz_record.id, **data}

        except (ValueError, Exception) as e:
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
