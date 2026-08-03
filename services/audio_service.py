import os
import asyncio
import logging
import re
from abc import ABC, abstractmethod
import edge_tts
import config
from database import SessionLocal
from repositories.audio_repository import audio_repository
from repositories.material_repository import material_repository
from services.rag_service import rag_service
from services.ai_service import ai_service
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger(__name__)

class TTSEngine(ABC):
    @abstractmethod
    async def synthesize(self, text: str, output_path: str) -> bool:
        pass

class EdgeTTSEngine(TTSEngine):
    async def synthesize(self, text: str, output_path: str, attempts: int = 3) -> bool:
        # Retry dengan backoff singkat — kegagalan edge-tts sering transien (jaringan)
        for attempt in range(1, attempts + 1):
            try:
                # Use id-ID-ArdiNeural (Male) or id-ID-GadisNeural (Female)
                communicate = edge_tts.Communicate(text, "id-ID-ArdiNeural")
                await communicate.save(output_path)
                if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                    return True
                logger.warning(f"EdgeTTS attempt {attempt}/{attempts}: file output kosong (0 byte)")
            except Exception as e:
                logger.error(f"EdgeTTS attempt {attempt}/{attempts} gagal untuk teks {len(text)} chars: {e}")
            if attempt < attempts:
                await asyncio.sleep(attempt)  # 1s → 2s backoff
        return False

class PiperTTSEngine(TTSEngine):
    async def synthesize(self, text: str, output_path: str) -> bool:
        # Mock fallback implementation
        print("Fallback to PiperTTSEngine... (Not implemented)")
        return False

class AudioService:
    def __init__(self):
        self.engine = EdgeTTSEngine()
        self.fallback_engine = PiperTTSEngine()

    def clean_text_for_tts(self, text: str) -> str:
        # Hapus blok LaTeX $$...$$ / \[...\] dan inline $...$ / \(...\)
        text = re.sub(r'\$\$[\s\S]*?\$\$', ' ', text)
        text = re.sub(r'\\\[[\s\S]*?\\\]', ' ', text)
        text = re.sub(r'\$[^$\n]*\$', ' ', text)
        text = re.sub(r'\\\([\s\S]*?\\\)', ' ', text)
        # Hapus simbol markdown (*, _, #, `, >, |) dan bullet di awal baris
        text = re.sub(r'[*_#`>|]', '', text)
        text = re.sub(r'(?m)^\s*[-•]\s+', '', text)
        # Hapus URL
        text = re.sub(r'http\S+', '', text)
        # Rapikan spasi ganda & baris kosong
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def get_audio_status(self, db, material_id: int):
        return audio_repository.get_by_material_id(db, material_id)

    async def generate_audio_for_material_async(self, material_id: int):
        db = SessionLocal()
        audio_gen = None
        try:
            # Create or get audio generation record
            audio_gen = audio_repository.get_by_material_id(db, material_id)
            if not audio_gen:
                from models import AudioGeneration
                audio_gen = AudioGeneration(material_id=material_id, status="processing")
                db.add(audio_gen)
                db.commit()
                db.refresh(audio_gen)
            else:
                if audio_gen.status == "done":
                    return # Already exists
                audio_repository.update_status(db, audio_gen.id, status="processing", failure_reason=None)

            # Extract content using RAG or material service
            material = material_repository.get(db, material_id)
            if not material:
                audio_repository.update_status(db, audio_gen.id, status="failed", failure_reason="Material tidak ditemukan.")
                return

            doc_id = f"mat_{material.id}"

            # Strategi 1: cari di LanceDB index (sync — jalankan di thread agar event loop tidak macet)
            result = await asyncio.to_thread(rag_service.search, "Ringkas seluruh materi penting", [doc_id], 10)
            context = result.get("text", "")
            logger.info(f"[AudioGen] RAG search untuk material {material_id}: context {len(context)} chars, {len(context.split())} words")

            # Strategi 2 (fallback): RAG kosong → baca file langsung
            if not context:
                def _extract_from_file():
                    from parsers.document_parser import extract_text
                    if material.filepath and os.path.exists(material.filepath):
                        try:
                            text = extract_text(material.filepath)
                            if text:
                                return " ".join(text.split()[:2000])
                        except Exception as e:
                            print(f"Fallback extract failed: {e}")
                    return ""
                context = await asyncio.to_thread(_extract_from_file)

            if not context:
                context = "Tidak ada teks yang dapat diekstrak dari materi ini."

            prompt = PromptTemplate(
                input_variables=["context"],
                template="Buatkan narasi podcast singkat (maksimal 3 menit dibaca) yang informatif dan santai berdasarkan materi berikut. JANGAN gunakan tanda kurung, JANGAN gunakan asterisk/bintang (*), JANGAN gunakan markdown, cukup teks polos yang mengalir layaknya orang sedang berbicara:\n\n{context}"
            )

            script = await asyncio.to_thread(ai_service.generate, "summary", prompt, {"context": context}, False)
            clean_script = self.clean_text_for_tts(script)
            logger.info(f"[AudioGen] AI script selesai: {len(clean_script)} chars, {len(clean_script.split())} words. Akan dikirim ke TTS.")

            # Ensure static directory exists
            audio_dir = os.path.join(config.BASE_DIR, "static", "audio")
            os.makedirs(audio_dir, exist_ok=True)
            filename = f"podcast_mat_{material.id}_{audio_gen.id}.mp3"
            filepath = f"static/audio/{filename}"
            output_path = os.path.join(audio_dir, filename)

            success = await self.engine.synthesize(clean_script, output_path)
            engine_used = "edge-tts"

            if not success:
                success = await self.fallback_engine.synthesize(clean_script, output_path)
                engine_used = "piper"

            # Re-check material — bisa saja dihapus user selama AI/TTS berjalan
            material = material_repository.get(db, material_id)
            if not material:
                logger.warning(f"Material {material_id} sudah dihapus saat audio sedang diproses, membatalkan penyimpanan hasil")
                if os.path.exists(output_path):
                    try:
                        os.remove(output_path)
                        logger.info(f"File audio sampah dihapus: {output_path}")
                    except Exception as e:
                        logger.warning(f"Gagal hapus file audio sampah: {e}")
                return

            if success:
                logger.info(f"[AudioGen] Sukses: {filepath} (engine={engine_used})")
                audio_repository.update_status(db, audio_gen.id, status="done", filepath=f"/{filepath}", engine_used=engine_used, failure_reason=None)
            else:
                logger.error(f"[AudioGen] GAGAL: TTS engine gagal untuk material {material_id}")
                audio_repository.update_status(db, audio_gen.id, status="failed", failure_reason="Mesin TTS (edge-tts) gagal menghasilkan audio setelah beberapa percobaan. Periksa koneksi internet lalu coba lagi.")
        except Exception as e:
            logger.error(f"[AudioGen] Error tidak terduga untuk material {material_id}: {e}", exc_info=True)
            if audio_gen:
                audio_repository.update_status(db, audio_gen.id, status="failed", failure_reason=str(e)[:300])
        finally:
            db.close()

audio_service = AudioService()
