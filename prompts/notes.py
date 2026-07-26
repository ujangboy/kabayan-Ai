from langchain_core.prompts import PromptTemplate

NOTES_PROMPT_TEMPLATE = """Buatkan catatan studi terstruktur dari materi berikut.

ATURAN:
1. Buat judul utama yang relevan.
2. Bagi catatan ke dalam beberapa sub-bab yang logis.
3. Gunakan formatting Markdown (H1, H2, lists, bold) untuk menonjolkan poin penting.
4. Buat agar catatan mudah dibaca dan dipahami untuk mengulang pelajaran.
5. FORMAT MATEMATIKA — wajib:
   - Rumus inline: $...$ — contoh: massa jenis adalah $\rho = m/V$
   - Rumus blok: $$...$$ pada baris tersendiri
   - JANGAN gunakan unicode matematika (×, ², √, ∑, ∫). Gunakan LaTeX.

Materi:
{context}"""

NOTES_PROMPT = PromptTemplate(
    input_variables=["context"],
    template=NOTES_PROMPT_TEMPLATE
)
