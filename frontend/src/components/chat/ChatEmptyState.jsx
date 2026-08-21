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
        {/* Card Hero ringkas — w-12 h-12 gradient */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center text-white mb-4 shadow-md relative overflow-hidden',
            'bg-gradient-to-br from-violet-600 to-indigo-600'
          )}
        >
          <Icon name={ICONS.communication.bot} size={22} className="relative" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl font-semibold tracking-tight leading-snug text-white max-w-md"
        >
          Ada materi yang ingin kita pelajari hari ini?
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1.5 text-sm leading-relaxed text-slate-400 max-w-md"
        >
          Pilih topik cepat di bawah atau tanyakan apa pun.
        </motion.p>

        {/* Quick prompt cards — compact p-3.5, text-xs/sm, 2 kolom */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 w-full grid grid-cols-2 gap-2.5 text-left"
        >
          {PROMPT_CARDS.map((card, idx) => (
            <motion.button
              key={card.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + idx * 0.05, duration: 0.28 }}
              onClick={() => onPromptSelect?.(card.prompt)}
              className={cn(
                'group flex items-center gap-2.5 rounded-xl border bg-slate-900 border-slate-800 p-3.5 text-left',
                'hover:bg-slate-800 hover:border-violet-600/30 hover:shadow-md transition-all duration-200'
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-300 border border-violet-600/20">
                <Icon name={card.icon} size={14} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium leading-tight text-slate-200 group-hover:text-white line-clamp-2">
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
