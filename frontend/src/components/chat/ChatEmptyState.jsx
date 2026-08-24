import { motion } from 'framer-motion';
import { cn } from '@/utils';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

const PROMPT_CARDS = [
  {
    icon: ICONS.learning.bookOpen,
    title: 'Ringkas materi Jaringan Komputer',
    prompt: 'Tolong ringkas materi Jaringan Komputer dengan poin-poin penting dan contoh sederhana.',
  },
  {
    icon: ICONS.ui.help,
    title: 'Buat 5 latihan soal kuis',
    prompt: 'Buatkan 5 latihan soal kuis pilihan ganda beserta kunci jawaban dan pembahasan singkat.',
  },
  {
    icon: ICONS.learning.network,
    title: 'Jelaskan konsep Graf & Pohon',
    prompt: 'Jelaskan konsep Graf dan Pohon seperti sedang mengajarkan pemula, lengkap dengan analogi dan contoh.',
  },
  {
    icon: ICONS.learning.calendar,
    title: 'Buat rencana belajar 7 hari',
    prompt: 'Bantu saya menyusun rencana belajar 7 hari yang efektif untuk persiapan ujian mendatang.',
  },
];

export default function ChatEmptyState({ onPromptSelect }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-10">
      <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center">

        {/* Logo hero */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-5"
        >
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-2xl bg-primary opacity-20 blur-xl scale-110" />
          <div className={cn(
            'relative w-14 h-14 rounded-2xl flex items-center justify-center text-white',
            'bg-primary shadow-glow-primary'
          )}>
            <Icon name={ICONS.communication.bot} size={26} className="relative" />
          </div>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl font-semibold tracking-tight leading-snug text-text max-w-sm"
        >
          Ada materi yang ingin kita pelajari hari ini?
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1.5 text-sm leading-relaxed text-text-secondary max-w-sm"
        >
          Pilih topik cepat di bawah atau tanyakan apa pun kepada Kabayan AI.
        </motion.p>

        {/* Quick prompt cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 w-full grid grid-cols-2 gap-2.5 text-left"
        >
          {PROMPT_CARDS.map((card, idx) => (
            <motion.button
              key={card.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + idx * 0.06, duration: 0.3 }}
              whileHover={{ scale: 1.015, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPromptSelect?.(card.prompt)}
              className={cn(
                'group flex items-center gap-2.5 rounded-xl border p-3.5 text-left',
                'bg-card border-border',
                'hover:bg-card-hover hover:border-border/80 hover:shadow-card',
                'transition-all duration-200 ease-out'
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-light border border-primary/15 transition-colors group-hover:bg-primary/15">
                <Icon name={card.icon} size={15} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium leading-tight text-text group-hover:text-text line-clamp-2">
                  {card.title}
                </span>
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}