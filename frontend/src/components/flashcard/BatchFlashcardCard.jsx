import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { springLift } from '@/lib/motion';

import MathMarkdown from '@/components/MathMarkdown';
import { Tooltip, SubjectBadge , Icon } from '@/components/ui';
import { formatDate, formatTimeOnly } from '@/utils';

export default function BatchFlashcardCard({ group, onStart, onReview, onHistory, onDeleteAll, subjectId }) {
  const { t } = useTranslation();
  const { subject, cards, title, materialNames } = group;
  const latestCard = cards.reduce((a, b) =>
    new Date(b.created_at || 0) > new Date(a.created_at || 0) ? b : a, cards[0]);
  const createdAt = latestCard?.created_at;

  const allMaterialNames = [...new Set(
    ([]).concat(
      materialNames || [],
      cards.flatMap(c => c.material_names || [])
    ).filter(Boolean)
  )];

  const masteredCount = cards.filter(c => c.mastered).length;
  const newCount = cards.filter(c => !c.times_seen).length;
  const dueCount = cards.filter(c => !c.mastered && (c.times_seen === 0 || (c.next_review && new Date(c.next_review) <= new Date()))).length;
  const progress = cards.length > 0 ? Math.round((masteredCount / cards.length) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={springLift}
      className="card-base card-hoverable flex flex-col justify-between gap-3"
    >
      {/* Header — badge inisial + nama + aksi */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <SubjectBadge name={subject.name} subjectId={subjectId} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-3xs font-semibold text-accent-teal uppercase tracking-wider">
              {title ? subject.name : t('flashcard.subjectLabel')}
            </p>
            <h3 className="font-semibold text-text text-base truncate">{title || subject.name}</h3>
          </div>
        </div>
        <Tooltip label={t('flashcard.deleteAllCardsTitle')}>
          <button
            onClick={onDeleteAll}
            aria-label={t('flashcard.deleteAllCardsTitle')}
            className="p-1 text-text-muted hover:text-danger transition-colors shrink-0"
          >
            <Icon name={ICONS.actions.delete} size={14} />
          </button>
        </Tooltip>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
        <span className="flex items-center gap-1">
          <Icon name={ICONS.nav.flashcard} size={12} />
          {t('flashcard.cardCount', { count: cards.length })}
        </span>
        <span className="flex items-center gap-1">
          <Icon name={ICONS.learning.book} size={12} />
          {t('flashcard.flipRecall')}
        </span>
        {masteredCount > 0 && (
          <span className="flex items-center gap-1 text-success">
            <Icon name={ICONS.learning.trophy} size={11} />
            {t('flashcard.masteredCount', { count: masteredCount })}
          </span>
        )}
        {newCount > 0 && (
          <span className="flex items-center gap-1 text-accent-blue">
            <Icon name={ICONS.learning.sparkles} size={11} />
            {t('flashcard.newCount', { count: newCount })}
          </span>
        )}
      </div>

      {dueCount > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="badge badge-warning text-3xs">
            {t('flashcard.dueCount', { count: dueCount })}
          </span>
        </div>
      )}

      {allMaterialNames.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {allMaterialNames.slice(0, 3).map((name, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 text-3xs px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[220px]">
              <Icon name={ICONS.files.document} size={8} className="shrink-0" />{name}
            </span>
          ))}
          {allMaterialNames.length > 3 && (
            <span className="text-3xs text-text-muted self-center">{t('flashcard.moreMaterials', { count: allMaterialNames.length - 3 })}</span>
          )}
        </div>
      )}

      {cards[0] && (
        <div className="bg-subtle rounded-lg p-3 border border-border text-xs text-text-secondary line-clamp-2">
          <MathMarkdown>{cards[0].question}</MathMarkdown>
        </div>
      )}

      {/* Footer — progress bar + timestamp */}
      <div className="space-y-2">
        <div className="h-1.5 rounded-full bg-wash overflow-hidden">
          <div className="h-full w-full rounded-full bg-primary origin-left transition-transform" style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <div className="flex items-center justify-between text-3xs text-text-muted">
          {createdAt ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Icon name={ICONS.learning.calendar} size={9} />{formatDate(createdAt)}</span>
              <span className="flex items-center gap-1"><Icon name={ICONS.learning.clock} size={9} />{formatTimeOnly(createdAt)}</span>
            </div>
          ) : <span />}
          <span className="font-semibold">{progress}%</span>
        </div>
      </div>

      <div className="flex gap-2 mt-auto">
        {dueCount > 0 && (
          <button
            onClick={onReview}
            className="flex-1 justify-center text-xs px-3 py-2 rounded-lg border border-accent-purple/40 text-accent-purple font-semibold hover:bg-accent-purple/10 transition-colors flex items-center gap-1.5"
          >
            <Icon name={ICONS.learning.brain} size={12} /> {t('flashcard.review')}
          </button>
        )}
        <button
          onClick={onStart}
          className={`${dueCount > 0 ? 'flex-[2]' : 'flex-1'} btn-primary justify-center text-xs px-3 py-2`}
        >
          <Icon name={ICONS.media.play} size={12} /> {t('flashcard.startLearning')}
        </button>
      </div>

      <button
        onClick={onHistory}
        className="w-full flex items-center justify-center gap-1 text-2xs text-text-muted hover:text-accent-teal transition-colors py-1"
      >
        <Icon name={ICONS.learning.clock} size={11} /> {t('flashcard.reviewHistory')}
      </button>
    </motion.div>
  );
}