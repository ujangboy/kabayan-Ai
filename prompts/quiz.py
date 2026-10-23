from langchain_core.prompts import PromptTemplate

QUIZ_PROMPT_TEMPLATE = """Kamu dosen yang hangat dan komunikatif. Buat soal kuis dari materi berikut.

KESULITAN: {difficulty}
{difficulty_instruction}

Sediakan:
- {mcq_count} soal pilihan ganda (opsi A, B, C, D)
- {essay_count} soal esai analisis

ATURAN WAJIB:
1. Bahasa natural seperti dosen bertanya di kelas; kaitkan dengan situasi nyata bila relevan.
2. Jangan memakai frasa kaku ("Berikut ini", "Yang dimaksud dengan", "Sebutkan").
3. explanation/answer_guide ditulis naratif bertahap: mulai "Kunci jawabannya adalah X, karena...", uraikan dengan kata penghubung (Pertama, Lalu, Oleh karena itu), tebalkan kata kunci dengan **bold**, tutup dengan "Ingat: ...".
4. Teks bersih: tanpa karakter kontrol, escape aneh, atau simbol unicode matematika (×, ², √, ∑).
5. Matematika: $...$ untuk inline, $$...$$ untuk blok.

Balas HANYA JSON valid (tanpa markdown/teks lain):
{{
  "mcq": [
    {{"question": "...", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "answer": "A", "explanation": "Kunci jawabannya A karena... Pertama, ... Lalu, ... Oleh karena itu..."}}
  ],
  "essay": [
    {{"question": "...", "answer_guide": "Panduan jawaban: **Langkah 1** ... **Langkah 2** ..."}}
  ]
}}

Materi:
{context}"""

DIFFICULTY_INSTRUCTIONS = {
    "mudah": (
        "Buat soal yang menguji ingatan dan pemahaman dasar (Bloom: Remember & Understand). "
        "Soal bersifat faktual dan langsung, pilihan jawaban jelas perbedaannya, tidak ada jebakan. "
        "Cocok untuk mahasiswa yang baru mengenal materi."
    ),
    "sedang": (
        "Buat soal yang menguji pemahaman dan penerapan konsep (Bloom: Understand & Apply). "
        "Sertakan distractors yang masuk akal, soal memerlukan sedikit analisis. "
        "Cocok untuk mahasiswa yang sudah mempelajari materi dasar."
    ),
    "sulit": (
        "Buat soal Higher Order Thinking Skills / HOTS (Bloom: Analyze, Evaluate, Create). "
        "Soal memerlukan penalaran, perbandingan antar konsep, atau penerapan di situasi baru yang kompleks. "
        "Distractors sangat mirip dan memerlukan pemikiran kritis untuk memilih jawaban benar."
    ),
}

QUIZ_PROMPT = PromptTemplate(
    input_variables=["context", "mcq_count", "essay_count", "difficulty", "difficulty_instruction"],
    template=QUIZ_PROMPT_TEMPLATE
)
