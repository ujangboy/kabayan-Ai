import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { cn } from '@/utils';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { KabayanMark } from '@/components/brand/KabayanLogo';

const PROMPT_CARDS = [
  {
    icon: ICONS.learning.bookOpen,
    titleKey: 'chat.promptSummaryTitle',
    promptKey: 'chat.promptSummaryPrompt',
  },
  {
    icon: ICONS.ui.help,
    titleKey: 'chat.promptQuizTitle',
    promptKey: 'chat.promptQuizPrompt',
  },
  {
    icon: ICONS.learning.lightbulb,
    titleKey: 'chat.promptGraphTitle',
    promptKey: 'chat.promptGraphPrompt',
  },
  {
    icon: ICONS.learning.calendar,
    titleKey: 'chat.promptPlanTitle',
    promptKey: 'chat.promptPlanPrompt',
  },
];

export default function ChatEmptyState({ onPromptSelect }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-10">
      <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center">

        {/* Logo hero — flat, tanpa glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5"
        >
          <KabayanMark size={56} />
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl font-semibold tracking-tight leading-snug text-text max-w-sm"
        >
          {t('chat.emptyTitle')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13, duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="mt-1.5 text-sm leading-relaxed text-text-secondary max-w-sm"
        >
          {t('chat.emptySubtitle')}
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
              key={card.titleKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 + idx * 0.06, duration: 0.3 }}
              whileHover={{ scale: 1.015, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPromptSelect?.(t(card.promptKey))}
              className={cn(
                'group flex items-center gap-2.5 rounded-xl border p-3.5 text-left',
                'bg-card border-border',
                'hover:bg-card-hover hover:border-strong',
                'transition-all duration-200 ease-out'
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-light border border-primary/15 transition-colors group-hover:bg-primary/15">
                <Icon name={card.icon} size={15} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium leading-tight text-text group-hover:text-text line-clamp-2">
                  {t(card.titleKey)}
                </span>
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}