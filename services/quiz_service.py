from services.ai_service import ai_service
from prompts.quiz import QUIZ_PROMPT, DIFFICULTY_INSTRUCTIONS
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
                      material_ids: str = None, difficulty: str = "sedang"):
        # Ambil instruksi sesuai tingkat kesulitan, fallback ke sedang
        difficulty = difficulty if difficulty in DIFFICULTY_INSTRUCTIONS else "sedang"
        difficulty_instruction = DIFFICULTY_INSTRUCTIONS[difficulty]

        result = ai_service.generate(
            capability="quiz",
            prompt_template=QUIZ_PROMPT,
            input_variables={
                "context": context,
                "mcq_count": mcq_count,
                "essay_count": essay_count,
                "difficulty": difficulty,
                "difficulty_instruction": difficulty_instruction,
            },
            use_cache=False,
            temperature=0.7,
        )

        try:
            data = parse_ai_json(result, "Quiz AI")
            if isinstance(data, list):
                data = {"mcq": data}

            if not data.get("mcq") and not data.get("essay"):
                raise ValueError("AI tidak menghasilkan soal.")
            if not data.get("mcq"):
                data["mcq"] = []

            for q in data.get("mcq", []):
                normalized_opts = QuizService._normalize_options(q.get("options", []))
                normalized_ans = QuizService._normalize_answer(q.get("answer", ""), normalized_opts)
                q["options"] = normalized_opts
                q["answer"] = normalized_ans

            import models
            mcq_count_final = len(data.get("mcq", []))
            essay_list = data.get("essay", []) or []
            essay_count_final = len(essay_list) if isinstance(essay_list, list) else 0
            quiz_record = models.Quiz(
                subject_id=subject_id,
                title=title,
                score=None,
                questions_json=json.dumps(data, ensure_ascii=False),
                material_ids=material_ids,
                question_type="mixed" if (mcq_count_final > 0 and essay_count_final > 0) else ("essay" if mcq_count_final == 0 else "mcq"),
                total_questions=mcq_count_final + essay_count_final,
                attempt_count=0,
                difficulty=difficulty,
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
    def save_score(db: Session, quiz_id: int, score: int, correct_count: int = None,
                   wrong_count: int = None, time_taken: int = None, total_questions: int = None):
        """Update score + tracking setelah user selesai mengerjakan quiz."""
        quiz = quiz_repository.get(db, quiz_id)
        if quiz:
            quiz.score = score
            if correct_count is not None:
                quiz.correct_count = correct_count
            if wrong_count is not None:
                quiz.wrong_count = wrong_count
            if time_taken is not None:
                quiz.time_taken = time_taken
            if total_questions is not None:
                quiz.total_questions = total_questions
            quiz.attempt_count = (quiz.attempt_count or 0) + 1
            db.flush()
            db.refresh(quiz)
        return quiz

quiz_service = QuizService()
