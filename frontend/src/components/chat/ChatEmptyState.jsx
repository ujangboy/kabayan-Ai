import { useTranslation } from 'react-i18next';
import { Bot } from '@/icons';
import { cn } from '@/utils';

export default function ChatEmptyState({ tutorMode }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-10">
      <div
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-4',
          tutorMode ? 'bg-primary' : 'bg-accent'
        )}
      >
        <Bot size={28} />
      </div>
      <h3 className="text-lg font-semibold text-text">{t('chat.greetingTitle', 'Halo! Saya Kabayan AI')}</h3>
      <p className="text-sm text-text-muted mt-1 max-w-md">{t('chat.greetingSubtitle', 'Tanyakan apa saja seputar materi kuliahmu — saya siap membantu menjelaskan, meringkas, dan berlatih soal.')}</p>
      <p className="text-xs text-text-muted mt-4">{t('chat.greetingHint', 'Mulai dengan mengetik pertanyaan di bawah atau pilih aksi cepat lewat ikon kilat.')}</p>
    </div>
  );
}
