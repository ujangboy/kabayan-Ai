// Stream controller per-chat sehingga beberapa sesi dapat streaming paralel.
const controllers = new Map();

// Lepas marker inline dari stream tutor: header "\x00TYPE:XXX\x00" di awal
// dan metadata "\x00MSGID:n\x00" di akhir. Marker tidak boleh tampil di UI.
export function parseStreamContent(full) {
  let clean = full;
  let type = null;
  let msgId = null;

  if (clean.startsWith('\x00TYPE:')) {
    const end = clean.indexOf('\x00', 1);
    if (end !== -1) {
      type = clean.slice(6, end);
      clean = clean.slice(end + 1);
    }
  }

  const match = clean.match(/\x00MSGID:(\d+)\x00/);
  if (match) {
    msgId = Number(match[1]);
    clean = clean.replace(/\x00MSGID:\d+\x00/g, '');
  }

  return { clean, type, msgId };
}

export function abortActiveStream(chatId) {
  const controller = controllers.get(chatId);
  if (controller) {
    controller.abort();
    controllers.delete(chatId);
  }
}

export function isChatStreaming(chatId) {
  return controllers.has(chatId);
}

export function hasActiveStream() {
  return controllers.size > 0;
}

export async function streamChat({ chatId, endpoint, body, onChunk, onController }) {
  // Hanya batalkan stream milik chat yang sama; stream sesi lain tidak diganggu.
  if (controllers.has(chatId)) controllers.get(chatId).abort();

  const controller = new AbortController();
  controllers.set(chatId, controller);
  // Caller (mis. pending job) bisa mendaftarkan controller ini agar
  // tombol "Batal" di banner global benar-benar menghentikan stream.
  if (onController) onController(controller);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `Server error (${res.status})`;
      try {
        const data = await res.json();
        if (typeof data?.detail === 'string') detail = data.detail;
        else if (typeof data?.message === 'string') detail = data.message;
      } catch {
        /* ignore parse errors, keep status fallback */
      }
      throw new Error(detail);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      if (onChunk) onChunk(chunk, full);
    }

    return { full };
  } finally {
    if (controllers.get(chatId) === controller) controllers.delete(chatId);
  }
}
