from services.ai_service import ai_service
from prompts.quiz import QUIZ_PROMPT
from repositories.quiz_repository import quiz_repository
from sqlalchemy.orm import Session
import json
import re
import datetime

class QuizService:
    @staticmethod
    def _normalize_options(options) -> list:
        """Normalisasi options {A:..., B:...} → ['A. ...', 'B. ...'] atau kembalikan list apa adanya."""
        if isinstance(options, list):
            return options
        if isinstance(options, dict):
            return [f"{k}. {v}" for k, v in options.items()]
        return []

    @staticmethod
    def _normalize_answer(answer: str, options: list) -> str:
        """Normalisasi answer key 'A' → full option string agar cocok dengan options array."""
        if not isinstance(options, list):
            return answer
        if answer in options:
            return answer
        for opt in options:
            if isinstance(opt, str) and opt.startswith(f"{answer}."):
                return opt
        return answer

    @staticmethod
    def _sanitize_json_str(s: str) -> str:
        """Fix common AI JSON issues: unescaped backslashes, trailing commas."""
        # Fix unescaped backslashes that aren't valid JSON escapes
        # Valid escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
        valid_escapes = set('"\bfnrtu/')
        result = []
        i = 0
        while i < len(s):
            if s[i] == '\\' and i + 1 < len(s) and s[i+1] not in valid_escapes and s[i+1] != '\n':
                # Invalid escape - escape the backslash itself
                result.append('\\\\')
            else:
                result.append(s[i])
            i += 1
        s = ''.join(result)
        # Remove trailing commas before } or ]
        s = re.sub(r',\s*([}\]])', r'\1', s)
        return s

    @staticmethod
    def generate_quiz(db: Session, subject_id: int, context: str,
                      mcq_count: int = 5, essay_count: int = 0, title: str = None):
        """Generate quiz dari context, simpan soal ke DB sebagai questions_json, return quiz ID + data."""
        response = ai_service.generate(
            capability="quiz",
            prompt_template=QUIZ_PROMPT,
            input_variables={"context": context, "mcq_count": mcq_count, "essay_count": essay_count},
            use_cache=False
        )

        try:
            # Proteksi Output Parsing (JSON Guard)
            match = re.search(r'```json\s*([\s\S]*?)\s*```', response)
            if match:
                json_str = match.group(1)
            else:
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                json_str = json_match.group(0) if json_match else response
            data = json.loads(QuizService._sanitize_json_str(json_str.strip()))

            if not data.get("mcq"):
                raise ValueError("AI tidak menghasilkan soal MCQ.")

            # Normalisasi options & answer setiap soal
            for q in data.get("mcq", []):
                normalized_opts = QuizService._normalize_options(q.get("options", []))
                normalized_ans = QuizService._normalize_answer(q.get("answer", ""), normalized_opts)
                q["options"] = normalized_opts
                q["answer"] = normalized_ans

            # Simpan quiz ke DB — score null sampai user selesai bermain
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

            # Return data lengkap + id untuk frontend
            return {"id": quiz_record.id, **data}

        except json.JSONDecodeError as e:
            raise ValueError(f"AI tidak mengembalikan JSON yang valid: {str(e)}\nResponse: {response[:300]}")
        except Exception as e:
            raise ValueError(f"Gagal menyimpan quiz: {str(e)}")

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
