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

const MAX_TEXTAREA_HEIGHT = 144;

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
    if (fileInputRef.current) fileInputRef.current.click();
    else toast.info('Fitur lampiran segera hadir');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) toast.info(`Lampiran "${file.name}" segera hadir — backend belum mendukung upload di chat.`);
    e.target.value = '';
  };

  return (
    <div className="w-full relative">
      {/* Quick prompts panel */}
      <AnimatePresence>
        {showQuickPrompts && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full mb-3 left-0 right-0 origin-bottom z-10"
          >
            <div className="rounded-2xl border border-border bg-card shadow-glass-lg p-2 grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((q) => (
                <motion.button
                  key={q.label}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onSend(q.prompt);
                    setShowQuickPrompts(false);
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-text hover:bg-card-hover transition-all duration-150 text-left group border border-transparent hover:border-border/60"
                >
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary-light flex items-center justify-center shrink-0 border border-primary/15">
                    <Icon name={q.icon} size={14} />
                  </span>
                  <span className="truncate font-medium">{q.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main composer box */}
      <div className={cn(
        'flex items-end gap-2 rounded-2xl border shadow-glass px-2.5 py-2 transition-all duration-200',
        'bg-card border-border',
        'focus-within:border-primary/40 focus-within:shadow-glow-sm'
      )}>
        {/* Paperclip attachment */}
        <Tooltip label={t('chat.attachFile', 'Lampiran')}>
          <button
            onClick={handleAttach}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-card-hover text-text-secondary hover:text-text transition-all duration-150 shrink-0"
            aria-label={t('chat.attachFile', 'Lampiran')}
          >
            <Icon name={ICONS.communication.attach} size={16} />
          </button>
        </Tooltip>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

        {/* Auto-growing textarea */}
        <div className="flex-1 min-w-0 flex items-end gap-1.5">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={tutorMode
              ? t('chat.inputPlaceholderTutor', 'Tanya topik apapun ke tutor AI...')
              : t('chat.inputPlaceholderNormal', 'Ketik pesanmu...')}
            className="w-full resize-none bg-transparent px-2 py-2 text-base leading-6 text-text placeholder:text-text-muted focus:outline-none max-h-[144px] overflow-y-hidden"
            style={{ minHeight: '40px' }}
          />

          {/* Sparkles toggle */}
          <Tooltip label={tutorMode ? t('chat.tutorModeActive', 'Tutor Aktif') : t('chat.enableTutorMode', 'AI Tutor')}>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowQuickPrompts((v) => !v)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border shrink-0 transition-all duration-200 mb-1',
                showQuickPrompts || tutorMode
                  ? 'bg-primary border-primary text-white shadow-glow-sm'
                  : 'bg-card-hover border-border text-text-secondary hover:text-primary-light hover:border-primary/40'
              )}
            >
              <Icon name={ICONS.learning.sparkles} size={14} />
            </motion.button>
          </Tooltip>
        </div>

        {/* Send / Stop button */}
        <AnimatePresence mode="wait">
          {isStreaming ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onStop}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-danger text-white hover:bg-danger/80 transition-all duration-150 shrink-0 mb-1"
              aria-label="Stop"
            >
              <Icon name={ICONS.ui.square} size={14} />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={handleSend}
              disabled={!input.trim()}
              whileTap={{ scale: 0.9 }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-150 shrink-0 mb-1 shadow-btn-primary"
              aria-label="Send"
            >
              <Icon name={ICONS.actions.send} size={14} className="ml-px" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}