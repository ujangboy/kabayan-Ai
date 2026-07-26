import re
import urllib.request
import json
from typing import List, Tuple
from youtube_transcript_api import YouTubeTranscriptApi
from sources.base_source import BaseSource, Document
import config

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
        except Exception:
            return {
                "title": f"YouTube Video {self.video_id}",
                "channel_name": "Unknown",
                "thumbnail_url": f"https://i.ytimg.com/vi/{self.video_id}/hqdefault.jpg"
            }

    def _get_transcript_with_duration(self) -> Tuple[list, int, str]:
        # Priority: manual (id) → manual (en) → auto-generated (any lang) → Whisper
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

            fetched_transcript = transcript.fetch()

            duration = 0
            if fetched_transcript:
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
            print(f"[YouTube] Transcript API gagal: {e}. Beralih ke Whisper...")
            return self._transcribe_audio_with_groq()

    def _transcribe_audio_with_groq(self) -> Tuple[list, int, str]:
        import yt_dlp
        import os
        import tempfile
        from groq import Groq

        # Gunakan temp dir agar tidak ada isu permission di working directory
        tmp_dir = tempfile.gettempdir()
        output_template = os.path.join(tmp_dir, f"kabayan_yt_{self.video_id}.%(ext)s")

        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
            'outtmpl': output_template,
            'quiet': True,
            'no_warnings': True,
        }
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
            raise ValueError(f"Whisper fallback gagal: {str(e)}")
        finally:
            if filename and os.path.exists(filename):
                try:
                    os.remove(filename)
                except Exception:
                    pass

    def extract(self) -> List[Document]:
        transcript, _, lang = self._get_transcript_with_duration()

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
