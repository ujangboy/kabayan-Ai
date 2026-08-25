import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/store';
import { notesAPI, tutorAPI } from '@/services/api';
import { streamChat, parseStreamContent } from '@/services/tutorStream';
import { usePendingOperation } from '@/hooks/usePendingOperation';
import { useToast } from '@/components/Toast';

export function useChatMessaging() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const chatOp = usePendingOperation();
  const notebookOp = usePendingOperation();
  const [noteToast, setNoteToast] = useState(null);
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const isNoteSavingRef = useRef(false);

  const sendMessage = async (text) => {
    const state = useChatStore.getState();
    const chat = state.getCurrentChat();
    const chatId = chat?.id;
    const trimmed = text.trim();
    if (!trimmed || !chatId) return;
    const isTutor = !!chat?.tutorEnabled;
    const { addMessage, updateLastMessage, patchLastMessage, setStreaming, selectedDocs } = state;

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
    addMessage(chatId, newMsg);
    addMessage(chatId, assistantPlaceholder);
    chatOp.start(chatId);
    setStreaming(true, chatId);
    try {
      const history = (chat.messages || []).map((m) => ({ role: m.role, content: m.content }));
      if (isTutor) {
        await streamChat({
          chatId,
          endpoint: '/api/tutor/chat',
          body: {
            message: trimmed,
            history,
            session_id: String(chatId),
            mata_kuliah: chat.tutorSubject || null,
            student_level: chat.tutorLevel || 'intermediate',
            exam_session_id: chat.examSessionId || null,
            rag_docs: selectedDocs || [],
          },
          onChunk: (chunk, full) => {
            const { clean, msgId } = parseStreamContent(full);
            updateLastMessage(chatId, clean);
            if (msgId) patchLastMessage(chatId, { msgId });
          },
        });
      } else {
        await streamChat({
          chatId,
          endpoint: '/api/chat',
          body: {
            message: trimmed,
            history,
            documents: selectedDocs || [],
            session_id: String(chatId),
          },
          onChunk: (chunk, full) => {
            const { clean, msgId } = parseStreamContent(full);
            updateLastMessage(chatId, clean);
            if (msgId) patchLastMessage(chatId, { msgId });
          },
        });
      }
    } catch (err) {
      console.error(err);
      updateLastMessage(chatId, 'Error: ' + (err?.message || t('chat.errorGeneric')));
    } finally {
      setStreaming(false, chatId);
      chatOp.finish(chatId);
    }
  };

  const handleFeedback = async (rating) => {
    const state = useChatStore.getState();
    const chat = state.getCurrentChat();
    const currentChatId = chat?.id;
    if (!currentChatId) return;
    const msgs = chat.messages || [];
    const last = msgs[msgs.length - 1];
    const msgId = last?.msgId ?? null;
    if (!msgId) {
      console.warn('[feedback] skip: last assistant message has no msgId', last);
      toast.info(t('chat.feedbackUnavailable') || 'Feedback hanya tersedia untuk respons terbaru. Coba kirim pesan baru lalu beri penilaian.');
      return;
    }
    const ratingMap = { up: 'helpful', down: 'not_helpful' };
    const mappedRating = ratingMap[rating] ?? 'somewhat';
    try {
      await tutorAPI.feedback({ rating: mappedRating, message_id: msgId });
      state.setMessageFeedback(currentChatId, msgId, rating);
    } catch (err) {
      console.error('[feedback] failed', err?.response?.data || err);
      toast.error(t('chat.feedbackError'));
    }
  };

  const generateAndSaveNote = async () => {
    const state = useChatStore.getState();
    const chat = state.getCurrentChat();
    const currentChatId = chat?.id;
    if (!currentChatId) return;
    if (isNoteSavingRef.current) return;
    if (!chat?.messages || chat.messages.length === 0) {
      toast.info(t('chat.noteEmpty'));
      return;
    }
    if (chat.messages[chat.messages.length - 1].role !== 'assistant') {
      toast.info(t('chat.noteWaiting'));
      return;
    }
    isNoteSavingRef.current = true;
    setIsNoteSaving(true);
    const noteType = chat.tutorEnabled ? 'tutor' : 'chat';
    notebookOp.start(currentChatId);
    try {
      const response = await notesAPI.generate({ chat_id: currentChatId, type: noteType });
      const noteId = response?.note_id;
      state.setTutorBadge(true);
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
