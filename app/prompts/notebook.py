from langchain_core.prompts import PromptTemplate

DETECT_CONTEXT_TEMPLATE = """Analisis riwayat chat berikut. Extract mata_kuliah dan topic yang dibahas.

Daftar mata kuliah tersedia: {subjects}

Riwayat chat:
{chat_history}

Rule:
- mata_kuliah harus salah satu dari daftar di atas, atau "tidak_diketahui" jika tidak cocok
- topic: topik spesifik yang dibahas dalam chat
- JANGAN tebak atau inventif — hanya extract yang jelas dari konteks
- Respond ONLY in JSON, tidak ada teks lain:
{{"mata_kuliah": "...", "topic": "..."}}"""

DETECT_CONTEXT_PROMPT = PromptTemplate(
    input_variables=["subjects", "chat_history"],
    template=DETECT_CONTEXT_TEMPLATE,
)

GENERATE_TITLE_TEMPLATE = """Buat judul singkat (maksimal 10 kata) untuk catatan pembelajaran ini:

{content}

Aturan:
- Gunakan "Cara...", "Penjelasan...", "Ringkasan...", atau format deskriptif lain
- Hindari judul generik seperti "Jawaban" atau "Informasi"
- Sertakan konsep kunci jika memungkinkan
- Bahasa Indonesia
- Respond ONLY dengan judul, tanpa tanda kutip atau formatting tambahan

Judul:"""

GENERATE_TITLE_PROMPT = PromptTemplate(
    input_variables=["content"],
    template=GENERATE_TITLE_TEMPLATE,
)