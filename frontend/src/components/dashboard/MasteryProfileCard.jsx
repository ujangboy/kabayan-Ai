import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function MasteryProfileCard({ profile, subject }) {
  const { t } = useTranslation();
  const level = profile?.estimated_level ?? 0;
  const weakCount = (profile?.weak_topics || []).length;
  const strongCount = (profile?.strong_topics || []).length;
  const hasData = !!profile?.has_data;

  const bestScore = subject?.best_score;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <User size={16} className="text-accent-purple" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.learningTitle')}</h2>
        </div>
        {!hasData && (
          <span className="text-[10px] text-text-muted">{t('subjectDashboard.learningEmpty')}</span>
        )}
      </div>

      {hasData ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-background border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-text">{bestScore ?? level}<span className="text-xs text-text-muted font-normal">/100</span></p>
            <p className="text-[10px] text-text-secondary mt-1">{t('subjectDashboard.profileMastery', 'Penguasaan Materi')}</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-danger">{weakCount}</p>
            <p className="text-[10px] text-text-secondary mt-1">{t('subjectDashboard.profileWeak', 'Topik Lemah')}</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-success">{strongCount}</p>
            <p className="text-[10px] text-text-secondary mt-1">{t('subjectDashboard.profileStrong', 'Topik Dikuasai')}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-background border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-text-muted">—</p>
            <p className="text-[10px] text-text-secondary mt-1">{t('subjectDashboard.profileMastery', 'Penguasaan Materi')}</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-text-muted">—</p>
            <p className="text-[10px] text-text-secondary mt-1">{t('subjectDashboard.profileWeak', 'Topik Lemah')}</p>
          </div>
          <div className="bg-background border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-text-muted">—</p>
            <p className="text-[10px] text-text-secondary mt-1">{t('subjectDashboard.profileStrong', 'Topik Dikuasai')}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
