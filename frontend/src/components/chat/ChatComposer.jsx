import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Square, Notes, FileText, HelpCircle, Search, Brain, Sparkles } from '@/icons';
import { Tooltip, Spinner } from '@/components/ui';
import { cn } from '@/utils';

const QUICK_PROMPTS = [
  { icon: FileText, label: 'Ringkas materi', prompt: 'Tolong ringkas materi ini dengan poin-poin penting.' },
  { icon: HelpCircle, label: 'Buat soal', prompt: 'Buatkan 3 soal latihan beserta pembahasannya.' },
  { icon: Search, label: 'Jelaskan konsep', prompt: 'Jelaskan konsep ini seperti sedang mengajarkan pemula.' },
  { icon: Brain, label: 'Quiz cepat', prompt: 'Berikan kuis cepat 5 pertanyaan untuk menguji pemahaman saya.' },
];

export default function ChatComposer({ onSend, isStreaming, onStop, onSaveNote, isNoteSaving, tutorMode }) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const textareaRef = useRef(null);

  const handleSend = () => {
    const text = input;
    if (!text.trim()) return;
    onSend(text);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  return (
    <div className="shrink-0 border-t border-border px-4 py-3 bg-surface relative">
      {showQuickPrompts && (
        <div className="absolute bottom-full mb-2 left-4 right-4">
          <div className="rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-lg p-2 grid grid-cols-2 gap-2">
            {QUICK_PROMPTS.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.label}
                  onClick={() => {
                    onSend(q.prompt);
                    setShowQuickPrompts(false);
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text hover:bg-white/[0.06] transition-colors text-left"
                >
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary-light flex items-center justify-center shrink-0">
                    <Icon size={15} />
                  </span>
                  <span>{q.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={autoResize}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={tutorMode ? t('chat.inputPlaceholderTutor', 'Tanya topik apapun ke tutor AI...') : t('chat.inputPlaceholderNormal', 'Ketik pesanmu...')}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 max-h-[200px]"
          />
          <button
            onClick={() => setShowQuickPrompts((v) => !v)}
            className={cn(
              'absolute right-2 bottom-2.5 p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-white/[0.06] transition-colors',
              showQuickPrompts && 'text-primary bg-white/[0.06]'
            )}
            title={t('chat.quickPrompts', 'Aksi cepat')}
          >
            <Sparkles size={17} />
          </button>
        </div>
        <Tooltip label={t('chat.saveNote')}>
          <button
            onClick={onSaveNote}
            disabled={isNoteSaving || isStreaming}
            className="p-3 rounded-xl bg-white/[0.03] text-text-muted hover:text-text border border-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isNoteSaving ? <Spinner size={18} className="animate-spin" /> : <Notes size={18} />}
          </button>
        </Tooltip>
        {isStreaming ? (
          <button onClick={onStop} className="p-3 rounded-xl bg-danger text-white transition-colors">
            <Square size={18} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-3 rounded-xl bg-primary text-primary-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
