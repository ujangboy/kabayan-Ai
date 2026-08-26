from sqlalchemy.orm import Session
import models

class WorkspaceService:
    def get_dashboard_stats(self, db: Session):
        subjects_count = db.query(models.Subject).count()
        # Samakan konvensi dengan /api/data/overview: materi di trash tidak dihitung
        materials_count = (
            db.query(models.Material)
            .filter(models.Material.status != "Trashed")
            .count()
        )
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
