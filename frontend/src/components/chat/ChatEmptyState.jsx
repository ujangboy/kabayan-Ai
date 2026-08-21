import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { cn } from '@/utils';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

const PROMPT_CARDS = [
  {
    icon: ICONS.files.document,
    title: 'Ringkas materi Jaringan Komputer',
    prompt: 'Tolong ringkas materi Jaringan Komputer dengan poin-poin penting dan contoh sederhana.',
    accent: 'from-violet-500/15 to-indigo-500/15 border-violet-500/20',
  },
  {
    icon: ICONS.ui.help,
    title: 'Buat 5 latihan soal kuis',
    prompt: 'Buatkan 5 latihan soal kuis pilihan ganda beserta kunci jawaban dan pembahasan singkat.',
    accent: 'from-blue-500/15 to-cyan-500/15 border-blue-500/20',
  },
  {
    icon: ICONS.learning.brain,
    title: 'Jelaskan konsep Graf & Pohon',
    prompt: 'Jelaskan konsep Graf dan Pohon seperti sedang mengajarkan pemula, lengkap dengan analogi dan contoh.',
    accent: 'from-emerald-500/15 to-teal-500/15 border-emerald-500/20',
  },
  {
    icon: ICONS.learning.lightbulb,
    title: 'Buat rencana belajar 7 hari',
    prompt: 'Bantu saya menyusun rencana belajar 7 hari yang efektif untuk persiapan ujian mendatang.',
    accent: 'from-amber-500/15 to-orange-500/15 border-amber-500/20',
  },
];

export default function ChatEmptyState({ tutorMode, onPromptSelect }) {
  const { t } = useTranslation();

  const greetingTitle = t('chat.greetingTitleNew', 'Halo! Ada materi kuliah yang ingin dibahas hari ini?');
  const greetingSubtitle = t(
    'chat.greetingSubtitleNew',
    'Tanyakan apa saja — ringkasan materi, latihan soal, atau penjelasan konsep. Kabayan AI siap membantu.'
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 md:py-12">
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center">
        {/* Hero icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-6 shadow-glow-sm relative overflow-hidden',
            tutorMode ? 'bg-gradient-primary' : 'bg-gradient-primary'
          )}
        >
          <span className="absolute inset-0 bg-gradient-primary opacity-60 blur-xl" />
          <Icon name={ICONS.communication.bot} size={28} className="relative" />
        </motion.div>

        {/* Elegant heading */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-2xl md:text-[30px] font-bold tracking-tight leading-tight text-text max-w-2xl"
        >
          {greetingTitle}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 text-sm md:text-[15px] leading-relaxed text-text-secondary max-w-xl"
        >
          {greetingSubtitle}
        </motion.p>

        {/* Quick prompt cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left"
        >
          {PROMPT_CARDS.map((card, idx) => (
            <motion.button
              key={card.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 + idx * 0.06, duration: 0.3 }}
              onClick={() => onPromptSelect?.(card.prompt)}
              className={cn(
                'group relative flex items-start gap-3.5 rounded-2xl border bg-slate-900/60 backdrop-blur-md p-4 text-left transition-all duration-200',
                'hover:bg-slate-800/70 hover:border-violet-500/30 hover:shadow-glass hover:-translate-y-0.5',
                'border-white/[0.06]'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br text-primary-light',
                  card.accent
                )}
              >
                <Icon name={card.icon} size={16} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium leading-snug text-text group-hover:text-white transition-colors">
                  {card.title}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-text-muted line-clamp-2">
                  {card.prompt}
                </span>
              </span>
              <Icon
                name={ICONS.ui.chevronRight}
                size={14}
                className="shrink-0 text-text-muted group-hover:text-primary-light group-hover:translate-x-0.5 transition-all mt-1"
              />
            </motion.button>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
          className="mt-6 text-xs text-text-muted"
        >
          {t('chat.greetingHintNew', 'Klik salah satu kartu di atas atau ketik pertanyaanmu di bawah.')}
        </motion.p>
      </div>
    </div>
  );
}
