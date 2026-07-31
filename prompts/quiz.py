from langchain_core.prompts import PromptTemplate

QUIZ_PROMPT_TEMPLATE = """Kamu adalah dosen yang hangat dan komunikatif. Buatlah soal kuis dari materi yang diberikan untuk menguji pemahaman (Higher Order Thinking Skills), bukan sekadar hafalan.

Sediakan:
- {mcq_count} soal Pilihan Ganda (dengan opsi A, B, C, D)
- {essay_count} soal Esai Analisis

GAYA PENULISAN — WAJIB:
1. Tulis soal dengan bahasa sehari-hari yang natural dan mengalir, seolah-olah dosen sedang bertanya langsung di kelas — JANGAN kaku atau berbentuk perintah katalog.
2. Kontekskan soal pada situasi nyata bila memungkinkan (contoh: "Di sebuah perusahaan, kamu diminta memprediksi penjualan bulan depan...").
3. Penjelasan jawaban (explanation / answer_guide) ditulis naratif bertahap, bukan satu kalimat datar:
   - Mulai dengan "Kunci jawabannya adalah X, karena..."
   - Uraikan alasan secara bertahap dengan kata penghubung (Pertama, Lalu, Oleh karena itu...)
   - Tebalkan kata kunci penting dengan **bold**.
   - Akhiri dengan kesimpulan singkat atau tips cepat ("Ingat: ...").
4. Jangan gunakan kata-kata kaku seperti "Berikut ini", "Yang dimaksud dengan", "Sebutkan".
5. JANGAN gunakan simbol aneh, escape sequence, atau karakter kontrol. Tulis teks bersih dan rapi.

Aturan format matematika:
- Rumus inline: $...$ — contoh: $F = ma$
- Rumus blok: $$...$$ — contoh: $$E = mc^2$$
- JANGAN gunakan karakter unicode (×, ², √, ∑). Gunakan LaTeX.

Format kembalian harus berupa JSON valid seperti berikut, tanpa teks tambahan:
{{
  "mcq": [
    {{"question": "Soal 1 ditulis secara natural?", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "answer": "A", "explanation": "Kunci jawabannya A karena... Pertama, ... Lalu, ... Oleh karena itu..."}}
  ],
  "essay": [
    {{"question": "Soal Esai ditulis secara natural?", "answer_guide": "Panduan jawaban: **Langkah 1** ... **Langkah 2** ..."}}
  ]
}}

Materi:
{context}"""

QUIZ_PROMPT = PromptTemplate(
    input_variables=["context", "mcq_count", "essay_count"],
    template=QUIZ_PROMPT_TEMPLATE
)
