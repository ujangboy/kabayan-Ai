from app.repositories.subject_repository import subject_repository
from app.services.cache_service import cache_service
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models import Subject
from typing import List, Optional
import datetime


def compute_subject_stats(db: Session, subject: Subject) -> dict:
    """Hitung statistik agregat subject dari data terkait (quiz, ujian, flashcard, materi).

    Dipakai untuk list response (tanpa persist). Nilai yang sama di-persist oleh
    `SubjectService.recalculate_subject_stats` saat aktivitas baru masuk.

    Semua agregasi dilakukan di SQL (GROUP BY implisit via fungsi agregat) —
    4 query tetap regardless jumlah baris, tanpa memuat row penuh ke memori
    (sebelumnya N+1: ±5 query + full-table load per subject).
    """
    from app.models import Quiz, ExamSession, Flashcard, Material
    from sqlalchemy import func, case

    sid = subject.id

    q_count, q_sum, q_max, q_last = (
        db.query(
            func.count(Quiz.id),
            func.sum(Quiz.score),
            func.max(Quiz.score),
            func.max(Quiz.created_at),
        )
        .filter(Quiz.subject_id == sid)
        .one()
    )

    s_best, s_latest, s_sum, s_cnt, s_act = (
        db.query(
            func.max(ExamSession.best_score),
            func.max(ExamSession.latest_score),
            # Paritas dengan semantik lama: per sesi pakai best_score,
            # fallback latest_score jika best null.
            func.sum(func.coalesce(ExamSession.best_score, ExamSession.latest_score)),
            func.count(func.coalesce(ExamSession.best_score, ExamSession.latest_score)),
            func.max(func.coalesce(ExamSession.submitted_at, ExamSession.updated_at, ExamSession.started_at)),
        )
        .filter(ExamSession.subject_id == sid)
        .one()
    )

    f_count, f_last = (
        db.query(func.count(Flashcard.id), func.max(Flashcard.created_at))
        .filter(Flashcard.subject_id == sid)
        .one()
    )

    # total_materials mengexclude Trashed; last_activity tetap menghitung semua
    # (paritas dengan perilaku lama).
    mat_count, mat_last = (
        db.query(
            func.sum(case((Material.status != "Trashed", 1), else_=0)),
            func.max(Material.upload_date),
        )
        .filter(Material.subject_id == sid)
        .one()
    )

    score_maxes = [v for v in (q_max, s_best, s_latest) if v is not None]
    total_scores = int(q_count or 0) + int(s_cnt or 0)
    sum_scores = (q_sum or 0) + (s_sum or 0)

    activity_times = [t for t in (q_last, f_last, s_act, mat_last) if t is not None]

    return {
        "best_score": max(score_maxes) if score_maxes else None,
        "avg_score": round(sum_scores / total_scores) if total_scores else None,
        "total_quizzes": int(q_count or 0),
        "total_flashcards": int(f_count or 0),
        "total_materials": int(mat_count or 0),
        "last_activity_at": max(activity_times).isoformat() if activity_times else None,
    }


class SubjectService:
    def get_all(self, db: Session) -> List[Subject]:
        # Ambil seluruh subject tanpa batas (default BaseRepository membatasi 50).
        # Subject biasanya sedikit, tapi batas bisa menyembunyikan sebagian
        # mata kuliah setelah banyak data — seperti keluhan "data hilang".
        # Kecualikan yang sudah di-trash (soft-delete).
        return (
            db.query(Subject)
            .filter(or_(Subject.status.is_(None), Subject.status != "trashed"))
            .all()
        )

    def get_trash(self, db: Session) -> List[Subject]:
        return db.query(Subject).filter(Subject.status == "trashed").all()

    def get_by_id(self, db: Session, id: int) -> Optional[Subject]:
        return subject_repository.get(db, id)

    def create(self, db: Session, name: str, semester: str, lecturer: str, description: str) -> Subject:
        return subject_repository.create(db, {
            "name": name,
            "semester": semester,
            "lecturer": lecturer,
            "description": description
        })

    def update(self, db: Session, id: int, name: str, semester: str, lecturer: str, description: str) -> Optional[Subject]:
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

    def delete(self, db: Session, id: int) -> bool:
        # SOFT-DELETE: pindahkan subject ke trash (status='trashed') TANPA menghapus
        # baris. Ini mencegah cascade hard-delete yang ikut menghapus seluruh materi,
        # sesi ujian, quiz, flashcard, dan rencana belajar sekaligus.
        subject = subject_repository.get(db, id)
        if not subject:
            return False
        subject.status = "trashed"
        db.commit()
        db.refresh(subject)
        cache_service.invalidate_all(db)
        return True

    def restore(self, db: Session, id: int) -> bool:
        subject = subject_repository.get(db, id)
        if not subject:
            return False
        subject.status = "active"
        db.commit()
        db.refresh(subject)
        cache_service.invalidate_all(db)
        return True

    def recalculate_subject_stats(self, db: Session, subject_id: int) -> Optional[Subject]:
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
