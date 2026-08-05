"""
Test suite for services/tutor_classifier.py

100 test samples covering:
- SIMPLE:  definisi, rumus, pertanyaan singkat
- MEDIUM:  penjelasan, langkah-langkah, hitung soal
- COMPLEX: pembuktian, kenapa/mengapa, analisis mendalam
- Follow-up inheritance
- Edge cases: empty, unicode, very long messages

Tidak membutuhkan DB atau API — pure unit tests.
"""
import pytest
from services.tutor_classifier import classify, ClassificationResult


# ─── Helper ──────────────────────────────────────────────────────────────────

def tier(msg: str, history=None) -> str:
    return classify(msg, history)["type"]


def handler(msg: str, history=None) -> str:
    return classify(msg, history)["suggested_handler"]


def confidence(msg: str, history=None) -> int:
    return classify(msg, history)["confidence"]


# ─── SIMPLE cases (30 samples) ───────────────────────────────────────────────

class TestSimple:
    def test_s01_apa_itu_limit(self):
        assert tier("Apa itu limit?") == "SIMPLE"

    def test_s02_definisi_turunan(self):
        assert tier("Definisi turunan dalam kalkulus") == "SIMPLE"

    def test_s03_rumus_luas_lingkaran(self):
        assert tier("Rumus luas lingkaran apa?") == "SIMPLE"

    def test_s04_pengertian_vektor(self):
        assert tier("Pengertian vektor dalam fisika") == "SIMPLE"

    def test_s05_apa_yang_dimaksud_fotosintesis(self):
        assert tier("Apa yang dimaksud dengan fotosintesis?") == "SIMPLE"

    def test_s06_simbol_integral(self):
        assert tier("Simbol integral itu apa?") == "SIMPLE"

    def test_s07_notasi_sigma(self):
        assert tier("Apa notasi sigma dalam matematika?") == "SIMPLE"

    def test_s08_satuan_gaya(self):
        assert tier("Satuan gaya dalam SI?") == "SIMPLE"

    def test_s09_rumus_kimia_air(self):
        assert tier("Rumus kimia air?") == "SIMPLE"

    def test_s10_kepanjangan_dna(self):
        assert tier("Kepanjangan DNA itu apa?") == "SIMPLE"

    def test_s11_definisi_ekosistem(self):
        assert tier("Definisi ekosistem") == "SIMPLE"

    def test_s12_apa_itu_rantai_makanan(self):
        assert tier("Apa itu rantai makanan?") == "SIMPLE"

    def test_s13_formula_energi_kinetik(self):
        assert tier("Formula energi kinetik?") == "SIMPLE"

    def test_s14_pengertian_sel(self):
        assert tier("Pengertian sel dalam biologi") == "SIMPLE"

    def test_s15_apa_itu_pH(self):
        assert tier("Apa itu pH?") == "SIMPLE"

    def test_s16_rumus_kecepatan(self):
        assert tier("Rumus kecepatan rata-rata?") == "SIMPLE"

    def test_s17_definisi_atom(self):
        assert tier("Definisi atom dalam kimia") == "SIMPLE"

    def test_s18_apa_itu_majas(self):
        assert tier("Apa itu majas?") == "SIMPLE"

    def test_s19_singkatan_spldv(self):
        assert tier("Singkatan SPLDV itu apa?") == "SIMPLE"

    def test_s20_notasi_himpunan(self):
        assert tier("Notasi himpunan kosong?") == "SIMPLE"

    def test_s21_rumus_phytagoras(self):
        assert tier("Rumus phytagoras") == "SIMPLE"

    def test_s22_apa_itu_gelombang(self):
        assert tier("Apa itu gelombang?") == "SIMPLE"

    def test_s23_pengertian_ikatan_kimia(self):
        assert tier("Pengertian ikatan kimia") == "SIMPLE"

    def test_s24_kapan_hukum_newton(self):
        assert tier("Kapan hukum Newton pertama kali dirumuskan?") == "SIMPLE"

    def test_s25_apa_itu_tata_bahasa(self):
        assert tier("Apa itu tata bahasa?") == "SIMPLE"

    def test_s26_definisi_paragraf(self):
        assert tier("Definisi paragraf dalam bahasa Indonesia") == "SIMPLE"

    def test_s27_rumus_volume_kubus(self):
        assert tier("Rumus volume kubus?") == "SIMPLE"

    def test_s28_pengertian_grammar(self):
        assert tier("Pengertian grammar dalam bahasa Inggris") == "SIMPLE"

    def test_s29_apa_itu_dna(self):
        assert tier("Apa itu DNA?") == "SIMPLE"

    def test_s30_handler_is_faq(self):
        assert handler("Apa itu limit?") == "faq"


# ─── MEDIUM cases (35 samples) ───────────────────────────────────────────────

class TestMedium:
    def test_m01_jelaskan_limit(self):
        assert tier("Jelaskan cara menghitung limit fungsi") == "MEDIUM"

    def test_m02_cara_turunan(self):
        assert tier("Bagaimana cara mencari turunan fungsi polinomial?") == "MEDIUM"

    def test_m03_hitung_integral(self):
        assert tier("Hitung integral dari 2x + 3") == "MEDIUM"

    def test_m04_selesaikan_spldv(self):
        assert tier("Selesaikan sistem persamaan 2x + y = 7 dan x - y = 1") == "MEDIUM"

    def test_m05_langkah_fotosintesis(self):
        assert tier("Jelaskan langkah-langkah proses fotosintesis") == "MEDIUM"

    def test_m06_cara_menghitung_kecepatan(self):
        assert tier("Bagaimana cara menghitung kecepatan akhir benda jatuh bebas?") == "MEDIUM"

    def test_m07_contoh_soal_limit(self):
        assert tier("Berikan contoh soal limit fungsi trigonometri beserta penyelesaiannya") == "MEDIUM"

    def test_m08_proses_reaksi_kimia(self):
        assert tier("Jelaskan proses reaksi kimia antara asam dan basa") == "MEDIUM"

    def test_m09_gambarkan_grafik(self):
        assert tier("Bagaimana cara menggambarkan grafik fungsi kuadrat?") == "MEDIUM"

    def test_m10_langkah_turunan(self):
        assert tier("Apa langkah-langkah mencari turunan fungsi komposisi?") == "MEDIUM"

    def test_m11_selesaikan_soal_fisika(self):
        assert tier("Selesaikan soal ini: benda bermassa 5 kg dilempar ke atas dengan kecepatan 10 m/s") == "MEDIUM"

    def test_m12_cara_hitung_ph(self):
        assert tier("Bagaimana cara menghitung pH larutan asam?") == "MEDIUM"

    def test_m13_tentukan_nilai_x(self):
        assert tier("Tentukan nilai x dari persamaan 3x + 5 = 14") == "MEDIUM"

    def test_m14_jelaskan_metode_eliminasi(self):
        assert tier("Jelaskan metode eliminasi dalam SPLDV") == "MEDIUM"

    def test_m15_carilah_integral(self):
        assert tier("Carilah integral dari sin(x) cos(x)") == "MEDIUM"

    def test_m16_hitung_energi(self):
        assert tier("Hitung energi kinetik benda bermassa 2 kg dengan kecepatan 5 m/s") == "MEDIUM"

    def test_m17_cara_analisis_teks(self):
        assert tier("Bagaimana cara menganalisis teks argumentasi?") == "MEDIUM"

    def test_m18_langkah_pembentukan_senyawa(self):
        assert tier("Jelaskan langkah-langkah pembentukan senyawa ionik") == "MEDIUM"

    def test_m19_selesaikan_matriks(self):
        assert tier("Selesaikan perkalian matriks 2x2 ini") == "MEDIUM"

    def test_m20_cara_belajar_grammar(self):
        assert tier("Bagaimana cara menggunakan present perfect tense?") == "MEDIUM"

    def test_m21_jelaskan_mitosis(self):
        assert tier("Jelaskan proses mitosis secara berurutan") == "MEDIUM"

    def test_m22_hitung_turunan_komposisi(self):
        assert tier("Hitung turunan dari f(x) = sin(x^2 + 1) menggunakan aturan rantai") == "MEDIUM"

    def test_m23_cara_menulis_esai(self):
        assert tier("Bagaimana cara menulis esai argumentatif yang baik?") == "MEDIUM"

    def test_m24_metode_substitusi(self):
        assert tier("Jelaskan metode substitusi untuk menyelesaikan SPLDV") == "MEDIUM"

    def test_m25_gunakan_hukum_newton(self):
        assert tier("Gunakan hukum Newton kedua untuk menghitung percepatan benda") == "MEDIUM"

    def test_m26_terapkan_dalil_phytagoras(self):
        assert tier("Terapkan dalil Pythagoras untuk mencari sisi miring segitiga") == "MEDIUM"

    def test_m27_contoh_soal_ekosistem(self):
        assert tier("Berikan contoh soal tentang rantai makanan dalam ekosistem") == "MEDIUM"

    def test_m28_cara_menentukan_mol(self):
        assert tier("Bagaimana cara menentukan jumlah mol dari 36 gram air?") == "MEDIUM"

    def test_m29_soal_vektor(self):
        assert tier("Ada soal vektor, bagaimana cara menjumlahkan dua vektor?") == "MEDIUM"

    def test_m30_kerjakan_soal(self):
        assert tier("Kerjakan soal ini: tentukan turunan pertama dari f(x) = 3x^3 - 2x^2 + x - 5") == "MEDIUM"

    def test_m31_hitung_limit_trigono(self):
        assert tier("Hitung limit dari sin(3x)/x saat x mendekati 0") == "MEDIUM"

    def test_m32_langkah_integral_parsial(self):
        assert tier("Jelaskan langkah-langkah integrasi parsial dengan contoh") == "MEDIUM"

    def test_m33_cara_menyetarakan(self):
        assert tier("Bagaimana cara menyetarakan reaksi kimia?") == "MEDIUM"

    def test_m34_handler_groq_standard(self):
        assert handler("Jelaskan cara menghitung limit") == "groq_standard"

    def test_m35_confidence_reasonable(self):
        c = confidence("Bagaimana cara mencari turunan fungsi?")
        assert 50 <= c <= 100


# ─── COMPLEX cases (25 samples) ──────────────────────────────────────────────

class TestComplex:
    def test_c01_kenapa_limit_lhopital(self):
        assert tier("Kenapa kita menggunakan aturan L'Hopital untuk menghitung limit?") == "COMPLEX"

    def test_c02_buktikan_turunan(self):
        assert tier("Buktikan bahwa turunan dari sin(x) adalah cos(x) menggunakan definisi limit") == "COMPLEX"

    def test_c03_mengapa_integral(self):
        assert tier("Mengapa integral bisa digunakan untuk menghitung luas daerah?") == "COMPLEX"

    def test_c04_pembuktian_phytagoras(self):
        assert tier("Jelaskan pembuktian teorema Pythagoras secara matematis") == "COMPLEX"

    def test_c05_analisis_ekosistem(self):
        assert tier("Analisis hubungan antara keanekaragaman hayati dan kestabilan ekosistem") == "COMPLEX"

    def test_c06_derivasi_rumus(self):
        assert tier("Bagaimana derivasi rumus energi kinetik dari hukum Newton?") == "COMPLEX"

    def test_c07_kenapa_sel_membelah(self):
        assert tier("Kenapa sel perlu membelah dan apa konsekuensi jika proses ini terganggu?") == "COMPLEX"

    def test_c08_buktikan_limit_sin(self):
        assert tier("Buktikan bahwa limit sin(x)/x = 1 saat x mendekati 0 menggunakan epsilon delta") == "COMPLEX"

    def test_c09_induksi_matematika(self):
        assert tier("Buktikan dengan induksi matematika bahwa 1+2+3+...+n = n(n+1)/2") == "COMPLEX"

    def test_c10_mengapa_asam_basa(self):
        assert tier("Mengapa larutan asam dapat bereaksi dengan logam menghasilkan gas hidrogen?") == "COMPLEX"

    def test_c11_analisa_ikatan_kimia(self):
        assert tier("Analisa perbedaan antara ikatan ionik dan ikatan kovalen berdasarkan sifat fisika") == "COMPLEX"

    def test_c12_turunkan_persamaan(self):
        assert tier("Turunkan persamaan gerak untuk benda di bidang miring dengan gesekan") == "COMPLEX"

    def test_c13_optimasi_fungsi(self):
        assert tier("Bagaimana cara optimasi fungsi dua variabel menggunakan metode Lagrange?") == "COMPLEX"

    def test_c14_teorema_pythagoras(self):
        assert tier("Jelaskan dan buktikan teorema Pythagoras untuk segitiga siku-siku") == "COMPLEX"

    def test_c15_kenapa_gelombang(self):
        assert tier("Kenapa gelombang cahaya bisa mengalami difraksi saat melewati celah sempit?") == "COMPLEX"

    def test_c16_evaluasi_dampak(self):
        assert tier("Evaluasi dampak aktivitas manusia terhadap perubahan iklim berdasarkan bukti ilmiah") == "COMPLEX"

    def test_c17_bandingkan_teori(self):
        assert tier("Bandingkan teori evolusi Darwin dengan pandangan modern dalam biologi evolusioner") == "COMPLEX"

    def test_c18_deduksi_persamaan(self):
        assert tier("Gunakan deduksi untuk menurunkan persamaan kuadrat dari konteks geometri") == "COMPLEX"

    def test_c19_pembuktian_aljabar(self):
        assert tier("Buktikan identitas aljabar (a+b)^2 = a^2 + 2ab + b^2 secara formal") == "COMPLEX"

    def test_c20_hubungan_antara_konsep(self):
        assert tier("Apa hubungan antara turunan dan kecepatan sesaat dalam kinematika?") == "COMPLEX"

    def test_c21_mengapa_reaksi_spontan(self):
        assert tier("Mengapa reaksi kimia tertentu bisa berlangsung spontan tanpa input energi?") == "COMPLEX"

    def test_c22_analisis_sastra(self):
        assert tier("Analisis struktur dan gaya bahasa dalam puisi Chairil Anwar") == "COMPLEX"

    def test_c23_kenapa_pendek(self):
        # Short but COMPLEX keyword
        assert tier("Kenapa L'Hopital?") == "COMPLEX"

    def test_c24_handler_groq_complex(self):
        assert handler("Buktikan turunan sin(x) = cos(x)") == "groq_complex"

    def test_c25_confidence_high(self):
        c = confidence("Buktikan dengan induksi matematika bahwa hasil ini benar")
        assert c >= 60


# ─── Follow-up inheritance (5 samples) ───────────────────────────────────────

class TestFollowUp:
    def test_f01_inherit_complex_from_history(self):
        history = [
            {"role": "user", "content": "Buktikan teorema Pythagoras"},
            {"role": "ai", "content": "Untuk membuktikan teorema Pythagoras, kita mulai dari definisi segitiga siku-siku... " + "x" * 900},
        ]
        result = classify("terus?", history)
        assert result["type"] == "COMPLEX"

    def test_f02_inherit_medium_from_history(self):
        history = [
            {"role": "user", "content": "Jelaskan cara hitung turunan"},
            {"role": "ai", "content": "Cara menghitung turunan: pertama, gunakan aturan pangkat... " + "x" * 350},
        ]
        result = classify("lanjut", history)
        assert result["type"] == "MEDIUM"

    def test_f03_reveal_always_medium(self):
        history = [{"role": "ai", "content": "x" * 100}]
        result = classify("reveal", history)
        assert result["type"] == "MEDIUM"
        assert result["suggested_handler"] == "groq_standard"

    def test_f04_no_history_followup_defaults_simple(self):
        # Short follow-up with no history → no inheritance → fall through to scoring
        result = classify("terus")
        # Without history, "terus" scores 0 on all → SIMPLE
        assert result["type"] == "SIMPLE"

    def test_f05_ok_single_word_followup(self):
        history = [
            {"role": "ai", "content": "x" * 500},
        ]
        result = classify("oke", history)
        assert result["type"] in ("SIMPLE", "MEDIUM", "COMPLEX")  # inherits, valid tier


# ─── Edge cases (5 samples) ──────────────────────────────────────────────────

class TestEdgeCases:
    def test_e01_empty_string(self):
        result = classify("")
        assert result["type"] == "SIMPLE"
        assert result["confidence"] >= 80

    def test_e02_whitespace_only(self):
        result = classify("   ")
        assert result["type"] == "SIMPLE"

    def test_e03_very_long_message(self):
        msg = "jelaskan " * 50 + "limit fungsi"
        result = classify(msg)
        assert result["type"] in ("SIMPLE", "MEDIUM", "COMPLEX")
        assert 0 < result["confidence"] <= 100

    def test_e04_unicode_emoji(self):
        result = classify("Apa itu limit? 🤔")
        assert result["type"] == "SIMPLE"

    def test_e05_result_has_required_keys(self):
        result = classify("Hitung integral dari x^2")
        assert "type" in result
        assert "confidence" in result
        assert "reason" in result
        assert "suggested_handler" in result
        assert result["type"] in ("SIMPLE", "MEDIUM", "COMPLEX")
        assert result["suggested_handler"] in ("faq", "groq_standard", "groq_complex")
        assert isinstance(result["reason"], str)
        assert len(result["reason"]) > 0
