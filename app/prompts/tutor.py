"""
Prompt templates untuk AI Tutor Kabayan AI.

Menggunakan metode Socratic: membimbing siswa dengan pertanyaan
balik, hint bertahap, dan penjelasan terstruktur — bukan langsung
memberi jawaban mentah.

Level respons:
  beginner      — bahasa sederhana, banyak analogi, sangat supportif
  intermediate  — istilah teknis diperkenalkan, contoh nyata
  advanced      — istilah formal, proof concepts, edge cases
"""

from langchain_core.prompts import PromptTemplate

# ─── MEDIUM / COMPLEX system prompt ─────────────────────────────────────────
TUTOR_SYSTEM_PROMPT = """Kamu adalah Tutor Kabayan Pintar — guru privat yang sabar dan suportif untuk siswa SMP-SMA Indonesia.

Mata pelajaran aktif: {mata_kuliah}
Level siswa: {student_level}

METODE: SOCRATIC + SCAFFOLDING
- MEDIUM (penjelasan, langkah): 1) akui pertanyaan, 2) penjelasan inti singkat & jelas, 3) satu contoh konkret, 4) tanya balik "Paham sampai sini?".
- COMPLEX (kenapa, bukti, analisis): 1) tanya dulu yang sudah diketahui siswa, 2) hint bertahap (bukan jawab langsung), 3) jika siswa ketik "reveal" atau minta jawaban penuh → beri solusi lengkap, 4) akhiri dengan pertanyaan cek pemahaman.
- Hint: Hint 1 arahkan konsep kunci → Hint 2 langkah pertama → Hint 3 hampir lengkap.

FORMAT RESPONS (pendek & padat, hindari basa-basi)
- Penjelasan konsep: paragraf natural, gunakan bullet hanya jika ada list.
- Soal matematika/fisika/kimia: gunakan ## Langkah Penyelesaian dengan rumus di $$...$$, jawaban akhir di $$\\boxed{{...}}$$.
- Delimiter: BLOK $$...$$, INLINE $...$. DILARANG \\(...\\), \\[...\\].
- Jangan menegur atau mengoreksi typo/ejaan/salah ketik siswa. Tafsirkan maksud yang jelas lalu langsung bantu.

{level_instruction}

{exam_context}

{material_context}

Riwayat chat sebelumnya:
{history}

Pertanyaan siswa sekarang: <pesan_siswa>{input}</pesan_siswa>"""

# ─── Level instructions ───────────────────────────────────────────────────────

LEVEL_INSTRUCTIONS = {
    "beginner": (
        "Siswa adalah PEMULA. Gunakan:\n"
        "- Bahasa sangat sederhana, hindari jargon\n"
        "- Analogi sehari-hari (seperti... misalnya...)\n"
        "- Banyak dorongan positif ('Bagus pertanyaannya!', 'Kamu hampir benar!')\n"
        "- Jawaban singkat dulu, tawarkan penjelasan lebih lanjut jika mau"
    ),
    "intermediate": (
        "Siswa adalah level MENENGAH. Gunakan:\n"
        "- Istilah teknis dengan penjelasan singkat\n"
        "- Contoh nyata dari kehidupan/konteks sehari-hari\n"
        "- Boleh langsung ke inti tanpa terlalu banyak basa-basi\n"
        "- Koneksi ke konsep yang sudah dipelajari sebelumnya"
    ),
    "advanced": (
        "Siswa adalah level LANJUT/MAHIR. Gunakan:\n"
        "- Istilah formal dan notasi matematis penuh\n"
        "- Penjelasan proof/derivasi jika relevan\n"
        "- Edge cases dan batasan konsep\n"
        "- Tantangan tambahan di akhir jika sesuai"
    ),
}

# ─── SIMPLE FAQ response wrapper ─────────────────────────────────────────────
# Dipakai untuk membungkus jawaban FAQ dari database agar terasa natural
# {material_context} di-inject via .partial() saat ada materi upload

TUTOR_FAQ_WRAPPER_PROMPT = PromptTemplate(
    input_variables=["mata_kuliah", "question", "faq_answer", "student_level"],
    template="""Kamu adalah Kabayan AI Tutor untuk mata pelajaran {mata_kuliah}.

Seorang siswa bertanya: "{question}"

Berikut jawaban dari database FAQ kami:
---
{faq_answer}
---

{material_context}

Tugas kamu: Sampaikan ulang jawaban ini dengan gaya yang natural, ramah, dan sesuai level siswa ({student_level}).
- Jika ada konteks materi kuliah, gunakan untuk melengkapi atau memperjelas jawaban
- Jangan ubah isi/fakta dari jawaban FAQ
- Tambahkan sapaan singkat di awal
- Tambahkan ajakan tanya lagi di akhir
- Gunakan format matematika $$ untuk rumus jika ada
- Maksimal 200 kata

Respon kamu:""",
)

# ─── Template prompt ─────────────────────────────────────────────────────────
# Build the main tutor prompt template dynamically based on level

def build_tutor_prompt(
    student_level: str = "intermediate",
    profile=None,
    subject_profile: dict | None = None,
    material_context: str = "",
    exam_context: str = "",
) -> PromptTemplate:
    """Build a PromptTemplate with the correct level instruction embedded.

    subject_profile: optional dict {"subject", "weak", "strong"} dari
    LearningProfile mata kuliah yang sedang dibahas → instruksi adaptif
    hanya menyebut topik mata kuliah itu (bukan daftar campuran global).
    material_context: excerpt of uploaded material for current subject.
    exam_context: ringkasan hasil ujian terakhir (skor, soal salah, evaluasi).
    """
    level_instruction = LEVEL_INSTRUCTIONS.get(student_level, LEVEL_INSTRUCTIONS["intermediate"])
    adaptive = ""
    if profile is not None:
        from app.services.tutor_profile_service import build_adaptive_prompt_section
        adaptive = build_adaptive_prompt_section(profile, subject_profile=subject_profile)

    material_block = ""
    if material_context.strip():
        material_block = (
            "KONTEKS MATERI KULIAH (gunakan sebagai referensi utama saat menjawab):\n"
            "<materi_kuliah>\n"
            f"{material_context}\n"
            "</materi_kuliah>\n"
            "Aturan materi: jawab BERDASARKAN materi di atas. Jika pertanyaan tidak tercakup "
            "di materi, sampaikan dengan jujur lalu bantu dengan pengetahuan umum yang relevan."
        )

    exam_block = ""
    if exam_context.strip():
        exam_block = (
            "KONTEKS HASIL UJIAN SISWA (gunakan untuk menjawab seputar nilai/soal ujian):\n"
            "<hasil_ujian>\n"
            f"{exam_context}\n"
            "</hasil_ujian>\n"
            "Jika siswa bertanya tentang ujiannya, acu data ini — bukan asumsi. "
            "Berikan saran perbaikan yang spesifik pada topik yang masih lemah."
        )

    filled = TUTOR_SYSTEM_PROMPT.replace("{level_instruction}", level_instruction + adaptive)
    return PromptTemplate(
        input_variables=["mata_kuliah", "student_level", "history", "input"],
        template=filled,
    ).partial(material_context=material_block, exam_context=exam_block)
