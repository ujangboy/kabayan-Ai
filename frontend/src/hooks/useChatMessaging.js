import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useChatStore } from '@/store';
import { useJobStore } from '@/store/jobStore';
import { notesAPI, tutorAPI } from '@/services/api';
import { streamChat, parseStreamContent } from '@/services/tutorStream';
import { usePendingOperation } from '@/hooks/usePendingOperation';
import { useToast } from '@/components/Toast';

export function useChatMessaging() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const notebookOp = usePendingOperation();
  const [noteToast, setNoteToast] = useState(null);
  const [isNoteSaving, setIsNoteSaving] = useState(false);
  const isNoteSavingRef = useRef(false);

  const sendMessage = async (text, attachment = null) => {
    const state = useChatStore.getState();
    const chat = state.getCurrentChat();
    const chatId = chat?.id;
    const trimmed = (text || '').trim();
    if ((!trimmed && !attachment) || !chatId) return;
    const isTutor = !!chat?.tutorEnabled;
    const { addMessage, updateLastMessage, patchLastMessage, setStreaming, selectedDocs } = state;

    const newMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed || t('chat.imagePlaceholder'),
      ...(attachment ? { attachment: { url: attachment.url, name: attachment.name } } : {}),
      created_at: new Date().toISOString(),
    };
    const assistantPlaceholder = {
      id: `temp-${Date.now()}-a`,
      role: 'assistant',
      content: attachment ? t('chat.readingImage') : '',
      created_at: new Date().toISOString(),
    };
    addMessage(chatId, newMsg);
    addMessage(chatId, assistantPlaceholder);

    // Job stream didaftarkan ke jobStore (bukan pendingOperations) agar banner
    // global menampilkan label jelas + tombol Batal yang benar-benar
    // menghentikan stream, walau user sudah pindah menu.
    const jobKey = `chat-stream-${chatId}`;
    const jobLabel = t('chat.streamJobLabel');
    useJobStore.getState().startJob(jobKey, { type: 'chat', label: jobLabel });
    let jobOutcome = 'success';
    let jobError = '';

    setStreaming(true, chatId);
    try {
      const history = (chat.messages || []).map((m) => ({ role: m.role, content: m.content }));
      if (attachment) {
        // Vision: lampiran gambar → 1 panggilan POST /api/chat/vision (bukan stream).
        const formData = new FormData();
        formData.append('session_id', String(chatId));
        formData.append('message', trimmed);
        formData.append('file', attachment.file, attachment.file?.name || attachment.name);

        const visionController = new AbortController();
        useJobStore.getState().setController(jobKey, visionController);
        const res = await fetch('/api/chat/vision', {
          method: 'POST',
          body: formData,
          signal: visionController.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            typeof data?.detail === 'string' ? data.detail : t('chat.visionFailed'),
          );
        }
        const data = await res.json();
        const markdown = data.transcription
          ? `**Teks yang saya baca:**\n> ${String(data.transcription).replace(/\n/g, '\n> ')}\n\n**Jawaban:**\n${data.answer}`
          : `**Jawaban:**\n${data.answer}`;
        updateLastMessage(chatId, markdown);
        if (data.msg_id) patchLastMessage(chatId, { msgId: data.msg_id });
      } else if (isTutor) {
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
            tutor_enabled: !!chat.tutorEnabled,
          },
          onChunk: (chunk, full) => {
            const { clean, msgId } = parseStreamContent(full);
            updateLastMessage(chatId, clean);
            if (msgId) patchLastMessage(chatId, { msgId });
          },
          onController: (controller) => useJobStore.getState().setController(jobKey, controller),
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
            tutor_enabled: !!chat.tutorEnabled,
          },
          onChunk: (chunk, full) => {
            const { clean, msgId } = parseStreamContent(full);
            updateLastMessage(chatId, clean);
            if (msgId) patchLastMessage(chatId, { msgId });
          },
          onController: (controller) => useJobStore.getState().setController(jobKey, controller),
        });
      }
    } catch (err) {
      console.error(err);
      jobOutcome = 'error';
      jobError = err?.message || t('chat.errorGeneric');
      updateLastMessage(chatId, 'Error: ' + (err?.message || t('chat.errorGeneric')));
    } finally {
      setStreaming(false, chatId);
      // Job dihapus duluan saat dibatalkan lewat banner — jangan tulis status lagi.
      const jobState = useJobStore.getState();
      if (jobState.jobs[jobKey]) {
        // Toast penyelesaian hanya muncul jika user telah pindah menu;
        // di dalam Chat jawaban memang langsung terlihat (tanpa toast dobel).
        jobState.finishJob(jobKey, {
          status: jobOutcome,
          notify: !window.location.pathname.startsWith('/chat'),
          ...(jobOutcome === 'error' && jobError ? { error: jobError } : {}),
        });
      }
      jobState.setController(jobKey, null);
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
    notebookOp.start(currentChatId);
    try {
      // Simpan jawaban assistant terakhir langsung ke Notebook (tanpa AI).
      // Catatan: endpoint /notes/generate menuntut subject_id+material —
      // payload {chat_id, type} lama tidak pernah didukung backend sehingga
      // fitur ini selalu gagal 422.
      const lastAssistant = [...chat.messages].reverse().find(m => m.role === 'assistant');
      const content = lastAssistant?.content || '';
      const title = (chat.title || 'Chat Export').slice(0, 60);
      const response = await notesAPI.create(title, content);
      const noteId = response?.data?.note_id;
      // Segarkan cache Notebook supaya klik "Lihat" menemukan catatan baru
      // (tanpa ini daftar Notebook masih memakai cache lama).
      queryClient.invalidateQueries({ queryKey: ['notes'] });
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
