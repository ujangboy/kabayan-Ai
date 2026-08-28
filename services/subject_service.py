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

    Semua agregasi dilakukan di SQL (GROUP BY implisit via fungsi agregat) —
    4 query tetap regardless jumlah baris, tanpa memuat row penuh ke memori
    (sebelumnya N+1: ±5 query + full-table load per subject).
    """
    from models import Quiz, ExamSession, Flashcard, Material
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
        return subject_repository.get_all(db, limit=None)

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
        # Kumpulkan materi milik subject SEBELUM cascade delete untuk cleanup
        # RAG index & TrashItem yatim (material_id tanpa FK → tidak ter-cascade).
        from models import Material, TrashItem
        mat_ids = [m.id for m in db.query(Material.id).filter(Material.subject_id == id).all()]

        success = subject_repository.delete(db, id)
        if success:
            # 1) Chunk RAG semua materi subject tidak boleh tetap searchable
            try:
                from services.rag_service import rag_service
                for mid in mat_ids:
                    rag_service.delete_document_chunks(f"mat_{mid}")
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning(
                    f"subject_delete: gagal bersihkan chunk RAG subject {id}: {exc}"
                )

            # 2) TrashItem yang menunjuk materi subject yang sudah terhapus
            if mat_ids:
                db.query(TrashItem).filter(TrashItem.material_id.in_(mat_ids)).delete(
                    synchronize_session=False
                )
                db.commit()

            cache_service.invalidate_all(db)
            # D2: file materi milik subject yang cascade-delete jadi yatim → sweep ke trash
            from services.storage_cleanup_service import cleanup_orphan_files
            cleanup_orphan_files(db)
        return success

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
