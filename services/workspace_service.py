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

    @staticmethod
    def get_recent_activities(db: Session):
        activities = []
        recent_materials = db.query(models.Material).order_by(models.Material.upload_date.desc()).limit(3).all()
        for m in recent_materials:
            activities.append({
                "type": "Material",
                "icon": "fa-file-pdf",
                "title": f"Materi Baru: {m.filename}",
                "date": m.upload_date
            })
            
        recent_notes = db.query(models.Note).order_by(models.Note.created_at.desc()).limit(3).all()
        for n in recent_notes:
            activities.append({
                "type": "Note",
                "icon": "fa-edit",
                "title": f"Catatan Baru: {n.title}",
                "date": n.created_at
            })
            
        recent_quizzes = db.query(models.Quiz).order_by(models.Quiz.created_at.desc()).limit(3).all()
        for q in recent_quizzes:
            activities.append({
                "type": "Quiz",
                "icon": "fa-question-circle",
                "title": f"Menyelesaikan Quiz dengan skor {q.score}",
                "date": q.created_at
            })
            
        activities.sort(key=lambda x: x["date"] or __import__('datetime').datetime.min, reverse=True)
        return activities[:5]

workspace_service = WorkspaceService()
