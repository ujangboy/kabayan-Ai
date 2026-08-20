import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CreditCard, Book, Trash2, Trophy, Sparkles, FileText, Calendar, Clock, Brain, Play } from '@/icons';
import MathMarkdown from '@/components/MathMarkdown';
import { Tooltip } from '@/components/ui';
import { formatDate, formatTimeOnly } from '@/utils';

export default function BatchFlashcardCard({ group, onStart, onReview, onHistory, onDeleteAll }) {
  const { t } = useTranslation();
  const { subject, cards } = group;
  const latestCard = cards.reduce((a, b) =>
    new Date(b.created_at || 0) > new Date(a.created_at || 0) ? b : a, cards[0]);
  const createdAt = latestCard?.created_at;

  const allMaterialNames = [...new Set(
    cards.flatMap(c => c.material_names || []).filter(Boolean)
  )];

  const masteredCount = cards.filter(c => c.mastered).length;
  const newCount = cards.filter(c => !c.times_seen).length;
  const dueCount = cards.filter(c => !c.mastered && (c.times_seen === 0 || (c.next_review && new Date(c.next_review) <= new Date()))).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-base card-hoverable p-5 flex flex-col relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-primary" />
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-accent-teal uppercase tracking-wider mb-1">
            {t('flashcard.subjectLabel')}
          </div>
          <h3 className="font-semibold text-text text-sm truncate">{subject.name}</h3>
        </div>
        <Tooltip label={t('flashcard.deleteAllCardsTitle')}>
          <button
            onClick={onDeleteAll}
            aria-label={t('flashcard.deleteAllCardsTitle')}
            className="p-1 text-text-muted hover:text-danger transition-colors shrink-0 ml-2"
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
      </div>

      <div className="flex items-center gap-3 mb-2 text-xs text-text-secondary flex-wrap">
        <span className="flex items-center gap-1">
          <CreditCard size={12} />
          {t('flashcard.cardCount', { count: cards.length })}
        </span>
        <span className="flex items-center gap-1">
          <Book size={12} />
          {t('flashcard.flipRecall')}
        </span>
        {masteredCount > 0 && (
          <span className="flex items-center gap-1 text-success">
            <Trophy size={11} />
            {t('flashcard.masteredCount', { count: masteredCount })}
          </span>
        )}
        {newCount > 0 && (
          <span className="flex items-center gap-1 text-accent-blue">
            <Sparkles size={11} />
            {t('flashcard.newCount', { count: newCount })}
          </span>
        )}
      </div>

      {dueCount > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="badge badge-warning text-[10px]">
            {t('flashcard.dueCount', { count: dueCount })}
          </span>
        </div>
      )}

      {allMaterialNames.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {allMaterialNames.slice(0, 3).map((name, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[220px]">
              <FileText size={8} className="shrink-0" />{name}
            </span>
          ))}
          {allMaterialNames.length > 3 && (
            <span className="text-[10px] text-text-muted self-center">{t('flashcard.moreMaterials', { count: allMaterialNames.length - 3 })}</span>
          )}
        </div>
      )}

      {createdAt && (
        <div className="flex items-center gap-3 mb-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <Calendar size={9} />
            {formatDate(createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {formatTimeOnly(createdAt)}
          </span>
        </div>
      )}

      {cards[0] && (
        <div className="bg-background rounded-lg p-3 mb-4 border border-border text-xs text-text-secondary line-clamp-2">
          <MathMarkdown>{cards[0].question}</MathMarkdown>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        {dueCount > 0 && (
          <button
            onClick={onReview}
            className="flex-1 justify-center text-xs px-3 py-2 rounded-lg border border-accent-purple/40 text-accent-purple font-semibold hover:bg-accent-purple/10 transition-colors flex items-center gap-1.5"
          >
            <Brain size={12} /> {t('flashcard.review')}
          </button>
        )}
        <button
          onClick={onStart}
          className={`${dueCount > 0 ? 'flex-[2]' : 'flex-1'} btn-primary justify-center text-xs px-3 py-2`}
        >
          <Play size={12} /> {t('flashcard.startLearning')}
        </button>
      </div>

      <button
        onClick={onHistory}
        className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-text-muted hover:text-accent-teal transition-colors py-1"
      >
        <Clock size={11} /> {t('flashcard.reviewHistory')}
      </button>
    </motion.div>
  );
}
