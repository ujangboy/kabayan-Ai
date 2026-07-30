from langchain_core.prompts import PromptTemplate

FLASHCARD_PROMPT_TEMPLATE = """Ekstrak teks berikut menjadi daftar flashcard (pertanyaan dan jawaban singkat).

Aturan format matematika:
- Rumus inline: $...$ — contoh: $E = mc^2$
- Rumus blok: $$...$$ — untuk rumus yang berdiri sendiri
- JANGAN gunakan unicode matematika (×, ², √). Gunakan LaTeX.

Hanya kembalikan format array JSON seperti contoh ini, tanpa teks tambahan (pastikan JSON valid). Buatkan tepat {count} flashcard.
[
  {{"question": "Apa itu X?", "answer": "X adalah Y."}}
]

Teks:
{context}"""

FLASHCARD_PROMPT = PromptTemplate(
    input_variables=["context", "count"],
    template=FLASHCARD_PROMPT_TEMPLATE
)
