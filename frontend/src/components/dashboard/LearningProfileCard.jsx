import { motion } from 'framer-motion';

import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

export default function LearningProfileCard({ profile }) {
  const { t } = useTranslation();
  const mastery = profile?.topics_mastery || {};
  const weak = profile?.weak_topics || [];
  const strong = profile?.strong_topics || [];
  const hasData = !!profile?.has_data;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon name={ICONS.learning.brain} size={16} className="text-accent-purple" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.learningTitle')}</h2>
      </div>
      <p className="text-xs text-text-muted mb-4">{t('subjectDashboard.learningSubtitle')}</p>

      {!hasData ? (
        <div className="text-center py-6 text-text-muted text-sm border border-dashed border-border rounded-xl">
          <Icon name={ICONS.learning.sparkles} size={20} className="mx-auto mb-2 opacity-60" />
          {t('subjectDashboard.learningEmpty')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-text">{profile?.estimated_level ?? 0}<span className="text-xs text-text-muted font-normal">/100</span></p>
              <p className="text-[10px] text-text-secondary mt-0.5">{t('subjectDashboard.learningLevel')}</p>
            </div>
            <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-text">{profile?.total_sessions ?? 0}</p>
              <p className="text-[10px] text-text-secondary mt-0.5">{t('subjectDashboard.learningSessions')}</p>
            </div>
            <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-text">{profile?.total_questions ?? 0}</p>
              <p className="text-[10px] text-text-secondary mt-0.5">{t('subjectDashboard.learningQuestions')}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary mb-2">{t('subjectDashboard.learningMastery')}</p>
            {Object.entries(mastery).length === 0 ? (
              <p className="text-xs text-text-muted">{t('subjectDashboard.topicProgressEmpty')}</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(mastery).slice(0, 6).map(([topic, m]) => (
                  <div key={topic}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-text truncate mr-2">{topic}</span>
                      <span className="text-[10px] text-text-secondary shrink-0">
                        {m.accuracy}% · {m.attempts} soal · {m.sessions} sesi
                      </span>
                    </div>
                    <div className="h-1.5 bg-background rounded-full overflow-hidden border border-border/50">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${m.accuracy}%` }}
                        transition={{ duration: 0.6 }}
                        className={`h-full rounded-full ${m.accuracy >= 70 ? 'bg-success' : m.accuracy >= 40 ? 'bg-warning' : 'bg-danger'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-danger mb-1.5">{t('subjectDashboard.learningWeakTitle')}</p>
              {weak.length === 0 ? (
                <p className="text-[11px] text-text-muted">{t('subjectDashboard.learningWeakEmpty')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {weak.slice(0, 5).map((w) => <span key={w} className="badge badge-danger text-[10px]">{w}</span>)}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-success mb-1.5">{t('subjectDashboard.learningStrongTitle')}</p>
              {strong.length === 0 ? (
                <p className="text-[11px] text-text-muted">{t('subjectDashboard.learningStrongEmpty')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {strong.slice(0, 5).map((s) => <span key={s} className="badge badge-success text-[10px]">{s}</span>)}
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-text-muted bg-black/25 border border-white/[0.06] rounded-lg p-2.5 leading-relaxed">
            <Icon name={ICONS.learning.sparkles} size={11} className="inline mr-1 text-accent-purple" />
            {t('subjectDashboard.learningAdaptiveNote')}
            <span className="block mt-1 opacity-80">{t('subjectDashboard.learningThreshold', { n: profile?.confidence_threshold ?? 2 })}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
}
