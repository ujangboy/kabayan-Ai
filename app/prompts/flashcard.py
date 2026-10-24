from langchain_core.prompts import PromptTemplate

FLASHCARD_PROMPT_TEMPLATE = """Hasilkan TEPAT {count} flashcard dari teks berikut — tidak kurang, tidak lebih. \
Jika variasi konsep tidak cukup, ambil sudut pandang berbeda (definisi, contoh, penerapan, perbandingan).

ATURAN WAJIB:
1. Pertanyaan natural dan spesifik, bukan pernyataan yang hanya diganti tanda tanya.
2. Jawaban singkat, alami, mudah dipahami; tebalkan istilah penting dengan **bold**.
3. Matematika: $...$ untuk inline, $$...$$ untuk blok; jangan unicode (×, ², √).
4. Di dalam JSON, backslash HARUS ditulis ganda. Contoh: $A \\\\cap B$ (bukan $A \\cap B$).
5. Teks bersih: tanpa karakter kontrol atau escape aneh.

Balas HANYA array JSON valid berisi TEPAT {count} elemen (tanpa markdown/teks lain):
[
  {{"question": "Apa itu X?", "answer": "X adalah Y. Kuncinya, **Y** selalu ..."}},
  {{"question": "Bagaimana cara kerja X?", "answer": "X bekerja dengan ..."}}
]

Teks:
{context}"""

FLASHCARD_PROMPT = PromptTemplate(
    input_variables=["context", "count"],
    template=FLASHCARD_PROMPT_TEMPLATE
)
