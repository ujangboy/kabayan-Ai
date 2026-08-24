import { useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useChatStore } from '@/store';
import { streamChat } from '@/services/tutorStream';

export function useChatUrlSync() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentChatId = useChatStore((s) => s.currentChatId);
  const tutorHandledRef = useRef(false);

  useEffect(() => {
    const tutorParam = searchParams.get('tutor');
    if (tutorParam) navigate('/chat', { replace: true });

    const state = useChatStore.getState();
    const { chats, currentChatId, createChat, setCurrentChat, setChatTutor, addMessage, setStreaming, updateLastMessage } = state;

    if (!currentChatId) {
      const firstChat = chats[0];
      if (firstChat) {
        setCurrentChat(firstChat.id);
      } else if (!tutorParam) {
        createChat();
      }
    }

    if (tutorParam && !tutorHandledRef.current) {
      tutorHandledRef.current = true;
      (async () => {
        const id = await createChat();
        if (!id) return;
        setChatTutor(id, { tutorEnabled: true, tutorSubject: tutorParam });
        setCurrentChat(id);
        const newMsg = {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: `Halo Tutor, saya butuh bantuan untuk materi ${tutorParam}.`,
          created_at: new Date().toISOString(),
        };
        const assistantPlaceholder = {
          id: `temp-${Date.now()}-a`,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
        };
        addMessage(id, newMsg);
        addMessage(id, assistantPlaceholder);
        setStreaming(true, id);
        try {
          const chat = useChatStore.getState().getCurrentChat();
          const history = (chat?.messages || []).map((m) => ({ role: m.role, content: m.content }));
          await streamChat({
            chatId: id,
            endpoint: '/api/tutor/chat',
            body: {
              message: newMsg.content,
              history,
              session_id: String(id),
              mata_kuliah: tutorParam,
              student_level: 'intermediate',
              rag_docs: [],
            },
            onChunk: (chunk, full) => {
              let clean = full;
              if (full.startsWith('\x00TYPE:')) {
                const end = full.indexOf('\x00', 1);
                if (end !== -1) clean = full.slice(end + 1);
              }
              updateLastMessage(id, clean);
            },
          });
        } catch (err) {
          console.error(err);
          updateLastMessage(id, 'Error: Terjadi kesalahan saat memproses pesan.');
        } finally {
          setStreaming(false, id);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChatId]);
}
