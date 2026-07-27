import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
import datetime
from database import Base

class MaterialType(str, enum.Enum):
    # Tipe aktif — sudah ada router + parser
    PDF      = "PDF"
    DOCX     = "DOCX"
    TXT      = "TXT"
    MARKDOWN = "MARKDOWN"
    YOUTUBE  = "YOUTUBE"

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

    materials = relationship("Material", back_populates="subject", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="subject", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="subject", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="subject", cascade="all, delete-orphan")

class Material(Base):
    __tablename__ = "materials"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    filename = Column(String)
    filepath = Column(String)
    material_type = Column(Enum(MaterialType), default=MaterialType.PDF)
    source_url = Column(String, nullable=True)
    external_id = Column(String, nullable=True)
    thumbnail = Column(String, nullable=True)
    language = Column(String, nullable=True)
    status = Column(String, default="Ready") # Pending, Processing, Ready, Failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="materials")

class Note(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    title = Column(String)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="notes")

class Flashcard(Base):
    __tablename__ = "flashcards"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    title = Column(String, nullable=True)          # nama set flashcard (opsional)
    question = Column(Text)
    answer = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="flashcards")

class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    title = Column(String, nullable=True)          # judul quiz (opsional)
    score = Column(Integer, nullable=True)         # null = belum dimainkan
    questions_json = Column(Text, nullable=True)   # JSON string hasil generate AI
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="quizzes")

class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"))
    role = Column(String) # user or assistant
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

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
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expired_at = Column(DateTime, nullable=True)

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)
    description = Column(Text)

class YoutubeMetadata(Base):
    __tablename__ = "youtube_metadata"
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"))
    video_id = Column(String, index=True)
    title = Column(String)
    channel_name = Column(String)
    channel_id = Column(String, nullable=True)
    duration = Column(Integer) # in seconds
    publish_date = Column(String, nullable=True)
    thumbnail_url = Column(String)
    video_url = Column(String)
    transcript_language = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    material = relationship("Material", backref="youtube_metadata")

class AudioGeneration(Base):
    __tablename__ = "audio_generations"
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"))
    filepath = Column(String)
    status = Column(String, default="processing") # processing, done, failed
    engine_used = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    material = relationship("Material", backref="audio_generations")

# ─── Exam Analyzer Models ────────────────────────────────────────────────────

class ExamBlueprint(Base):
    """Blueprint ujian yang di-generate AI sebelum soal dibuat."""
    __tablename__ = "exam_blueprints"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    title = Column(String)                        # mis. "Blueprint UAS Struktur Data"
    exam_type = Column(String)                    # latihan/kuis/uts/uas/custom
    difficulty = Column(String)                   # pemula/menengah/sulit/campuran
    bloom_level = Column(String)                  # remember/understand/.../mixed
    question_type = Column(String)                # mcq/truefalse/essay/mixed
    total_questions = Column(Integer)
    duration_minutes = Column(Integer, nullable=True)
    blueprint_json = Column(Text)                 # JSON: list topik + bobot + jumlah soal
    analysis_json = Column(Text, nullable=True)   # JSON: topic priority + weakness
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject")
    sessions = relationship("ExamSession", back_populates="blueprint", cascade="all, delete-orphan")


class ExamSession(Base):
    """Satu sesi pengerjaan simulasi ujian."""
    __tablename__ = "exam_sessions"
    id = Column(Integer, primary_key=True, index=True)
    blueprint_id = Column(Integer, ForeignKey("exam_blueprints.id"))
    subject_id = Column(Integer, ForeignKey("subjects.id"))
    questions_json = Column(Text)                 # JSON: list soal lengkap + kunci + pembahasan
    answers_json = Column(Text, nullable=True)    # JSON: jawaban user per soal
    score = Column(Integer, nullable=True)        # null = belum submit
    total_correct = Column(Integer, nullable=True)
    total_wrong = Column(Integer, nullable=True)
    evaluation_json = Column(Text, nullable=True) # JSON: topik lemah, topik kuat, rekomendasi
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)

    blueprint = relationship("ExamBlueprint", back_populates="sessions")
    subject = relationship("Subject")


# ─── Exam History Models ─────────────────────────────────────────────────────

class ExamHistorySession(Base):
    """
    Persistent exam history entry created when user clicks "Selesai".
    One session can have many attempts (retry).
    """
    __tablename__ = "exam_history_sessions"
    id           = Column(Integer, primary_key=True, index=True)
    subject_id   = Column(Integer, ForeignKey("subjects.id"))
    subject_name = Column(String)                        # denormalized for display
    title        = Column(String)                        # e.g. "UTS Machine Learning"
    exam_type    = Column(String)                        # uts/uas/quiz/latihan/custom
    difficulty   = Column(String)                        # pemula/menengah/sulit/campuran
    bloom_level  = Column(String, nullable=True)
    question_type= Column(String, nullable=True)
    total_questions = Column(Integer, nullable=True)
    # Latest attempt stats (updated on each retry)
    best_score   = Column(Integer, nullable=True)
    latest_score = Column(Integer, nullable=True)
    grade        = Column(String, nullable=True)         # A/B/C/D/E
    progress     = Column(Integer, default=0)            # 0-100 %
    status       = Column(String, default="completed")   # draft/sedang_belajar/completed/mastered/archived
    # Weak/strong topics (JSON arrays)
    weak_topics_json   = Column(Text, nullable=True)
    strong_topics_json = Column(Text, nullable=True)
    # Full evaluation & questions snapshots
    evaluation_json    = Column(Text, nullable=True)
    questions_json     = Column(Text, nullable=True)
    answers_json       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    subject  = relationship("Subject")
    attempts = relationship("ExamAttempt",   back_populates="history_session", cascade="all, delete-orphan")
    plan     = relationship("StudyPlan",     back_populates="history_session", cascade="all, delete-orphan", uselist=False)


class ExamAttempt(Base):
    """Each time a user retries, a new attempt row is added."""
    __tablename__ = "exam_attempts"
    id             = Column(Integer, primary_key=True, index=True)
    history_session_id = Column(Integer, ForeignKey("exam_history_sessions.id"))
    attempt_number = Column(Integer, default=1)
    score          = Column(Integer, nullable=True)
    grade          = Column(String, nullable=True)
    total_correct  = Column(Integer, nullable=True)
    total_wrong    = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    questions_json = Column(Text, nullable=True)   # questions used in this attempt
    answers_json   = Column(Text, nullable=True)   # user answers
    evaluation_json= Column(Text, nullable=True)   # full AI evaluation
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)

    history_session = relationship("ExamHistorySession", back_populates="attempts")
    reviews         = relationship("ExamReview", back_populates="attempt", cascade="all, delete-orphan")


class ExamReview(Base):
    """Per-question review data for each attempt."""
    __tablename__ = "exam_reviews"
    id             = Column(Integer, primary_key=True, index=True)
    attempt_id     = Column(Integer, ForeignKey("exam_attempts.id"))
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
    """AI-generated learning roadmap attached to an ExamHistorySession."""
    __tablename__ = "study_plans"
    id                 = Column(Integer, primary_key=True, index=True)
    history_session_id = Column(Integer, ForeignKey("exam_history_sessions.id"))
    title              = Column(String, nullable=True)
    motivational_message = Column(Text, nullable=True)
    priority_actions_json = Column(Text, nullable=True)  # JSON list of strings
    total_days         = Column(Integer, default=7)
    completed_days     = Column(Integer, default=0)
    progress           = Column(Integer, default=0)      # 0-100
    created_at         = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at         = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    history_session = relationship("ExamHistorySession", back_populates="plan")
    items           = relationship("StudyPlanItem", back_populates="plan", cascade="all, delete-orphan", order_by="StudyPlanItem.order_number")


class StudyPlanItem(Base):
    """One day/step in a StudyPlan."""
    __tablename__ = "study_plan_items"
    id             = Column(Integer, primary_key=True, index=True)
    plan_id        = Column(Integer, ForeignKey("study_plans.id"))
    order_number   = Column(Integer, default=0)
    day_label      = Column(String, nullable=True)       # "Hari 1"
    topic          = Column(String)
    activity       = Column(Text, nullable=True)
    activity_type  = Column(String, nullable=True)       # review/practice/simulation/rest
    duration_minutes = Column(Integer, nullable=True)
    resources      = Column(Text, nullable=True)
    completed      = Column(Integer, default=0)          # 0/1

    plan = relationship("StudyPlan", back_populates="items")


# ─── Question Bank Model ─────────────────────────────────────────────────────

class QuestionBank(Base):
    """
    Persistent question pool generated by AI and reused across exam sessions.
    AI writes here once; Python reads from here forever.
    """
    __tablename__ = "question_bank"
    id             = Column(Integer, primary_key=True, index=True)
    subject_id     = Column(Integer, ForeignKey("subjects.id"), index=True)
    blueprint_id   = Column(Integer, ForeignKey("exam_blueprints.id"), nullable=True, index=True)
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
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)

    subject   = relationship("Subject")
    blueprint = relationship("ExamBlueprint")
