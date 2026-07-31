from sqlalchemy.orm import Session
import models

class WorkspaceService:
    @staticmethod
    def get_dashboard_stats(db: Session):
        subjects_count = db.query(models.Subject).count()
        materials_count = db.query(models.Material).count()
        notes_count = db.query(models.Note).count()
        flashcards_count = db.query(models.Flashcard).count()
        quizzes_count = db.query(models.Quiz).count()
        
        return {
            "subjects": subjects_count,
            "materials": materials_count,
            "notes": notes_count,
            "flashcards": flashcards_count,
            "quizzes": quizzes_count
        }

workspace_service = WorkspaceService()
