import time
import re
import threading
import logging
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from pydantic import BaseModel
from typing import Dict, Any, List, Optional as Opt, Type
import config
from database import SessionLocal
from services.cache_service import cache_service
from services.settings_service import settings_service

logger = logging.getLogger(__name__)

# ─── REQ-04: Token Context Guard ────────────────────────────────────────────
MAX_CONTEXT_CHARS = 6000 * 4   # ~6000 token estimasi (1 token ≈ 4 char)
MAX_HISTORY_TURNS = 20         # simpan 20 turn terakhir

# ─── Math Delimiter Normalization ────────────────────────────────────────────
def _normalize_math(text: str) -> str:
    """
    Convert LaTeX delimiter variants from Groq output into $...$ / $$...$$
    so the frontend remark-math parser can recognize them.

    Order: block before inline to avoid partial matches.
      \\[...\\]   → $$...$$
      \\(...\\)   → $...$
    """
    if not text:
        return text
    # Block: \[...\]  →  $$...$$
    text = re.sub(r'\\\[([\s\S]*?)\\\]', lambda m: f'$$\n{m.group(1)}\n$$', text)
    # Inline: \(...\)  →  $...$
    text = re.sub(r'\\\(([\s\S]*?)\\\)', lambda m: f'${m.group(1)}$', text)
    return text


def _wrap_data(tag: str, content: str) -> str:
    """Bungkus konten tak-tepercaya (input user / dokumen) dengan tag penanda (B2)."""
    return f"<{tag}>\n{content}\n</{tag}>"
def _truncate_context(text: str, max_chars: int = MAX_CONTEXT_CHARS) -> str:
    """Potong context agar tidak overflow context window Groq."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_break = max(truncated.rfind('. '), truncated.rfind('\n'))
    if last_break > max_chars * 0.8:
        truncated = truncated[:last_break + 1]
    return truncated + "\n\n[... konteks dipotong otomatis untuk efisiensi token ...]"

def _trim_history(history: List[Dict[str, str]], max_turns: int = MAX_HISTORY_TURNS) -> List[Dict[str, str]]:
    """Simpan hanya N turn terakhir untuk mencegah context window overflow."""
    return history[-max_turns:] if len(history) > max_turns else history

# ─── REQ-03: Retry dengan exponential backoff ────────────────────────────────
def _retry_with_backoff(fn, max_attempts: int = 3, base_delay: float = 2.0):
    """Retry function dengan exponential backoff untuk error jaringan/API."""
    last_exc = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except Exception as e:
            last_exc = e
            err_str = str(e).lower()
            retryable = any(x in err_str for x in [
                "502", "503", "504", "timeout", "connection", "rate limit", "overloaded"
            ])
            if not retryable or attempt == max_attempts - 1:
                raise
            time.sleep(base_delay * (2 ** attempt))  # 2s → 4s → 8s
    raise last_exc

# ─── REQ-06: Internal Rate Limiter (Loop Guard) ──────────────────────────────
class InternalRateLimiter:
    """Rate limiter per-key (per-capability = per-endpoint), bukan global (B10).

    Setiap capability punya bucket sendiri, sehingga lonjakan satu fitur
    tidak menghabiskan kuota fitur lain.
    """

    def __init__(self, max_requests: int = 100, window_seconds: int = 60, max_buckets: int = 64):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_buckets = max_buckets
        self._buckets: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check_limit(self, key: str = "default"):
        now = time.time()
        with self._lock:
            bucket = [t for t in self._buckets.get(key, []) if now - t < self.window_seconds]
            if len(bucket) >= self.max_requests:
                raise Exception(
                    "RATE_LIMIT_LOCAL: Internal Loop Guard aktif. "
                    f"Limit eksekusi AI untuk '{key}' maksimal {self.max_requests} per menit."
                )
            bucket.append(now)
            self._buckets[key] = bucket
            # Bersihkan bucket yang sudah tidak aktif agar memori tidak membengkak
            if len(self._buckets) > self.max_buckets:
                self._buckets = {
                    k: v for k, v in self._buckets.items()
                    if any(now - t < self.window_seconds for t in v)
                }


global_rate_limiter = InternalRateLimiter()

# ─── Capability Router ───────────────────────────────────────────────────────
class CapabilityRouter:
    CAPABILITIES = {
        "chat":          "openai/gpt-oss-20b",
        "vision":        "meta-llama/llama-4-scout-17b-16e-instruct",
        "reasoning":     "openai/gpt-oss-20b",
        "summary":       "openai/gpt-oss-20b",
        "quiz":          "openai/gpt-oss-20b",
        "flashcard":     "openai/gpt-oss-20b",
        "prediction":    "openai/gpt-oss-20b",
        # Exam Analyzer capabilities
        "exam_analysis": "openai/gpt-oss-20b",
        "exam_blueprint":"openai/gpt-oss-20b",
        "exam_question": "openai/gpt-oss-20b",
        "exam_evaluate": "openai/gpt-oss-20b",
    }

    @staticmethod
    def get_model(capability: str) -> str:
        return CapabilityRouter.CAPABILITIES.get(capability, "openai/gpt-oss-20b")

# ─── AI Service ──────────────────────────────────────────────────────────────
class AIService:

    def _get_llm(self, capability: str, temperature: float = None, max_tokens: int = 4000) -> ChatGroq:
        global_rate_limiter.check_limit(capability)
        # Exam-related capabilities need longer timeout (multi-topic generation)
        exam_caps = {"exam_analysis", "exam_blueprint", "exam_question", "exam_evaluate", "reasoning", "quiz"}
        timeout = 90.0 if capability in exam_caps else 30.0
        return ChatGroq(
            api_key=config.GROQ_API_KEY,
            model_name=CapabilityRouter.get_model(capability),
            temperature=temperature if temperature is not None else config.TEMPERATURE,
            max_tokens=max_tokens,
            max_retries=2,
            timeout=timeout,
        )

    def generate(
        self,
        capability: str,
        prompt_template: PromptTemplate,
        input_variables: Dict[str, Any],
        use_cache: bool = True,
        output_schema: Opt[Type[BaseModel]] = None,
        temperature: float = None,
    ) -> str | dict | list:
        if "context" in input_variables:
            input_variables = {
                **input_variables,
                "context": _truncate_context(str(input_variables["context"])),
            }

        prompt_str = prompt_template.format(**input_variables)
        db = SessionLocal()
        try:
            setting_hash = settings_service.get_embedding_model(db)

            if use_cache:
                cached = cache_service.get_cache(db, prompt_str, "", setting_hash)
                if cached:
                    return cached

            llm = self._get_llm(capability, temperature=temperature)

            # If output_schema provided, try structured output first
            if output_schema:
                try:
                    structured_llm = llm.with_structured_output(output_schema)
                    result = _retry_with_backoff(lambda: structured_llm.invoke(input_variables))
                    if use_cache:
                        cache_service.set_cache(db, prompt_str, "", setting_hash, str(result))
                    if isinstance(result, BaseModel):
                        return result.model_dump()
                    return result
                except Exception as exc:
                    logger.warning("Structured output failed for %s, falling back to text: %s", capability, exc)

            chain = prompt_template | llm

            response = _retry_with_backoff(lambda: chain.invoke(input_variables))
            response_text = response.content

            # Detect truncation (finish_reason == "length" means output hit token limit)
            finish_reason = getattr(response, 'response_metadata', {}).get('finish_reason', '')
            if finish_reason == 'length':
                logger.warning("Response truncated for capability=%s (hit max_tokens)", capability)
                if response_text and not response_text.rstrip().endswith(('.', '!', '?', '```')):
                    response_text = response_text.rstrip() + "\n\n⚠️ *Catatan: Respons terpotong karena batas token.*"

            if use_cache:
                cache_service.set_cache(db, prompt_str, "", setting_hash, response_text)
            return _normalize_math(response_text)
        finally:
            db.close()

    def chat(self, history: List[Dict[str, str]], context: str, user_input: str) -> str:
        from prompts.chat import CHAT_SYSTEM_PROMPT_WITH_DOCS_TEMPLATE, CHAT_SYSTEM_PROMPT_NO_DOCS_TEMPLATE

        # REQ-04: truncate + trim
        context = _truncate_context(context)
        history = _trim_history(history)
        hist_str = "\n".join([f"{m['role']}: {m['content']}" for m in history])

        has_docs = bool(context.strip())
        prompt_template = CHAT_SYSTEM_PROMPT_WITH_DOCS_TEMPLATE if has_docs else CHAT_SYSTEM_PROMPT_NO_DOCS_TEMPLATE

        # B2: tandai konten tak-tepercaya sebagai DATA, bukan instruksi
        wrapped_context = _wrap_data("dokumen", context) if has_docs else ""
        wrapped_input = _wrap_data("pesan_pengguna", user_input)

        db = SessionLocal()
        try:
            setting_hash = settings_service.get_embedding_model(db)
            if has_docs:
                prompt_str = prompt_template.format(context=wrapped_context, history=hist_str, input=wrapped_input)
            else:
                prompt_str = prompt_template.format(history=hist_str, input=wrapped_input)

            cached = cache_service.get_cache(db, prompt_str, context, setting_hash)
            if cached:
                return cached

            llm = self._get_llm("chat")
            if has_docs:
                sys_msg = CHAT_SYSTEM_PROMPT_WITH_DOCS_TEMPLATE.format(context=wrapped_context, history="", input="")
            else:
                sys_msg = CHAT_SYSTEM_PROMPT_NO_DOCS_TEMPLATE.format(history="", input="")
            messages = [SystemMessage(content=sys_msg)]
            for msg in history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                else:
                    messages.append(AIMessage(content=msg["content"]))
            messages.append(HumanMessage(content=wrapped_input))

            # REQ-03: retry
            response = _retry_with_backoff(lambda: llm.invoke(messages))
            response_text = response.content

            cache_service.set_cache(db, prompt_str, context, setting_hash, response_text)
            return response_text
        finally:
            db.close()

    async def achat_stream(self, history: List[Dict[str, str]], context: str, user_input: str):
        from prompts.chat import CHAT_SYSTEM_PROMPT_WITH_DOCS_TEMPLATE, CHAT_SYSTEM_PROMPT_NO_DOCS_TEMPLATE
        import asyncio

        # REQ-04: truncate + trim
        context = _truncate_context(context)
        history = _trim_history(history)
        hist_str = "\n".join([f"{m['role']}: {m['content']}" for m in history])

        has_docs = bool(context.strip())
        prompt_template = CHAT_SYSTEM_PROMPT_WITH_DOCS_TEMPLATE if has_docs else CHAT_SYSTEM_PROMPT_NO_DOCS_TEMPLATE

        # B2: tandai konten tak-tepercaya sebagai DATA, bukan instruksi
        wrapped_context = _wrap_data("dokumen", context) if has_docs else ""
        wrapped_input = _wrap_data("pesan_pengguna", user_input)

        db = SessionLocal()
        try:
            setting_hash = settings_service.get_embedding_model(db)
            if has_docs:
                prompt_str = prompt_template.format(context=wrapped_context, history=hist_str, input=wrapped_input)
            else:
                prompt_str = prompt_template.format(history=hist_str, input=wrapped_input)

            cached = await asyncio.to_thread(
                cache_service.get_cache, db, prompt_str, context, setting_hash
            )
            if cached:
                yield cached
                return

            llm = self._get_llm("chat")
            if has_docs:
                sys_msg = CHAT_SYSTEM_PROMPT_WITH_DOCS_TEMPLATE.format(context=wrapped_context, history="", input="")
            else:
                sys_msg = CHAT_SYSTEM_PROMPT_NO_DOCS_TEMPLATE.format(history="", input="")
            messages = [SystemMessage(content=sys_msg)]
            for msg in history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                else:
                    messages.append(AIMessage(content=msg["content"]))
            messages.append(HumanMessage(content=wrapped_input))

            full_response = ""
            last_yield = time.time()
            try:
                async for chunk in llm.astream(messages):
                    if chunk.content:
                        full_response += chunk.content
                        yield chunk.content
                        last_yield = time.time()
                    elif time.time() - last_yield > 8:
                        yield ""
                        last_yield = time.time()
            except Exception as e:
                err_str = str(e).lower()
                # REQ-03: graceful stream error — beri tahu user, jangan crash
                if any(x in err_str for x in ["timeout", "connection", "502", "503", "504"]):
                    yield "\n\n⚠️ Koneksi ke Groq API terputus. Coba kirim pesan lagi."
                elif "rate limit" in err_str or "429" in err_str:
                    yield "\n\n⚠️ Limit API Groq tercapai. Tunggu sebentar lalu coba lagi."
                else:
                    yield f"\n\n⚠️ Error: {str(e)}"
                return

            # Normalize math delimiters on the full response before caching
            # so repeated requests return already-normalized text
            normalized_response = _normalize_math(full_response)
            await asyncio.to_thread(
                cache_service.set_cache, db, prompt_str, context, setting_hash, normalized_response
            )
        finally:
            db.close()


ai_service = AIService()
