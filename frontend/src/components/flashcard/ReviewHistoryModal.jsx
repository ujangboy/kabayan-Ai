import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ICONS } from '@/lib/icons';

import { flashcardAPI } from '@/services/api';
import MathMarkdown from '@/components/MathMarkdown';
import { formatDate, formatDateTime, formatTimeOnly } from '@/utils';
import { Modal, Button , Icon } from '@/components/ui';

export default function ReviewHistoryModal({ open, group, onClose }) {
  const { t } = useTranslation();
  const { subject, cards } = group || {};
  const RATING_META = {
    0: { label: t('flashcard.ratingLupa'),  cls: 'text-danger border-danger/30 bg-danger/5' },
    1: { label: t('flashcard.ratingLupa'),  cls: 'text-danger border-danger/30 bg-danger/5' },
    2: { label: t('flashcard.ratingIngat'), cls: 'text-accent-blue border-accent-blue/30 bg-accent-blue/5' },
    3: { label: t('flashcard.ratingHafal'), cls: 'text-success border-success/30 bg-success/5' },
    4: { label: t('flashcard.ratingHafal'), cls: 'text-success border-success/30 bg-success/5' },
  };
  const cardIds = (cards || []).map(c => c.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['flashcard-reviews', cardIds.join(',')],
    queryFn: () => flashcardAPI.getReviews(cardIds),
    enabled: cardIds.length > 0,
  });

  if (!group) return null;

  const reviewsMap = data?.reviews || {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={<span className="flex items-center gap-2"><Icon name={ICONS.learning.brain} size={18} className="text-accent-purple" />{t('flashcard.reviewHistoryTitle', { subjectName: subject?.name || t('flashcard.defaultName') })}</span>}
      footer={<Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>}
      bodyClassName="space-y-3"
    >
      {isLoading && <p className="text-center text-text-muted py-8">{t('common.loading')}</p>}
      {error && <p className="text-center text-danger py-8">{t('flashcard.loadHistoryError', { message: error?.message })}</p>}
      {!isLoading && !error && (cards || []).length === 0 && (
        <p className="text-center text-text-muted py-8">{t('flashcard.noCardsInDeck')}</p>
      )}
      {(cards || []).map(card => {
        const history = reviewsMap[card.id] || [];
        return (
          <div key={card.id} className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-3">
              <MathMarkdown className="text-base font-medium text-text">{card.question}</MathMarkdown>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-3xs font-semibold ${card.mastered ? 'border-success/30 bg-success/5 text-success' : 'border-border text-text-muted'}`}>
                {card.mastered ? t('flashcard.mastered') : t('flashcard.processing')}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-2xs text-text-muted">
              <span>{t('flashcard.reviewedCount')} <b className="text-text">{card.times_seen || 0}×</b></span>
              {card.last_reviewed && <span>{t('flashcard.lastReviewed')} {formatDateTime(card.last_reviewed)}</span>}
            </div>
            {history.length === 0 ? (
              <p className="mt-2 text-xs text-text-muted">{t('flashcard.neverReviewed')}</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {history.map(r => {
                  const meta = RATING_META[r.rating] || RATING_META[0];
                  return (
                    <li key={r.id} className={`flex items-center justify-between rounded-lg border px-2 py-1 text-xs ${meta.cls}`}>
                      <span className="font-medium">{meta.label}</span>
                      <span className="flex items-center gap-3 text-text-muted">
                        <span className="capitalize">{formatDate(r.reviewed_at)} · {formatTimeOnly(r.reviewed_at)}</span>
                        {r.next_review && <span>{t('flashcard.nextReview')} {formatDate(r.next_review)}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </Modal>
  );
}