from langchain_core.prompts import PromptTemplate

FLASHCARD_PROMPT_TEMPLATE = """WAJIB: Hasilkan TEPAT {count} flashcard — tidak kurang, tidak lebih. \
Jika variasi konsep tidak cukup, buat soal dari sudut pandang berbeda (definisi, contoh, penerapan, perbandingan).

Ekstrak teks berikut menjadi daftar flashcard (pertanyaan dan jawaban singkat).

GAYA PENULISAN — WAJIB:
1. Tulis pertanyaan dengan bahasa sehari-hari yang natural, seperti teman belajar yang bertanya — JANGAN kaku.
2. Pertanyaan harus spesifik dan jelas (bukan pernyataan yang diganti tanda tanya).
3. Jawaban ditulis singkat namun alami dan mudah dipahami — seperti sedang menjelaskan ke teman.
4. Tebalkan istilah penting dengan **bold** di jawaban.
5. Untuk konsep bertahap, gunakan penjelasan ringkas dengan kata penghubung (Pertama, Lalu, Jadi...).
6. JANGAN gunakan simbol aneh, escape sequence, atau karakter kontrol. Tulis teks bersih dan rapi.

Aturan format matematika:
- Rumus inline: $...$ — contoh: $E = mc^2$
- Rumus blok: $$...$$ — untuk rumus yang berdiri sendiri
- JANGAN gunakan unicode matematika (×, ², √). Gunakan LaTeX.
- PENTING: Di dalam JSON, backslash HARUS ditulis ganda. Contoh: $A \\\\cap B$ (bukan $A \\cap B$). Ini karena JSON membutuhkan escape backslash.

Kembalikan array JSON dengan TEPAT {count} elemen, tanpa teks tambahan (pastikan JSON valid):
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
