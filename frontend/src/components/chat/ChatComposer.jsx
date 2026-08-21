import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { motion, AnimatePresence } from 'framer-motion';

import { Tooltip, Spinner, Icon } from '@/components/ui';
import { cn } from '@/utils';
import { useToast } from '@/components/Toast';

const QUICK_PROMPTS = [
  { icon: ICONS.files.document, label: 'Ringkas materi', prompt: 'Tolong ringkas materi ini dengan poin-poin penting.' },
  { icon: ICONS.ui.help, label: 'Buat soal', prompt: 'Buatkan 3 soal latihan beserta pembahasannya.' },
  { icon: ICONS.actions.search, label: 'Jelaskan konsep', prompt: 'Jelaskan konsep ini seperti sedang mengajarkan pemula.' },
  { icon: ICONS.learning.brain, label: 'Quiz cepat', prompt: 'Berikan kuis cepat 5 pertanyaan untuk menguji pemahaman saya.' },
];

const MAX_TEXTAREA_HEIGHT = 144; // ~6 baris (6 * 24px) sebelum scrollbar internal aktif

export default function ChatComposer({ onSend, isStreaming, onStop, onSaveNote, isNoteSaving, tutorMode }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleSend = () => {
    const text = input;
    if (!text.trim()) return;
    onSend(text);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.overflowY = 'hidden';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    const h = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
    el.style.height = h + 'px';
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  };

  const handleAttach = () => {
    // Attachment belum terhubung ke backend — tampilkan info ringan, jangan crash
    if (fileInputRef.current) fileInputRef.current.click();
    else toast.info('Fitur lampiran segera hadir');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) toast.info(`Lampiran "${file.name}" segera hadir — backend belum mendukung upload di chat.`);
    e.target.value = '';
  };

  return (
    <div className="shrink-0 bg-transparent px-4 pb-4 pt-2">
      <div className="mx-auto w-full max-w-3xl relative">
        <AnimatePresence>
          {showQuickPrompts && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              className="absolute bottom-full mb-3 left-0 right-0 origin-bottom z-10"
            >
              <div className="rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-glass-lg p-2.5 grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => {
                      onSend(q.prompt);
                      setShowQuickPrompts(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-text hover:bg-white/[0.06] transition-colors text-left group"
                  >
                    <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary-light flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                      <Icon name={q.icon} size={15} />
                    </span>
                    <span className="truncate">{q.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating capsule — centered max-w-3xl, mx-auto wrapper di atas */}
        <div className="flex items-end gap-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/[0.08] shadow-glass px-2.5 py-2.5">
          {/* Left: attachment + quick prompts toggle */}
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip label={t('chat.attachFile', 'Lampiran')}>
              <button
                onClick={handleAttach}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-text-muted hover:text-text hover:bg-white/[0.08] transition-colors"
                aria-label={t('chat.attachFile', 'Lampiran')}
              >
                <Icon name={ICONS.communication.attach} size={18} />
              </button>
            </Tooltip>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
            <Tooltip label={t('chat.quickPrompts', 'Aksi cepat')}>
              <button
                onClick={() => setShowQuickPrompts((v) => !v)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                  showQuickPrompts
                    ? 'bg-primary/15 border-primary/20 text-primary-light'
                    : 'bg-white/[0.04] border-white/[0.06] text-text-muted hover:text-text hover:bg-white/[0.08]'
                )}
              >
                <Icon name={ICONS.learning.sparkles} size={16} />
              </button>
            </Tooltip>
          </div>

          {/* Center: auto-growing textarea (max 6 rows) */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={tutorMode ? t('chat.inputPlaceholderTutor', 'Tanya topik apapun ke tutor AI...') : t('chat.inputPlaceholderNormal', 'Ketik pesanmu...')}
              className="w-full resize-none bg-transparent px-2 py-2.5 text-sm leading-6 text-text placeholder:text-text-muted focus:outline-none max-h-[144px] overflow-y-hidden"
              style={{ minHeight: '44px' }}
            />
          </div>

          {/* Right: note save + send/stop */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Tooltip label={t('chat.saveNote')}>
              <button
                onClick={onSaveNote}
                disabled={isNoteSaving || isStreaming}
                className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-text-muted hover:text-text hover:bg-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isNoteSaving ? <Spinner size={16} className="animate-spin" /> : <Icon name={ICONS.files.notes} size={16} />}
              </button>
            </Tooltip>
            {isStreaming ? (
              <button
                onClick={onStop}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger text-white hover:bg-danger/90 transition-colors shadow-sm"
                aria-label="Stop"
              >
                <Icon name={ICONS.ui.square} size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary text-white shadow-btn-primary hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                aria-label="Send"
              >
                <Icon name={ICONS.actions.send} size={16} className="ml-px" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] leading-none text-text-muted/70">
          {t('chat.composerHint', 'Tekan Enter untuk mengirim, Shift+Enter untuk baris baru')}
        </p>
      </div>
    </div>
  );
}
