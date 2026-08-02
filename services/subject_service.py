from repositories.subject_repository import subject_repository
from services.cache_service import cache_service
from sqlalchemy.orm import Session
from models import Subject
from typing import List, Optional
import datetime


def compute_subject_stats(db: Session, subject: Subject) -> dict:
    """Hitung statistik agregat subject dari data terkait (quiz, ujian, flashcard, materi).

    Dipakai untuk list response (tanpa persist). Nilai yang sama di-persist oleh
    `SubjectService.recalculate_subject_stats` saat aktivitas baru masuk.
    """
    from models import Quiz, ExamSession, Flashcard, Material

    quiz_rows = db.query(Quiz).filter(Quiz.subject_id == subject.id).all()
    sessions = db.query(ExamSession).filter(ExamSession.subject_id == subject.id).all()
    flashcard_count = db.query(Flashcard).filter(Flashcard.subject_id == subject.id).count()
    material_count = db.query(Material).filter(Material.subject_id == subject.id).count()

    scores: List[int] = []
    for q in quiz_rows:
        if q.score is not None:
            scores.append(q.score)
    for s in sessions:
        if s.best_score is not None:
            scores.append(s.best_score)
        elif s.latest_score is not None:
            scores.append(s.latest_score)

    activity_times: List[datetime.datetime] = []
    for q in quiz_rows:
        if q.created_at:
            activity_times.append(q.created_at)
    for f in db.query(Flashcard).filter(Flashcard.subject_id == subject.id).all():
        if f.created_at:
            activity_times.append(f.created_at)
    for s in sessions:
        activity_times.append(s.submitted_at or s.updated_at or s.started_at)
    for m in db.query(Material).filter(Material.subject_id == subject.id).all():
        if m.upload_date:
            activity_times.append(m.upload_date)

    return {
        "best_score": max(scores) if scores else None,
        "avg_score": round(sum(scores) / len(scores)) if scores else None,
        "total_quizzes": len(quiz_rows),
        "total_flashcards": flashcard_count,
        "total_materials": material_count,
        "last_activity_at": max(activity_times).isoformat() if activity_times else None,
    }


class SubjectService:
    @staticmethod
    def get_all(db: Session) -> List[Subject]:
        return subject_repository.get_all(db)

    @staticmethod
    def get_by_id(db: Session, id: int) -> Optional[Subject]:
        return subject_repository.get(db, id)

    @staticmethod
    def create(db: Session, name: str, semester: str, lecturer: str, description: str) -> Subject:
        return subject_repository.create(db, {
            "name": name,
            "semester": semester,
            "lecturer": lecturer,
            "description": description
        })

    @staticmethod
    def update(db: Session, id: int, name: str, semester: str, lecturer: str, description: str) -> Optional[Subject]:
        subject = subject_repository.get(db, id)
        if not subject:
            return None
        subject.name = name
        subject.semester = semester
        subject.lecturer = lecturer
        subject.description = description
        db.commit()
        db.refresh(subject)
        return subject

    @staticmethod
    def delete(db: Session, id: int) -> bool:
        success = subject_repository.delete(db, id)
        if success:
            cache_service.invalidate_all(db)
        return success

    @staticmethod
    def recalculate_subject_stats(db: Session, subject_id: int) -> Optional[Subject]:
        """Hitung ulang + persist statistik agregat untuk satu subject."""
        subject = subject_repository.get(db, subject_id)
        if not subject:
            return None
        stats = compute_subject_stats(db, subject)
        subject.best_score = stats["best_score"]
        subject.avg_score = stats["avg_score"]
        subject.total_quizzes = stats["total_quizzes"]
        subject.total_flashcards = stats["total_flashcards"]
        subject.total_materials = stats["total_materials"]
        if stats["last_activity_at"]:
            subject.last_activity_at = datetime.datetime.fromisoformat(stats["last_activity_at"])
        db.commit()
        db.refresh(subject)
        return subject


subject_service = SubjectService()
