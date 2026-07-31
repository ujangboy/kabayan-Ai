from langchain_core.prompts import PromptTemplate

# ─── 1. Knowledge Analysis Prompt ────────────────────────────────────────────
ANALYSIS_PROMPT_TEMPLATE = """Kamu adalah AI akademik yang membantu mahasiswa mempersiapkan ujian.
Analisis seluruh materi kuliah berikut dan hasilkan laporan analisis komprehensif.

Materi Kuliah:
{context}

Nama Mata Kuliah: {subject_name}

Hasilkan JSON valid (tanpa teks tambahan) dengan struktur berikut:
{{
  "overview": {{
    "total_topics": <integer>,
    "estimated_study_hours": <integer>,
    "complexity_level": "Rendah|Menengah|Tinggi",
    "summary": "<ringkasan singkat isi materi dalam 2-3 kalimat>"
  }},
  "topic_priority": [
    {{
      "topic": "<nama topik>",
      "stars": <1-5>,
      "reason": "<alasan mengapa topik ini penting>",
      "subtopics": ["<subtopik 1>", "<subtopik 2>"]
    }}
  ],
  "knowledge_map": [
    {{
      "node": "<nama konsep>",
      "children": ["<konsep turunan 1>", "<konsep turunan 2>"],
      "description": "<penjelasan singkat konsep>"
    }}
  ],
  "weakness_indicators": [
    {{
      "topic": "<nama topik>",
      "reason": "<mengapa topik ini sering lemah>",
      "suggestion": "<saran belajar>"
    }}
  ]
}}"""

ANALYSIS_PROMPT = PromptTemplate(
    input_variables=["context", "subject_name"],
    template=ANALYSIS_PROMPT_TEMPLATE
)

# ─── 2. Blueprint Generator Prompt ───────────────────────────────────────────
BLUEPRINT_PROMPT_TEMPLATE = """Kamu adalah AI perancang ujian akademik.
Buat blueprint (cetak biru) ujian berdasarkan data berikut:

Nama Mata Kuliah: {subject_name}
Jenis Ujian: {exam_type}
Jumlah Soal Total: {total_questions}
Tingkat Kesulitan: {difficulty}
Level Bloom: {bloom_level}
Jenis Soal: {question_type}
Fokus Materi: {focus_material}

Analisis Topik Prioritas:
{topic_priority_json}

Hasilkan JSON valid (tanpa teks tambahan) dengan struktur berikut:
{{
  "title": "<judul blueprint, mis. Blueprint UAS Struktur Data>",
  "blueprint_items": [
    {{
      "topic": "<nama topik>",
      "weight_percent": <integer, total semua harus 100>,
      "question_count": <integer>,
      "question_types": ["<mcq|essay|truefalse|short_answer|case_study|calculation|analysis>"],
      "bloom_level": "<remember|understand|apply|analyze|evaluate|create>",
      "difficulty": "<mudah|menengah|sulit>",
      "key_concepts": ["<konsep kunci 1>", "<konsep kunci 2>"]
    }}
  ]
}}

Pastikan total weight_percent = 100 dan total question_count = {total_questions}."""

BLUEPRINT_PROMPT = PromptTemplate(
    input_variables=[
        "subject_name", "exam_type", "total_questions", "difficulty",
        "bloom_level", "question_type", "focus_material", "topic_priority_json"
    ],
    template=BLUEPRINT_PROMPT_TEMPLATE
)

# ─── 3. Question Generator Prompt ────────────────────────────────────────────
QUESTION_GEN_PROMPT_TEMPLATE = """Kamu adalah dosen yang hangat dan komunikatif. Buatlah soal ujian sesuai blueprint berikut berdasarkan materi yang diberikan.

Materi Referensi:
{context}

Blueprint Item:
- Topik: {topic}
- Jumlah Soal: {question_count}
- Jenis Soal: {question_types}
- Level Bloom: {bloom_level}
- Tingkat Kesulitan: {difficulty}
- Konsep Kunci: {key_concepts}

GAYA PENULISAN — WAJIB:
1. Tulis soal dengan bahasa sehari-hari yang natural dan mengalir, seolah-olah dosen sedang bertanya langsung di kelas — JANGAN kaku atau berbentuk perintah katalog.
2. Kontekskan soal pada situasi nyata bila memungkinkan (contoh: "Di sebuah perusahaan, kamu diminta menganalisis data penjualan...").
3. Penjelasan jawaban (explanation) ditulis naratif bertahap, bukan satu kalimat datar:
   - Mulai dengan "Kunci jawabannya adalah X, karena..."
   - Uraikan alasan secara bertahap dengan kata penghubung (Pertama, Lalu, Oleh karena itu...)
   - Tebalkan kata kunci penting dengan **bold**.
   - Akhiri dengan kesimpulan singkat atau tips cepat ("Ingat: ...").
4. Tips ditulis dengan bahasa hangat dan memotivasi — bukan perintah kaku.
5. JANGAN gunakan simbol aneh, escape sequence, atau karakter kontrol. Tulis teks bersih dan rapi.

Aturan format matematika:
- Rumus inline: $...$ — contoh: $F = ma$
- Rumus blok: $$...$$ pada baris tersendiri
- JANGAN gunakan unicode matematika (×, ², √, ∑, ∫). Gunakan LaTeX.

Hasilkan JSON valid (tanpa teks tambahan) dengan struktur:
{{
  "questions": [
    {{
      "id": <integer, urutan global>,
      "topic": "<nama topik>",
      "type": "<mcq|essay|truefalse|short_answer|case_study|calculation|analysis>",
      "bloom_level": "<level bloom>",
      "difficulty": "<mudah|menengah|sulit>",
      "question": "<teks pertanyaan ditulis secara natural>",
      "options": {{"A": "<opsi A>", "B": "<opsi B>", "C": "<opsi C>", "D": "<opsi D>"}},
      "answer": "<jawaban benar — huruf untuk MCQ/TrueFalse, teks untuk essay/short_answer>",
      "explanation": "Kunci jawabannya X karena... Pertama, ... Lalu, ... Oleh karena itu... Ingat: ...",
      "material_reference": "<referensi materi, mis. Pertemuan 3, Halaman 24>",
      "tips": "<tips hangat dan memotivasi>"
    }}
  ]
}}

Catatan:
- Untuk tipe mcq: isi options A-D, answer = huruf (A/B/C/D)
- Untuk tipe truefalse: options = {{"A": "Benar", "B": "Salah"}}, answer = A atau B
- Untuk tipe essay/short_answer/case_study/analysis/calculation: options = {{}}, answer = panduan jawaban
- Buat soal yang menguji pemahaman mendalam, bukan sekadar hafalan"""

QUESTION_GEN_PROMPT = PromptTemplate(
    input_variables=[
        "context", "topic", "question_count", "question_types",
        "bloom_level", "difficulty", "key_concepts"
    ],
    template=QUESTION_GEN_PROMPT_TEMPLATE
)

# ─── 4. Subjective Evaluation Prompt ─────────────────────────────────────────
# AI only evaluates essay/short_answer/case_study/analysis/calculation.
# All scoring math (total, grade, %) is done in Python — NOT by AI.
EVALUATION_PROMPT_TEMPLATE = """Kamu adalah evaluator akademik yang hangat dan membangun.
Tugas kamu: nilai setiap jawaban subjektif berikut dan berikan feedback yang membantu.

Mata Kuliah: {subject_name}
Jenis Ujian: {exam_type}

Soal yang perlu dinilai:
{qa_pairs}

GAYA FEEDBACK — WAJIB:
1. Tulis feedback dengan bahasa yang membangun dan memotivasi — bukan kaku atau menghakimi.
2. Gunakan **bold** untuk kata kunci penting di feedback dan penjelasan.
3. Jika benar: apresiasi singkat ("Bagus! Pemahamanmu tepat karena...").
4. Jika salah: jelaskan dengan sabar ("Sebenarnya, jawaban yang tepat adalah X karena...").

Kembalikan HANYA JSON valid berikut (tanpa teks tambahan, tanpa markdown):
{{
  "per_question_feedback": [
    {{
      "question_id": <integer — sama persis dengan nomor di atas>,
      "is_correct": <true jika jawaban pada dasarnya benar, false jika salah>,
      "score": <integer 0-100 untuk soal ini saja>,
      "feedback": "<feedback singkat dan membangun, maks 2 kalimat>",
      "explanation": "<penjelasan jawaban yang benar dengan bold kata kunci, maks 2 kalimat>"
    }}
  ]
}}

Aturan penting:
- Jangan hitung total nilai, grade, atau statistik.
- Jika tidak yakin, kembalikan is_correct: false dan score: 0.
- Hanya isi array per_question_feedback, tidak ada field lain."""

EVALUATION_PROMPT = PromptTemplate(
    input_variables=["subject_name", "exam_type", "qa_pairs"],
    template=EVALUATION_PROMPT_TEMPLATE
)


# ─── 6. Lazy Explanation Prompt ───────────────────────────────────────────────
# Called only when user explicitly clicks "Jelaskan" — result cached in bank.
EXPLANATION_PROMPT_TEMPLATE = """Jelaskan soal ujian berikut secara singkat dan jelas.

Topik: {topic}
Soal: {question}
Jawaban yang benar: {answer}

Berikan penjelasan dalam 3–5 kalimat mengapa jawaban tersebut benar,
dan apa konsep kunci yang perlu dipahami.
Gunakan bahasa Indonesia yang mudah dipahami mahasiswa.
Gunakan $...$ untuk rumus inline dan $$...$$ untuk rumus blok jika diperlukan."""

EXPLANATION_PROMPT = PromptTemplate(
    input_variables=["topic", "question", "answer"],
    template=EXPLANATION_PROMPT_TEMPLATE
)
