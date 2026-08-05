let activeController = null;

export function abortActiveStream() {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

export function hasActiveStream() {
  return activeController !== null;
}

export async function streamChat({ endpoint, body, onChunk }) {
  abortActiveStream();
  const controller = new AbortController();
  activeController = controller;

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
    if (activeController === controller) activeController = null;
  }
}
