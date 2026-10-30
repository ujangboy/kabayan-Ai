# AI Agent Context & Navigation Map (ai_context.md)

> **PETUNJUK UNTUK AI AGENT:** 
> Baca file ini terlebih dahulu sebelum memproses permintaan user. Dilarang melakukan scanning menyeluruh ke seluruh folder project secara berulang (pemborosan token/I-O). Gunakan indeks lokasi di bawah ini untuk langsung menuju file yang tepat.

---

## 1. Lingkungan Sistem & Koridor Kerja
*   **Mode Aplikasi:** Lokal / Personal Hybrid AI (Single User).
*   **LLM Engine:** Groq API (Gunakan hanya untuk penalaran, ringkasan, dan ekstraksi akhir).
*   **Penyimpanan & Knowledge Base:** Lokal (Gunakan *Vector Index* LanceDB atau pembacaan file langsung via path terindeks).

---

## 2. Peta Folder & Lokasi File (Index Map)
Agar hemat token, langsung tuju file/folder spesifik berdasarkan kebutuhan tugas:

*   **Konfigurasi & API Key:** `kabayan-pintar/.env` (Jangan pernah dibaca ulang kecuali inisialisasi awal).
*   **Routing API Backend:** `routers/` atau `main.py` (Tempat mendaftarkan endpoint FastAPI).
*   **Logika Bisnis & Fitur AI:** `services/` (Tempat pemrosesan materi, pembuatan kuis/flashcard).
*   **Akses Database & RAG:** `services/rag_service.py` (LanceDB vector store + similarity search).
*   **Penyimpanan Dokumen User:** `storage/` atau `materials/` (Folder lokal tempat file PDF/DOCX kuliah disimpan).

---

## 3. Protokol Hemat Token & Efisiensi Pencarian (Anti-Waste Protocol)

AI Agent **WAJIB** mematuhi aturan pencarian berikut untuk mencegah pembengkakan biaya API Groq dan *load* RAM lokal:

### A. Aturan Pencarian File (Search Strategy)
1.  **Gunakan RAG (LanceDB) Terlebih Dahulu:** Jika user menanyakan isi materi kuliah, **dilarang** membaca seluruh isi file PDF/DOCX mentah secara langsung ke prompt Groq. Lakukan *similarity search* via `rag_service.search()`, ambil maksimal **3-5 chunk paling relevan**, lalu kirim hanya chunk tersebut ke Groq.
2.  **Pencarian Berdasarkan Path Langsung:** Jika user meminta modifikasi kode, minta user menentukan nama filenya atau tebak berdasarkan *Peta Folder (Section 2)*. Jangan lakukan *looping* `os.walk()` yang mengirimkan isi direktori ke LLM.

### B. Pembatasan Konteks & Token Guard
*   **Batas Maksimal Konteks Prompt:** Maksimal **4,000 - 8,000 token** per request (sesuaikan dengan model Groq yang aktif).
*   **Ringkasan Riwayat Chat (Chat History):** Jangan mengirimkan seluruh riwayat chat harian ke Groq. Lakukan *sliding window* (hanya ambil 5-10 pesan terakhir) atau simpan ringkasan (*summary*) chat lama di lokal untuk dikirim sebagai context singkat.

---

## 4. Alur Penanganan File & Ekstraksi Data (Data Pipeline)

```text
[Input File User] 
       │
       ▼
[Validasi Lokal (REQ-01)] -> Maks 50MB & Format Sesuai
       │
       ▼
[Chunking & Embedding] -> Text dipecah per 500-1000 karakter lokal
       │
       ▼
[Simpan ke LanceDB/DB] -> Data tersimpan rapi di lokal Anda
       │
       ▼
[Query User] -> AI hanya mengambil chunk relevan -> Kirim ke Groq (Hemat Token!)
```
