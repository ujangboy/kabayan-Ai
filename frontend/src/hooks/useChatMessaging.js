import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/store';
import { notesAPI, tutorAPI } from '@/services/api';
import { streamChat } from '@/services/tutorStream';
import { usePendingOperation } from '@/hooks/usePendingOperation';
import { useToast } from '@/components/Toast';

export function useChatMessaging() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { chatOp, notebookOp } = usePendingOperation();
  const {
    addMessage,
    updateLastMessage,
    patchLastMessage,
    setMessageFeedback,
    setStreaming,
    getCurrentChat,
    setTutorBadge,
  } = useChatStore();

  const [noteToast, setNoteToast] = useState(null);
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const isNoteSavingRef = useRef(false);

  const sendMessage = async (text) => {
    const chat = getCurrentChat();
    const trimmed = text.trim();
    if (!trimmed) return;
    const isTutor = !!chat?.tutorEnabled;
    const newMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    const assistantPlaceholder = {
      id: `temp-${Date.now()}-a`,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };
    addMessage(newMsg);
    addMessage(assistantPlaceholder);
    const chatId = chat?.id;
    const tutorSubject = chat?.tutorSubject || '';
    const tutorLevel = chat?.tutorLevel || 'intermediate';
    chatOp.start(chatId);
    try {
      if (isTutor) {
        setStreaming(true, chatId);
        const note = await notesAPI.getOrCreateNote(chatId);
        const noteId = note?.id;
        let acc = '';
        let firstChunk = true;
        for await (const chunk of tutorAPI.streamTutorReply({
          chatId,
          message: trimmed,
          subject: tutorSubject,
          level: tutorLevel,
          noteId,
        })) {
          if (chunk.event === 'message') {
            acc += chunk.data;
            updateLastMessage((m) => (m.role === 'assistant' ? { ...m, content: acc } : m));
          } else if (chunk.event === 'note') {
            if (firstChunk) {
              firstChunk = false;
              patchLastMessage((m) => (m.role === 'assistant' ? { ...m, note_saved: true } : m));
            } else {
              patchLastMessage((m) => (m.role === 'assistant' ? { ...m, note_saved: true } : m));
            }
          } else if (chunk.event === 'error') {
            const errMsg = chunk.data?.message || chunk.data || 'Terjadi kesalahan pada tutor.';
            updateLastMessage((m) => (m.role === 'assistant' ? { ...m, content: `⚠️ ${errMsg}` } : m));
          }
        }
        setStreaming(false, chatId);
      } else {
        setStreaming(true, chatId);
        const res = await streamChat(chatId, trimmed, (partial) => {
          updateLastMessage((m) => (m.role === 'assistant' ? { ...m, content: partial } : m));
        });
        if (!res.ok) {
          let msg = 'Gagal memproses permintaan.';
          try {
            const body = await res.json();
            if (body?.detail) msg = body.detail;
          } catch {}
          updateLastMessage((m) => (m.role === 'assistant' ? { ...m, content: `⚠️ ${msg}` } : m));
          setStreaming(false, chatId);
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
        setStreaming(false, chatId);
      }
    } catch (err) {
      console.error(err);
      updateLastMessage((m) => (m.role === 'assistant' ? { ...m, content: '⚠️ Terjadi kesalahan saat memproses pesan.' } : m));
      setStreaming(false, chatId);
    } finally {
      chatOp.finish(chatId);
    }
  };

  const handleFeedback = async (rating) => {
    const chat = getCurrentChat();
    const currentChatId = chat?.id;
    if (!currentChatId) return;
    try {
      await tutorAPI.sendFeedback(currentChatId, rating);
      setMessageFeedback(rating);
    } catch {
      toast(t('chat.feedbackError'));
    }
  };

  const generateAndSaveNote = async () => {
    const chat = getCurrentChat();
    const currentChatId = chat?.id;
    if (!currentChatId) return;
    if (isNoteSavingRef.current) return;
    if (!chat?.messages || chat.messages.length === 0) {
      toast(t('chat.noteEmpty'));
      return;
    }
    if (chat.messages[chat.messages.length - 1].role !== 'assistant') {
      toast(t('chat.noteWaiting'));
      return;
    }
    isNoteSavingRef.current = true;
    setIsNoteSaving(true);
    const noteType = chat.tutorEnabled ? 'tutor' : 'chat';
    notebookOp.start(currentChatId);
    try {
      const response = await notesAPI.generateNote(currentChatId, noteType);
      const noteId = response?.note_id;
      setTutorBadge(true);
      setNoteToast({ message: t('chat.noteSaved'), note_id: noteId });
      setTimeout(() => setNoteToast(null), 3000);
    } catch (error) {
      console.error(error);
      const msg = error?.response?.data?.detail || t('chat.noteError');
      setNoteToast({ message: msg, note_id: null });
      setTimeout(() => setNoteToast(null), 3000);
    } finally {
      notebookOp.finish(currentChatId);
      setIsNoteSaving(false);
      isNoteSavingRef.current = false;
    }
  };

  return { sendMessage, handleFeedback, generateAndSaveNote, noteToast, isNoteSaving };
}
