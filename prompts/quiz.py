from langchain_core.prompts import PromptTemplate

QUIZ_PROMPT_TEMPLATE = """Buatlah soal kuis dari materi yang diberikan untuk menguji pemahaman (Higher Order Thinking Skills), bukan sekadar hafalan.

Sediakan:
- {mcq_count} soal Pilihan Ganda (dengan opsi A, B, C, D)
- {essay_count} soal Esai Analisis

Aturan format matematika:
- Rumus inline: $...$ — contoh: $F = ma$
- Rumus blok: $$...$$ — contoh: $$E = mc^2$$
- JANGAN gunakan karakter unicode (×, ², √, ∑). Gunakan LaTeX.

Format kembalian harus berupa JSON valid seperti berikut, tanpa teks tambahan:
{{
  "mcq": [
    {{"question": "Soal 1?", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "answer": "A", "explanation": "Penjelasan mengapa A benar"}}
  ],
  "essay": [
    {{"question": "Soal Esai?", "answer_guide": "Panduan jawaban yang benar"}}
  ]
}}

Materi:
{context}"""

QUIZ_PROMPT = PromptTemplate(
    input_variables=["context", "mcq_count", "essay_count"],
    template=QUIZ_PROMPT_TEMPLATE
)
