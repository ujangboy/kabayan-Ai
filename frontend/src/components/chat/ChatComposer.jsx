import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { motion, AnimatePresence } from 'framer-motion';

import { Tooltip, Icon } from '@/components/ui';
import { cn } from '@/utils';
import { useToast } from '@/components/Toast';

const QUICK_PROMPTS = [
  { icon: ICONS.learning.bookOpen, label: 'Ringkas materi', prompt: 'Tolong ringkas materi ini dengan poin-poin penting.' },
  { icon: ICONS.ui.help, label: 'Buat soal', prompt: 'Buatkan 3 soal latihan beserta pembahasannya.' },
  { icon: ICONS.learning.network, label: 'Jelaskan konsep', prompt: 'Jelaskan konsep ini seperti sedang mengajarkan pemula.' },
  { icon: ICONS.learning.brain, label: 'Quiz cepat', prompt: 'Berikan kuis cepat 5 pertanyaan untuk menguji pemahaman saya.' },
];

const MAX_TEXTAREA_HEIGHT = 144; // ~6 baris sebelum scrollbar internal aktif

export default function ChatComposer({ onSend, isStreaming, onStop, tutorMode }) {
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
              <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-xl p-2 grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => {
                      onSend(q.prompt);
                      setShowQuickPrompts(false);
                    }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition-colors text-left group"
                  >
                    <span className="w-6 h-6 rounded-lg bg-violet-600/15 text-violet-300 flex items-center justify-center shrink-0">
                      <Icon name={q.icon} size={13} />
                    </span>
                    <span className="truncate">{q.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating capsule — paperclip kiri, sparkles/bot opsional, send bulat kanan */}
        <div className="flex items-end gap-2 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg px-2.5 py-2">
          {/* Left: Paperclip attachment */}
          <Tooltip label={t('chat.attachFile', 'Lampiran')}>
            <button
              onClick={handleAttach}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0"
              aria-label={t('chat.attachFile', 'Lampiran')}
            >
              <Icon name={ICONS.communication.attach} size={16} />
            </button>
          </Tooltip>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

          {/* Center: auto-growing textarea */}
          <div className="flex-1 min-w-0 flex items-end gap-1.5">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={tutorMode ? t('chat.inputPlaceholderTutor', 'Tanya topik apapun ke tutor AI...') : t('chat.inputPlaceholderNormal', 'Ketik pesanmu...')}
              className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-6 text-white placeholder:text-slate-500 focus:outline-none max-h-[144px] overflow-y-hidden"
              style={{ minHeight: '40px' }}
            />
            {/* Sparkles/Bot AI Tutor toggle inside bar */}
            <Tooltip label={tutorMode ? t('chat.tutorModeActive', 'Tutor Aktif') : t('chat.enableTutorMode', 'AI Tutor')}>
              <button
                onClick={() => setShowQuickPrompts((v) => !v)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border shrink-0 transition-colors mb-1',
                  showQuickPrompts || tutorMode
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
                )}
              >
                <Icon name={ICONS.learning.sparkles} size={14} />
              </button>
            </Tooltip>
          </div>

          {/* Right: Send circular */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shrink-0 mb-1"
              aria-label="Stop"
            >
              <Icon name={ICONS.ui.square} size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 mb-1"
              aria-label="Send"
            >
              <Icon name={ICONS.actions.send} size={14} className="ml-px" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
