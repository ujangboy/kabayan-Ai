import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import { Tooltip } from '@/components/ui/Tooltip';
import { useTranslation } from 'react-i18next';
import { useFocusStore } from '@/store';

const STUDY_MODALITY_META = (t) => ({
  flashcard: { icon: ICONS.nav.flashcard, label: t('studyRoute.flashcard'),  to: '/flashcard', cls: 'bg-accent-purple/10 text-accent-purple' },
  micro_quiz: { icon: ICONS.ui.help, label: t('studyRoute.microQuiz'), to: '/quiz',      cls: 'bg-accent-teal/10 text-accent-teal' },
  socratic:  { icon: ICONS.learning.brain,      label: t('studyRoute.socratic'),   to: '/chat',      cls: 'bg-primary/10 text-primary' },
});

export default function StudyRecommendationCard({ route, subjectId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enterFocus = useFocusStore((s) => s.enterFocus);
  if (!route?.recommendations) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base">
        <div className="flex items-center gap-2 mb-3">
          <Icon name={ICONS.ui.bolt} size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyRoute.title')}</h2>
        </div>
        <div className="text-center py-6">
          <Icon name={ICONS.ui.bolt} size={30} className="mx-auto mb-3 text-primary/40" />
          <p className="text-xs font-semibold text-text mb-1">{t('studyRoute.emptyTitle', 'Rekomendasi belajar AI')}</p>
          <p className="text-2xs text-text-muted max-w-[240px] mx-auto">
            {t('studyRoute.empty', 'Kerjakan quiz atau latihan dulu — AI akan menyusun rute belajar terbaik untukmu.')}
          </p>
        </div>
      </motion.div>
    );
  }

  const meta = STUDY_MODALITY_META(t);
  const primaryModality = route.primary?.modality;
  const primary = route.recommendations.find(r => r.modality === primaryModality);
  const tierLabel = (tier) => t(`studyRoute.tier${tier.charAt(0) + tier.slice(1).toLowerCase()}`);

  const startFocus = (rec, m) => {
    enterFocus({ type: rec.modality, to: m.to, label: m.label, subjectId });
    navigate(m.to);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name={ICONS.ui.bolt} size={16} className="text-warning" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyRoute.title')}</h2>
      </div>
      <p className="text-xs text-text-muted mb-3">{t('studyRoute.subtitle')}</p>
      <div className="space-y-2">
        {route.recommendations.map((rec) => {
          const m = meta[rec.modality];
          if (!m) return null;
                    const isPrimary = rec.modality === primaryModality;
          return (
            <div key={rec.tier} className="flex items-stretch gap-2">
              <button
                onClick={() => navigate(m.to)}
                className={`flex-1 min-w-0 flex items-center gap-3 p-2.5 rounded-xl border transition-colors cursor-pointer text-left ${
                  isPrimary ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.cls}`}>
                  <Icon name={m.icon} size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text">{m.label}</span>
                    <span className="badge badge-warning text-2xs">{tierLabel(rec.tier)}</span>
                    {isPrimary && <span className="badge badge-success text-2xs">{t('studyRoute.recommended')}</span>}
                  </div>
                  <p className="text-3xs text-text-muted mt-0.5 line-clamp-2">{rec.reason}</p>
                </div>
              </button>
              <Tooltip label={t('focusMode.start')}>
                <button
                  onClick={() => startFocus(rec, m)}
                  className="w-10 shrink-0 flex items-center justify-center rounded-xl border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                  aria-label={t('focusMode.start')}
                >
                  <Icon name={ICONS.learning.focus} size={14} />
                </button>
              </Tooltip>
            </div>
          );
        })}
      </div>
      {primary && (
        <p className="text-3xs text-text-muted mt-3 bg-background border border-border/50 rounded-lg p-2">
          {t('studyRoute.primaryNote', { label: primary.modality_label, n: primary.resources.flashcards_total ?? 0, q: primary.resources.quizzes_total ?? 0 })}
        </p>
      )}
    </motion.div>
  );
}