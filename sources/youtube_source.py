import re
import os
import time
import json
import glob
import tempfile
import urllib.request
import logging
from typing import List, Tuple
from youtube_transcript_api import YouTubeTranscriptApi
from sources.base_source import BaseSource, Document
import config

logger = logging.getLogger(__name__)

class YoutubeSource(BaseSource):
    def __init__(self, url: str):
        self.url = url
        self.video_id = self._extract_video_id(url)
        if not self.video_id:
            raise ValueError("Invalid YouTube URL")

    def _extract_video_id(self, url: str) -> str:
        """Extract video ID dari berbagai format URL YouTube."""
        # Normalisasi URL
        url = url.strip()
        
        # Format: https://youtu.be/VIDEO_ID atau https://youtu.be/VIDEO_ID?...
        match = re.search(r"youtu\.be/([0-9A-Za-z_-]{11})", url)
        if match:
            return match.group(1)
        
        # Format: https://youtube.com/watch?v=VIDEO_ID atau https://www.youtube.com/watch?v=VIDEO_ID
        match = re.search(r"[?&]v=([0-9A-Za-z_-]{11})", url)
        if match:
            return match.group(1)
        
        # Format: https://youtube.com/shorts/VIDEO_ID atau https://www.youtube.com/shorts/VIDEO_ID
        match = re.search(r"/shorts/([0-9A-Za-z_-]{11})", url)
        if match:
            return match.group(1)
        
        # Format: https://youtube.com/live/VIDEO_ID atau https://www.youtube.com/live/VIDEO_ID
        match = re.search(r"/live/([0-9A-Za-z_-]{11})", url)
        if match:
            return match.group(1)
        
        # Format: https://youtube.com/embed/VIDEO_ID
        match = re.search(r"/embed/([0-9A-Za-z_-]{11})", url)
        if match:
            return match.group(1)
        
        # Fallback: coba ekstrak 11 karakter setelah slash (generic)
        match = re.search(r"/([0-9A-Za-z_-]{11})(?:[?&/]|$)", url)
        if match:
            return match.group(1)
        
        return None

    @staticmethod
    def _cookies_path() -> str:
        """Path cookies.txt (opsional) — dipakai yt-dlp untuk menembus blokir bot YouTube."""
        p = os.path.join(config.STORAGE_DIR, "cookies.txt")
        return p if os.path.exists(p) else None

    def get_metadata(self) -> dict:
        """
        Uses oEmbed to get basic metadata without YouTube Data API.
        Returns a dict with title, channel_name, thumbnail_url.
        """
        try:
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={self.video_id}&format=json"
            with urllib.request.urlopen(oembed_url, timeout=5) as response:
                data = json.loads(response.read().decode())
                return {
                    "title": data.get("title", ""),
                    "channel_name": data.get("author_name", ""),
                    "thumbnail_url": data.get("thumbnail_url", f"https://i.ytimg.com/vi/{self.video_id}/hqdefault.jpg")
                }
        except Exception as e:
            logger.warning(f"oEmbed gagal untuk video {self.video_id}: {e}. Menggunakan metadata default.")
            return {
                "title": f"YouTube Video {self.video_id}",
                "channel_name": "Unknown",
                "thumbnail_url": f"https://i.ytimg.com/vi/{self.video_id}/hqdefault.jpg"
            }

    # ─── Jalur 1: YouTube Transcript API (manual id → manual en → auto) ─────
    def _fetch_from_transcript_api(self) -> Tuple[list, str]:
        """Ambil transkrip via youtube-transcript-api, dengan 2x retry."""
        last_exc = None
        for attempt in range(2):
            try:
                api = YouTubeTranscriptApi()
                transcript_list = api.list(self.video_id)

                transcript = None
                lang = 'id'

                # 1. Manual Indonesian
                try:
                    transcript = transcript_list.find_transcript(['id'])
                    lang = 'id'
                except Exception:
                    pass

                # 2. Manual English
                if transcript is None:
                    try:
                        transcript = transcript_list.find_transcript(['en'])
                        lang = 'en'
                    except Exception:
                        pass

                # 3. Any auto-generated transcript (semua bahasa)
                if transcript is None:
                    try:
                        all_transcripts = list(transcript_list)
                        if all_transcripts:
                            transcript = all_transcripts[0]
                            lang = transcript.language_code
                    except Exception:
                        pass

                if transcript is None:
                    raise Exception("No transcript available via YouTube API")

                return transcript.fetch(), lang
            except Exception as e:
                last_exc = e
                logger.warning(f"[YouTube] Transcript API attempt {attempt + 1}/2 gagal untuk {self.video_id}: {e}")
                if attempt == 0:
                    time.sleep(1.5)
        raise ValueError(f"Transcript API gagal: {last_exc}")

    # ─── Jalur 2: yt-dlp subtitles (manual id/en + auto, dukung cookies) ────
    @staticmethod
    def _parse_vtt(vtt_path: str) -> List[dict]:
        """Parse file .vtt sederhana menjadi list {text, start, duration}."""
        entries = []
        try:
            with open(vtt_path, 'r', encoding='utf-8') as f:
                lines = f.read().splitlines()
        except Exception as e:
            logger.warning(f"Gagal membaca VTT {vtt_path}: {e}")
            return entries

        def ts_to_sec(t: str) -> float:
            t = t.strip().replace(',', '.')
            parts = t.split(':')
            secs = 0.0
            for p in parts:
                secs = secs * 60 + float(p)
            return secs

        i = 0
        while i < len(lines):
            line = lines[i].strip()
            m = re.match(r'^(\d{2}:\d{2}(?::\d{2})?[.,]\d{3})\s*-->\s*(\d{2}:\d{2}(?::\d{2})?[.,]\d{3})', line)
            if m:
                start = ts_to_sec(m.group(1))
                end = ts_to_sec(m.group(2))
                text_lines = []
                i += 1
                while i < len(lines) and lines[i].strip() and not re.match(r'^\d+$', lines[i].strip()):
                    t = lines[i].strip()
                    if t and '-->' not in t:
                        t = re.sub(r'<[^>]+>', '', t)  # buang tag kue waktu <00:00:00.000><c>...</c>
                        if t.strip():
                            text_lines.append(t.strip())
                    i += 1
                if text_lines:
                    entries.append({'text': ' '.join(text_lines), 'start': start, 'duration': end - start})
                continue
            i += 1
        return entries

    def _fetch_from_ytdlp_subtitles(self) -> Tuple[list, str]:
        """Unduh subtitle (manual + auto) via yt-dlp; lebih tahan blokir, dukung cookies.txt."""
        import yt_dlp
        base = os.path.join(tempfile.gettempdir(), f"kabayan_sub_{self.video_id}")
        ydl_opts = {
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['id', 'en'],
            'subtitlesformat': 'vtt',
            'outtmpl': base + '.%(ext)s',
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'socket_timeout': 30,
            'retries': 2,
        }
        cookies_path = self._cookies_path()
        if cookies_path:
            ydl_opts['cookiefile'] = cookies_path
            logger.info(f"[YouTube] Menggunakan cookies.txt: {cookies_path}")
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.extract_info(self.url, download=True)

            files = glob.glob(base + '.*.vtt')
            if not files:
                logger.warning(f"[YouTube] yt-dlp: tidak ada file subtitle terunduh untuk {self.video_id}")
                return None

            # Prioritas bahasa: id → en → lainnya
            def lang_rank(f):
                name = os.path.basename(f)
                if name.endswith('.id.vtt'):
                    return 0
                if name.endswith('.en.vtt'):
                    return 1
                return 2
            files.sort(key=lang_rank)
            vtt_path = files[0]
            entries = self._parse_vtt(vtt_path)
            lang = os.path.basename(vtt_path).split('.')[-2]
            if entries:
                logger.info(f"[YouTube] yt-dlp subtitles sukses: {os.path.basename(vtt_path)} ({len(entries)} segmen)")
                return entries, lang
        except Exception as e:
            logger.warning(f"[YouTube] yt-dlp subtitle download gagal untuk {self.video_id}: {e}")
        finally:
            for f in glob.glob(base + '.*'):
                try:
                    os.remove(f)
                except Exception:
                    pass
        return None

    # ─── Jalur 3: Whisper via Groq (fallback terakhir) ──────────────────────
    def _transcribe_audio_with_groq(self) -> Tuple[list, int, str]:
        import yt_dlp
        from groq import Groq

        # Gunakan temp dir agar tidak ada isu permission di working directory
        tmp_dir = tempfile.gettempdir()
        output_template = os.path.join(tmp_dir, f"kabayan_yt_{self.video_id}.%(ext)s")

        ydl_opts = {
            # bitrate rendah → file kecil, agar tidak melewati batas 25MB Groq
            'format': 'bestaudio[abr<=64]/bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
            'outtmpl': output_template,
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'socket_timeout': 30,
            'retries': 2,
        }
        cookies_path = self._cookies_path()
        if cookies_path:
            ydl_opts['cookiefile'] = cookies_path

        filename = None
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(self.url, download=True)
                filename = ydl.prepare_filename(info)

            if not os.path.exists(filename):
                # Coba cari file dengan nama dasar yang sama (ekstensi bisa beda)
                base = os.path.join(tmp_dir, f"kabayan_yt_{self.video_id}")
                for ext in ['m4a', 'mp3', 'webm', 'opus']:
                    candidate = f"{base}.{ext}"
                    if os.path.exists(candidate):
                        filename = candidate
                        break

            if not os.path.exists(filename):
                raise ValueError("Unduhan audio gagal: file tidak ditemukan (YouTube kemungkinan memblokir unduhan). Gunakan cookies.txt di folder storage/ untuk menembus blokir.")

            # Guard ukuran: Groq membatasi 25MB per file
            size_mb = os.path.getsize(filename) / (1024 * 1024)
            if size_mb > 24:
                raise ValueError(f"Audio terlalu besar untuk Whisper ({size_mb:.0f}MB > 24MB). Video terlalu panjang untuk jalur fallback.")

            client = Groq(api_key=config.GROQ_API_KEY)
            with open(filename, "rb") as f:
                transcription = client.audio.transcriptions.create(
                    file=(os.path.basename(filename), f.read()),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                )

            result = []

            if isinstance(transcription, dict):
                duration = int(transcription.get('duration', 0))
                lang = transcription.get('language', 'id')
                segments = transcription.get('segments', [])
                text_content = transcription.get('text', '')
            else:
                duration = int(getattr(transcription, 'duration', 0))
                lang = getattr(transcription, 'language', 'id')
                segments = getattr(transcription, 'segments', [])
                text_content = getattr(transcription, 'text', '')

            if not segments and text_content:
                result.append({'text': text_content, 'start': 0.0, 'duration': duration})
            else:
                for seg in segments:
                    if isinstance(seg, dict):
                        start = seg.get('start', 0.0)
                        end = seg.get('end', 0.0)
                        text = seg.get('text', '')
                    else:
                        start = getattr(seg, 'start', 0.0)
                        end = getattr(seg, 'end', 0.0)
                        text = getattr(seg, 'text', '')
                    result.append({'text': text, 'start': start, 'duration': end - start})

            return result, duration, lang

        except Exception as e:
            logger.error(f"Whisper/Groq fallback gagal untuk video {self.video_id}: {e}", exc_info=True)
            raise ValueError(f"Whisper fallback gagal: {str(e)}")
        finally:
            if filename and os.path.exists(filename):
                try:
                    os.remove(filename)
                except Exception:
                    pass

    def _get_transcript_with_duration(self, progress_cb=None):
        # Priority: transcript API → yt-dlp subtitles → Whisper
        if progress_cb:
            progress_cb("Mengambil transkrip via API YouTube...", 30)
        try:
            fetched_transcript, lang = self._fetch_from_transcript_api()
            duration = 0
            last_item = None
            for item in fetched_transcript:
                last_item = item
            if last_item:
                if hasattr(last_item, 'start'):
                    duration = int(last_item.start + getattr(last_item, 'duration', 0))
                else:
                    duration = int(last_item['start'] + last_item.get('duration', 0))
            return fetched_transcript, duration, lang
        except Exception as e:
            logger.warning(f"[YouTube] Transcript API gagal untuk {self.video_id}: {e}. Mencoba yt-dlp subtitles...")

        if progress_cb:
            progress_cb("Transkrip API gagal — mencoba subtitle yt-dlp...", 40)
        try:
            result = self._fetch_from_ytdlp_subtitles()
            if result:
                transcript, lang = result
                return transcript, 0, lang
        except Exception as e:
            logger.warning(f"[YouTube] yt-dlp subtitles gagal untuk {self.video_id}: {e}")

        logger.warning(f"[YouTube] Semua sumber subtitle gagal untuk {self.video_id}. Beralih ke Whisper...")
        if progress_cb:
            progress_cb("Mentranskripsikan audio dengan Whisper AI...", 60)
        return self._transcribe_audio_with_groq()

    def extract(self, progress_cb=None) -> List[Document]:
        transcript, _, lang = self._get_transcript_with_duration(progress_cb)

        chunks = []
        current_content = []
        current_word_count = 0
        start_time = None
        target_words = config.CHUNK_SIZE
        
        last_item = None

        for item in transcript:
            last_item = item
            if hasattr(item, 'text'):
                text = item.text.replace('\n', ' ')
                item_start = item.start
                item_duration = getattr(item, 'duration', 0)
            else:
                text = item['text'].replace('\n', ' ')
                item_start = item['start']
                item_duration = item.get('duration', 0)
                
            if start_time is None:
                start_time = int(item_start)
            
            current_content.append(text)
            current_word_count += len(text.split())

            if current_word_count >= target_words:
                end_time = int(item_start + item_duration)
                chunks.append(Document(
                    content=" ".join(current_content),
                    metadata={"video_id": self.video_id, "language": lang},
                    timestamp_start=start_time,
                    timestamp_end=end_time
                ))
                current_content = []
                current_word_count = 0
                start_time = None

        if current_content:
            if last_item:
                if hasattr(last_item, 'start'):
                    end_time = int(last_item.start + getattr(last_item, 'duration', 0))
                else:
                    end_time = int(last_item['start'] + last_item.get('duration', 0))
            else:
                end_time = 0
                
            chunks.append(Document(
                content=" ".join(current_content),
                metadata={"video_id": self.video_id, "language": lang},
                timestamp_start=start_time,
                timestamp_end=end_time
            ))

        return chunks
