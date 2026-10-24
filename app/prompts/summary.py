from langchain_core.prompts import PromptTemplate

SUMMARY_PROMPT_TEMPLATE = """Buatlah rangkuman materi dari teks yang diberikan.

ATURAN RANGKUMAN:
1. Gunakan format bullet points untuk kemudahan membaca.
2. Tebalkan (bold) istilah-istilah kunci atau konsep utama.
3. Selalu akhiri rangkuman dengan paragraf "Kesimpulan Singkat" (maksimal 3 kalimat).
4. FORMAT MATEMATIKA — wajib:
   - Rumus inline: $...$ — contoh: $v = s/t$
   - Rumus blok: $$...$$ pada baris tersendiri
   - JANGAN gunakan unicode matematika (×, ², √, ∑, ∫). Gunakan LaTeX.

Teks Materi:
{context}

Instruksi Tambahan: {input}"""

SUMMARY_PROMPT = PromptTemplate(
    input_variables=["context", "input"],
    template=SUMMARY_PROMPT_TEMPLATE
)
