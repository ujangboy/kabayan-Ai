// Stream controller per-chat sehingga beberapa sesi dapat streaming paralel.
const controllers = new Map();

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

export async function streamChat({ chatId, endpoint, body, onChunk }) {
  // Hanya batalkan stream milik chat yang sama; stream sesi lain tidak diganggu.
  if (controllers.has(chatId)) controllers.get(chatId).abort();

  const controller = new AbortController();
  controllers.set(chatId, controller);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Server error (${res.status})`);

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
