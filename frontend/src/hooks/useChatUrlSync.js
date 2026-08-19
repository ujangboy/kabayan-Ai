import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '@/store';
import { streamChat } from '@/services/tutorStream';

export function useChatUrlSync() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    chats,
    currentChatId,
    createChat,
    setCurrentChat,
    setChatTutor,
    addMessage,
    setStreaming,
    updateLastMessage,
  } = useChatStore();

  useEffect(() => {
    const tutorParam = searchParams.get('tutor');
    if (tutorParam) navigate('/chat', { replace: true });

    if (!currentChatId) {
      const firstChat = chats[0];
      if (firstChat) {
        setCurrentChat(firstChat.id);
      } else if (!tutorParam) {
        createChat();
      }
    }

    if (tutorParam) {
      (async () => {
        const newId = await createChat();
        const id = newId ?? currentChatId;
        if (!id) return;
        setChatTutor(id, true, tutorParam);
        setCurrentChat(id);
        const newMsg = {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: `Halo Tutor, saya butuh bantuan untuk materi ${tutorParam}.`,
          created_at: new Date().toISOString(),
        };
        addMessage(newMsg);
        const assistantPlaceholder = {
          id: `temp-${Date.now()}-a`,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
        };
        addMessage(assistantPlaceholder);
        setStreaming(true, id);
        try {
          const res = await streamChat(id, newMsg.content, (partial) => {
            updateLastMessage((m) => (m.role === 'assistant' ? { ...m, content: partial } : m));
          });
          if (!res.ok) {
            let msg = 'Gagal memproses permintaan.';
            try {
              const body = await res.json();
              if (body?.detail) msg = body.detail;
            } catch {}
            updateLastMessage((m) => (m.role === 'assistant' ? { ...m, content: `⚠️ ${msg}` } : m));
            return;
          }
          let acc = '';
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            acc += decoder.decode(value, { stream: true });
            updateLastMessage((m) => (m.role === 'assistant' ? { ...m, content: acc } : m));
          }
        } catch (err) {
          console.error(err);
          updateLastMessage((m) => (m.role === 'assistant' ? { ...m, content: '⚠️ Terjadi kesalahan saat memproses pesan.' } : m));
        } finally {
          setStreaming(false, id);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
