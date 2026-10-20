import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Enum, UniqueConstraint, Boolean, Float, Index
from sqlalchemy.orm import relationship
import datetime
from time_utils import utcnow
from database import Base

class MaterialType(str, enum.Enum):
    # Tipe aktif — sudah ada router + parser
    PDF      = "PDF"
    DOCX     = "DOCX"
    TXT      = "TXT"
    MARKDOWN = "MARKDOWN"
    YOUTUBE  = "YOUTUBE"
    PPTX     = "PPTX"
    XLSX     = "XLSX"

    # Planned — belum ada implementasi router/parser
    # WEBSITE = "WEBSITE"
    # IMAGE   = "IMAGE"
    # GITHUB  = "GITHUB"
    # NOTION  = "NOTION"

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    semester = Column(String)
    lecturer = Column(String)
    description = Column(Text)
    created_at = Column(DateTime, default=utcnow, nullable=True)
    # ─── Statistik agregat (denormalized, dihitung oleh recalculate_subject_stats) ───
    best_score = Column(Integer, nullable=True)          # skor tertinggi dari quiz + simulasi ujian
    avg_score = Column(Integer, nullable=True)           # rata-rata skor quiz + simulasi ujian
    total_quizzes = Column(Integer, default=0)           # jumlah quiz untuk subject ini
    total_flashcards = Column(Integer, default=0)        # jumlah flashcard untuk subject ini
    total_materials = Column(Integer, default=0)         # jumlah materi untuk subject ini
    last_activity_at = Column(DateTime, nullable=True)   # aktivitas terakhir (upload/quiz/ujian/flashcard)
    status = Column(String(20), default="active", nullable=True)  # 'active' | 'trashed' (soft-delete)

    materials = relationship("Material", back_populates="subject", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="subject", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="subject", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="subject", cascade="all, delete-orphan")

class Material(Base):
    __tablename__ = "materials"
    __table_args__ = (
        Index("ix_materials_type_external_id", "material_type", "external_id", unique=True),
    )
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    filename = Column(String)
    filepath = Column(String)
    material_type = Column(Enum(MaterialType))
    source_url = Column(String, nullable=True)
    external_id = Column(String, nullable=True)
    thumbnail = Column(String, nullable=True)
    language = Column(String, nullable=True)
    status = Column(String, default="Ready", index=True) # Pending, Processing, Ready, Failed
    failure_reason = Column(Text, nullable=True)
    progress = Column(Integer, default=0, nullable=False) # 0-100, untuk UI progress bar
    stage = Column(String, nullable=True)                 # label tahap pemrosesan (untuk UI)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    upload_date = Column(DateTime, default=utcnow, index=True)

    subject = relationship("Subject", back_populates="materials")

class Note(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    title = Column(String)
    content = Column(Text)
    is_pinned = Column(Boolean, default=False, nullable=False, server_default="0")
    created_at = Column(DateTime, default=utcnow)

    subject = relationship("Subject", back_populates="notes")

class Flashcard(Base):
    __tablename__ = "flashcards"
    __table_args__ = (
        Index("idx_flashcards_subject_created", "subject_id", "created_at"),
    )
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    title = Column(String, nullable=True)          # nama set flashcard (opsional)
    batch_id = Column(String, nullable=True)       # UUID batch untuk membedakan hasil generate
    question = Column(Text)
    answer = Column(Text)
    material_ids = Column(Text, nullable=True)     # comma-separated material IDs
    created_at = Column(DateTime, default=utcnow)
    # ─── Spaced Repetition fields (Fase 3: SRS) ───
    ease_factor = Column(Integer, default=250)     # 2.5 dalam satuan 1/100 (250 = 2.50)
    interval = Column(Integer, default=1)          # interval review dalam hari
    next_review = Column(DateTime, nullable=True)  # kapan kartu harus direview lagi
    times_seen = Column(Integer, default=0)        # berapa kali kartu direview
    times_correct = Column(Integer, default=0)     # berapa kali dinilai benar/ingat
    last_reviewed = Column(DateTime, nullable=True)
    mastered = Column(Integer, default=0)          # 1 = sudah dikuasai (interval >= 21 hari)
    # ─── FSRS state (Fase 3: FSRS) — JSON serialisasi Card fsrs (v6.3) ───
    fsrs_state = Column(Text, nullable=True)       # {"stability","difficulty","due","state",...}

    subject = relationship("Subject", back_populates="flashcards")
    reviews = relationship("FlashcardReview", back_populates="flashcard", cascade="all, delete-orphan")


class FlashcardReview(Base):
    """Riwayat penilaian per kartu untuk spaced repetition."""
    __tablename__ = "flashcard_reviews"
    id = Column(Integer, primary_key=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id", ondelete="CASCADE"), index=True, nullable=False)
    rating = Column(Integer)                        # 0=Lupa, 1=Sulit, 2=Biasa, 3=Mudah, 4=Sempurna
    reviewed_at = Column(DateTime, default=utcnow)
    next_review = Column(DateTime, nullable=True)
    response_time_ms = Column(Integer, nullable=True)  # lama berpikir sebelum menjawab (ms)

    flashcard = relationship("Flashcard", back_populates="reviews")

class Quiz(Base):
    __tablename__ = "quizzes"
    __table_args__ = (
        Index("idx_quizzes_subject_created", "subject_id", "created_at"),
    )
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    title = Column(String, nullable=True)          # judul quiz (opsional)
    score = Column(Integer, nullable=True)         # null = belum dimainkan
    questions_json = Column(Text, nullable=True)   # JSON string hasil generate AI
    material_ids = Column(Text, nullable=True)     # comma-separated material IDs
    created_at = Column(DateTime, default=utcnow)
    # ─── Tracking fields (Fase 2: quiz enhanced) ───
    question_type = Column(String, nullable=True)          # mcq / essay / mixed
    total_questions = Column(Integer, default=0)           # jumlah total soal (mcq + essay)
    correct_count = Column(Integer, nullable=True)         # jumlah benar di attempt terakhir
    wrong_count = Column(Integer, nullable=True)           # jumlah salah di attempt terakhir
    time_taken = Column(Integer, nullable=True)            # durasi pengerjaan (detik) attempt terakhir
    attempt_count = Column(Integer, default=0)             # berapa kali quiz dimainkan
    difficulty = Column(String, nullable=True)             # mudah / sedang / sulit

    subject = relationship("Subject", back_populates="quizzes")

class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    session_uuid = Column(String, unique=True, nullable=True, index=True)
    title = Column(String)
    created_at = Column(DateTime, default=utcnow)
    tutor_enabled = Column(Boolean, default=False, nullable=False, server_default="0")

    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_chat_id_timestamp", "chat_id", "timestamp"),
    )
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), index=True)
    role = Column(String) # user or assistant
    content = Column(Text)
    timestamp = Column(DateTime, default=utcnow)
    # Tutor mode metadata (nullable — normal chat rows stay untouched)
    type = Column(String, nullable=True)              # simple / medium / complex
    tokens_used = Column(Integer, nullable=True)      # estimated tokens consumed

    chat = relationship("Chat", back_populates="messages")

class Cache(Base):
    __tablename__ = "caches"
    __table_args__ = (
        UniqueConstraint('prompt_hash', 'context_hash', 'setting_hash', name='uq_cache_hash'),
    )
    id = Column(Integer, primary_key=True, index=True)
    prompt_hash = Column(String, index=True)
    context_hash = Column(String, index=True)
    setting_hash = Column(String, index=True)
    response = Column(Text)
    created_at = Column(DateTime, default=utcnow)
    expired_at = Column(DateTime, nullable=True)

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)
    description = Column(Text)


class UsageLog(Base):
    """Log per-panggilan AI (Groq) untuk jendela pemakaian sliding 24 jam.

    Berbeda dengan akumulasi `Setting` (`usage.*`) yang berlaku seumur hidup,
    tabel ini mencatat tiap panggilan beserta timestamp sehingga `get_usage(period="24h")`
    bisa menghitung total dalam 24 jam terakhir secara akurat.
    """
    __tablename__ = "usage_logs"
    id = Column(Integer, primary_key=True, index=True)
    feature = Column(String, index=True)        # capability: chat, tutor, quiz, ...
    tokens = Column(Integer, default=0)
    calls = Column(Integer, default=1)
    created_at = Column(DateTime, default=utcnow, index=True)


class TrashItem(Base):
    """Metadata file yang dipindah ke folder sampah — agar bisa di-restore.

    Saat materi dihapus (soft-delete), record `Material` ditandai status
    "Trashed" (row tetap ada) sementara file fisik dipindah ke
    storage/trash dengan nama unik. Tabel ini mencatat pemetaan nama unik di
    trash <-> path asli sehingga restore bisa mengembalikan file & status.
    """
    __tablename__ = "trash_items"
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, nullable=True, index=True)  # jika berasal dari materi
    source_type = Column(String, default="material")          # material / orphan
    original_path = Column(String)                            # path asli (uploads/...)
    trash_path = Column(String)                               # path file di storage/trash
    original_filename = Column(String)                        # nama asli untuk ditampilkan
    original_status = Column(String, nullable=True)           # status Materi saat di-soft-delete
    size_bytes = Column(Integer, default=0)
    trashed_at = Column(DateTime, default=utcnow)

class YoutubeMetadata(Base):
    __tablename__ = "youtube_metadata"
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"), index=True)
    video_id = Column(String, index=True)
    title = Column(String)
    channel_name = Column(String)
    channel_id = Column(String, nullable=True)
    duration = Column(Integer) # in seconds
    publish_date = Column(String, nullable=True)
    thumbnail_url = Column(String)
    video_url = Column(String)
    transcript_language = Column(String)
    created_at = Column(DateTime, default=utcnow)
    
    material = relationship("Material", backref="youtube_metadata")

# ─── Exam Analyzer Models ────────────────────────────────────────────────────

class ExamBlueprint(Base):
    """Blueprint ujian yang di-generate AI sebelum soal dibuat."""
    __tablename__ = "exam_blueprints"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    title = Column(String)                        # mis. "Blueprint UAS Struktur Data"
    exam_type = Column(String)                    # latihan/kuis/uts/uas/custom
    difficulty = Column(String)                   # pemula/menengah/sulit/campuran
    bloom_level = Column(String)                  # remember/understand/.../mixed
    question_type = Column(String)                # mcq/truefalse/essay/mixed
    total_questions = Column(Integer)
    duration_minutes = Column(Integer, nullable=True)
    blueprint_json = Column(Text)                 # JSON: list topik + bobot + jumlah soal
    analysis_json = Column(Text, nullable=True)   # JSON: topic priority + weakness
    created_at = Column(DateTime, default=utcnow)

    subject = relationship("Subject")
    sessions = relationship("ExamSession", back_populates="blueprint", cascade="all, delete-orphan")


class ExamSession(Base):
    """
    Satu sesi pengerjaan simulasi ujian (unified: active + history).
    Setelah migrasi, semua data histori disimpan di sini.
    """
    __tablename__ = "exam_sessions"
    __table_args__ = (
        Index("idx_exam_sessions_subject_status_started", "subject_id", "status", "started_at"),
    )
    id = Column(Integer, primary_key=True, index=True)
    blueprint_id = Column(Integer, ForeignKey("exam_blueprints.id", ondelete="SET NULL"))
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    # --- Active session fields (original) ---
    questions_json = Column(Text)                 # JSON: list soal lengkap + kunci + pembahasan
    answers_json = Column(Text, nullable=True)    # JSON: jawaban user per soal
    score = Column(Integer, nullable=True)        # null = belum submit
    total_correct = Column(Integer, nullable=True)
    total_wrong = Column(Integer, nullable=True)
    evaluation_json = Column(Text, nullable=True) # JSON: topik lemah, topik kuat, rekomendasi
    started_at = Column(DateTime, default=utcnow)
    submitted_at = Column(DateTime, nullable=True)
    # --- History fields (from ExamHistorySession, added by migration) ---
    subject_name = Column(String, nullable=True)
    title = Column(String, nullable=True)
    exam_type = Column(String, nullable=True)
    difficulty = Column(String, nullable=True)
    bloom_level = Column(String, nullable=True)
    question_type = Column(String, nullable=True)
    total_questions = Column(Integer, nullable=True)
    best_score = Column(Integer, nullable=True)
    latest_score = Column(Integer, nullable=True)
    grade = Column(String, nullable=True)
    progress = Column(Integer, default=0)
    status = Column(String, default='active', index=True)     # active / completed / archived / mastered
    weak_topics_json = Column(Text, nullable=True)
    strong_topics_json = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    blueprint = relationship("ExamBlueprint", back_populates="sessions")
    subject = relationship("Subject")
    attempts = relationship("ExamAttempt", back_populates="session", cascade="all, delete-orphan")
    plan = relationship("StudyPlan", back_populates="session", cascade="all, delete-orphan", uselist=False)


class ExamAttempt(Base):
    """Each time a user retries, a new attempt row is added."""
    __tablename__ = "exam_attempts"
    id             = Column(Integer, primary_key=True, index=True)
    session_id     = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), index=True)
    attempt_number = Column(Integer, default=1)
    score          = Column(Integer, nullable=True)
    grade          = Column(String, nullable=True)
    total_correct  = Column(Integer, nullable=True)
    total_wrong    = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    questions_json = Column(Text, nullable=True)   # questions used in this attempt
    answers_json   = Column(Text, nullable=True)   # user answers
    evaluation_json= Column(Text, nullable=True)   # full AI evaluation
    created_at     = Column(DateTime, default=utcnow)

    session = relationship("ExamSession", back_populates="attempts")
    reviews = relationship("ExamReview", back_populates="attempt", cascade="all, delete-orphan")


class ExamReview(Base):
    """Per-question review data for each attempt."""
    __tablename__ = "exam_reviews"
    id             = Column(Integer, primary_key=True, index=True)
    attempt_id     = Column(Integer, ForeignKey("exam_attempts.id", ondelete="CASCADE"), index=True)
    question_number= Column(Integer)
    topic          = Column(String, nullable=True)
    question_text  = Column(Text)
    question_type  = Column(String, nullable=True)
    bloom_level    = Column(String, nullable=True)
    difficulty     = Column(String, nullable=True)
    user_answer    = Column(Text, nullable=True)
    correct_answer = Column(Text, nullable=True)
    is_correct     = Column(Integer, default=0)    # 0/1
    ai_explanation = Column(Text, nullable=True)
    material_ref   = Column(String, nullable=True)
    tips           = Column(String, nullable=True)
    item_score     = Column(Integer, nullable=True) # partial score 0-100

    attempt = relationship("ExamAttempt", back_populates="reviews")


class StudyPlan(Base):
    """AI-generated learning roadmap attached to an ExamSession."""
    __tablename__ = "study_plans"
    id                 = Column(Integer, primary_key=True, index=True)
    session_id         = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), index=True)
    title              = Column(String, nullable=True)
    motivational_message = Column(Text, nullable=True)
    priority_actions_json = Column(Text, nullable=True)  # JSON list of strings
    total_days         = Column(Integer, default=7)
    completed_days     = Column(Integer, default=0)
    progress           = Column(Integer, default=0)      # 0-100
    start_date         = Column(Date, nullable=True)
    created_at         = Column(DateTime, default=utcnow)
    updated_at         = Column(DateTime, default=utcnow, onupdate=utcnow)

    session = relationship("ExamSession", back_populates="plan")
    items   = relationship("StudyPlanItem", back_populates="plan", cascade="all, delete-orphan", order_by="StudyPlanItem.order_number")


class StudyPlanItem(Base):
    """One day/step in a StudyPlan."""
    __tablename__ = "study_plan_items"
    id             = Column(Integer, primary_key=True, index=True)
    plan_id        = Column(Integer, ForeignKey("study_plans.id", ondelete="CASCADE"), index=True)
    order_number   = Column(Integer, default=0)
    day_label      = Column(String, nullable=True)       # "Hari 1"
    topic          = Column(String)
    activity       = Column(Text, nullable=True)
    activity_type  = Column(String, nullable=True)       # review/practice/simulation/rest
    duration_minutes = Column(Integer, nullable=True)
    time_slot      = Column(Text, nullable=True)         # "Pagi (08:00–09:00)"
    resources      = Column(Text, nullable=True)
    completed      = Column(Integer, default=0)          # 0/1
    summary        = Column(Text, nullable=True)         # rangkuman AI per topik item

    plan = relationship("StudyPlan", back_populates="items")
    practice_results = relationship("PracticeResult", back_populates="plan_item", cascade="all, delete-orphan", order_by="PracticeResult.created_at")


class PracticeResult(Base):
    """Hasil latihan (quiz / flashcard) yang dikerjakan dari item rencana belajar."""
    __tablename__ = "practice_results"
    id                 = Column(Integer, primary_key=True)
    plan_item_id       = Column(Integer, ForeignKey("study_plan_items.id", ondelete="CASCADE"), index=True, nullable=False)
    session_id         = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), index=True)
    practice_type      = Column(String, default="quiz")  # quiz / flashcard / practice
    quiz_id            = Column(Integer, ForeignKey("quizzes.id", ondelete="SET NULL"), nullable=True, index=True)  # FK quiz jika practice dari quiz list; quiz dihapus → NULL (bukan yatim)
    score              = Column(Integer, nullable=True)  # 0-100
    total_questions    = Column(Integer, nullable=True)
    correct_count      = Column(Integer, nullable=True)
    flashcard_reviewed = Column(Integer, nullable=True)  # jumlah kartu yang direview
    time_taken_seconds = Column(Integer, nullable=True)
    created_at         = Column(DateTime, default=utcnow)

    plan_item = relationship("StudyPlanItem", back_populates="practice_results")
    session   = relationship("ExamSession")


# ─── Question Bank Model ─────────────────────────────────────────────────────

# ─── AI Tutor Models ─────────────────────────────────────────────────────────

class TutorFAQ(Base):
    """
    Pre-built FAQ entries for the Smart Classifier SIMPLE route.
    Answered from database with 0 token cost.
    """
    __tablename__ = "tutor_faq"
    id = Column(Integer, primary_key=True)
    mata_kuliah = Column(String, index=True)          # e.g. "Matematika"
    topic = Column(String, index=True)                # e.g. "Limit"
    keywords_json = Column(Text)                      # JSON list of keywords
    question = Column(Text)
    answer = Column(Text)
    difficulty = Column(String, default="sedang")     # mudah / sedang / sulit
    usage_count = Column(Integer, default=0, nullable=False)
    effectiveness = Column(Integer, default=80, nullable=False)       # 0-100
    created_at = Column(DateTime, default=utcnow)
    updated_by = Column(String, nullable=True)
    last_updated = Column(DateTime, nullable=True)


class TutorTemplate(Base):
    """
    Formula / procedure / example templates for structured responses.
    Used to enrich SIMPLE route answers without AI calls.
    """
    __tablename__ = "tutor_templates"
    id = Column(Integer, primary_key=True)
    mata_kuliah = Column(String, index=True)
    type = Column(String, default="formula")          # formula / procedure / example
    title = Column(String)
    content = Column(Text)                            # content with {{variable}} placeholders
    variables_json = Column(Text, nullable=True)      # JSON: [{name, description, type}]
    usage_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow)


class TutorFeedback(Base):
    """
    Feedback siswa terhadap respons tutor (rating + flag opsional).

    Aplikasi ini single-user lokal (tidak ada tabel users), sehingga user_key
    memakai nilai default "local". message_id menjadi kunci utama; chat_id
    diturunkan dari pesan agar tidak pernah melanggar foreign key.
    """
    __tablename__ = "tutor_feedback"
    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), index=True, nullable=True)
    user_key = Column(String, default="local", index=True, nullable=False)
    rating = Column(String, nullable=False)           # helpful / somewhat / not_helpful
    comment = Column(Text, nullable=True)
    flag = Column(String, nullable=True)              # incorrect / unclear / irrelevant / inappropriate
    created_at = Column(DateTime, default=utcnow)


class TutorUserProfile(Base):
    """
    Profil adaptif siswa untuk personalisasi respons tutor.

    Aplikasi single-user lokal → user_key default "local" (singleton).
    Nilai-nilai di bawah ini memengaruhi prompt system tutor agar respons
    disesuaikan dengan kebutuhan dan tingkat penguasaan siswa.
    """
    __tablename__ = "tutor_user_profile"
    id = Column(Integer, primary_key=True, index=True)
    user_key = Column(String, default="local", unique=True, index=True)

    estimated_level = Column(Integer, default=50)          # 0-100, semakin tinggi semakin mahir
    topics_mastery = Column(Text, nullable=True)            # JSON {topic: score 0-100}
    weak_topics = Column(Text, nullable=True)               # JSON [topic, ...]
    strong_topics = Column(Text, nullable=True)             # JSON [topic, ...]

    explanation_depth = Column(String, default="medium")    # brief / medium / detailed
    response_length = Column(String, default="medium")      # short / medium / long
    use_formulas = Column(Boolean, default=True)
    use_examples = Column(Boolean, default=True)
    use_step_by_step = Column(Boolean, default=True)

    total_sessions = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)
    helpful_rate = Column(Float, nullable=True)

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ─── Question Bank Model ─────────────────────────────────────────────────────

class QuestionBank(Base):
    """
    Persistent question pool generated by AI and reused across exam sessions.
    AI writes here once; Python reads from here forever.
    """
    __tablename__ = "question_bank"
    id             = Column(Integer, primary_key=True, index=True)
    subject_id     = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    blueprint_id   = Column(Integer, ForeignKey("exam_blueprints.id", ondelete="SET NULL"), nullable=True, index=True)
    # Taxonomy
    chapter        = Column(String, nullable=True)   # optional bab/chapter label
    topic          = Column(String, index=True)
    difficulty     = Column(String, index=True)      # mudah / menengah / sulit
    bloom_level    = Column(String, nullable=True)
    question_type  = Column(String, index=True)      # mcq / truefalse / short_answer / essay / …
    # Content
    question       = Column(Text)
    choices_json   = Column(Text, nullable=True)     # JSON: {"A":"…","B":"…","C":"…","D":"…"}
    correct_answer = Column(String)                  # "A" for MCQ, text for essay
    explanation    = Column(Text, nullable=True)     # pre-generated or lazy-loaded explanation
    material_ref   = Column(String, nullable=True)
    tips           = Column(String, nullable=True)
    # Metadata
    created_by_ai  = Column(Integer, default=1)      # 1 = AI-generated
    used_count     = Column(Integer, default=0)      # how many times drawn from bank
    created_at     = Column(DateTime, default=utcnow)

    subject   = relationship("Subject")
    blueprint = relationship("ExamBlueprint")


class LearningProfile(Base):
    """
    Profil belajar jangka panjang per mata kuliah (adaptive learning).

    Single-user lokal → user_key default "local", satu baris per subject_id.
    Di-update otomatis setelah submit ujian (ingest_session), lalu diinjeksi
    sebagai {adaptive_instructions} ke prompt blueprint & soal.
    """
    __tablename__ = "learning_profiles"
    __table_args__ = (
        UniqueConstraint("user_key", "subject_id", name="uq_learning_profile_user_subject"),
    )
    id = Column(Integer, primary_key=True, index=True)
    user_key = Column(String, default="local", index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    topics_mastery = Column(Text, nullable=True)   # JSON {topic: {"accuracy": int, "attempts": int, "sessions": int}}
    weak_topics = Column(Text, nullable=True)      # JSON [topic, ...] — hanya jika data cukup (confidence threshold)
    strong_topics = Column(Text, nullable=True)    # JSON [topic, ...] — hanya jika data cukup (confidence threshold)
    topic_trend_json = Column(Text, nullable=True) # JSON {topic: [acc_sesi1, acc_sesi2, ...]} — trend per sesi
    estimated_level = Column(Integer, default=0)   # 0-100; 0 = belum ada data evaluasi (cold start)
    total_sessions = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    total_correct = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    subject = relationship("Subject")


class AudioGeneration(Base):
    """
    Hasil generate audio TTS (EdgeTTS) dari isi materi (full text).

    Single-user lokal. 1 materi bisa punya beberapa generate (beda voice).
    File disimpan di storage/static/audio/<uuid>.mp3 dan dilayani via
    endpoint router audio (bukan static mount global).
    """
    __tablename__ = "audio_generations"
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"), index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), index=True)
    voice = Column(String)  # voice id, mis. id-ID-ArdiNeural
    status = Column(String, default="Processing", index=True)  # Processing | Ready | Failed | Cancelled
    progress = Column(Integer, default=0, nullable=False)
    stage = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    duration_sec = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    material = relationship("Material")
    subject = relationship("Subject")
