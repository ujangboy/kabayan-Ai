import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';

import { useTranslation } from 'react-i18next';

const READINESS_META = {
  siap_ujian: { cls: 'badge-success', icon: CheckCircle2 },
  perlu_persiapan: { cls: 'badge-warning', icon: AlertTriangle },
  perlu_banyak_latihan: { cls: 'badge-danger', icon: AlertTriangle },
  belum_ada_data: { cls: 'badge', icon: Clock },
};

export default function DiagnosticCard({ diagnostic }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  if (!diagnostic) return null;

  const readiness = diagnostic.readiness || {};
  const overview = diagnostic.overview || {};
  const weakTopics = diagnostic.weak_topics || [];
  const strongTopics = diagnostic.strong_topics || [];
  const riskFlags = diagnostic.risk_flags || [];
  const actionItems = diagnostic.action_items || [];
  const noDataTopics = diagnostic.no_data_topics || [];
  const rdMeta = READINESS_META[readiness.level] || READINESS_META.belum_ada_data;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Icon name={ICONS.learning.stethoscope} size={16} className="text-accent-teal" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyDiagnostic.title')}</h2>
        </div>
        <div className="flex items-center gap-3">
          {readiness.avg_mastery != null && (
            <span className="text-base font-bold text-text">{readiness.avg_mastery}%</span>
          )}
          <span className={`badge text-2xs ${rdMeta.cls}`}>
            <Icon name={rdMeta.icon} size={9} className="inline mr-1" />
            {readiness.label || t('studyDiagnostic.levelNoData')}
          </span>
          {expanded ? <Icon name={ICONS.ui.chevronUp} size={14} className="text-text-muted" /> : <Icon name={ICONS.ui.chevronDown} size={14} className="text-text-muted" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">
              {/* Coverage */}
              <div>
                <div className="flex items-center justify-between text-3xs text-text-muted mb-1">
                  <span>{t('studyDiagnostic.coverage', {
                    covered: overview.topics_covered ?? 0,
                    total: overview.topics_in_bank ?? 0,
                    pct: overview.coverage_pct ?? 0,
                  })}</span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden border border-border/50">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${overview.coverage_pct ?? 0}%` }} />
                </div>
              </div>

              {/* Action items */}
              {actionItems.length > 0 && (
                <div>
                  <p className="text-3xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('studyDiagnostic.actionsTitle')}</p>
                  <div className="space-y-1.5">
                    {actionItems.slice(0, 3).map((item, i) => (
                      <button
                        key={i}
                        onClick={() => navigate(item.to || '/flashcard')}
                        className="w-full flex items-center justify-between p-2 rounded-lg border border-border hover:border-primary/40 transition-colors cursor-pointer text-left"
                      >
                        <span className="text-2xs font-medium text-text truncate">{item.topic || item.modality}</span>
                        <span className="text-3xs text-primary shrink-0">{t('studyDiagnostic.start')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak topics */}
              {weakTopics.length > 0 && (
                <div>
                  <p className="text-3xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('studyDiagnostic.weakTitle')}</p>
                  <div className="space-y-1">
                    {weakTopics.slice(0, 5).map(d => (
                      <div key={d.topic} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="text-2xs text-text truncate">{d.topic}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {d.trend_direction === 'turun' && <Icon name={ICONS.learning.regress} size={10} className="text-danger" />}
                          {d.trend_direction === 'naik' && <Icon name={ICONS.learning.progress} size={10} className="text-success" />}
                          <span className="text-3xs font-semibold text-danger">{d.accuracy}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strong topics */}
              {strongTopics.length > 0 && (
                <div>
                  <p className="text-3xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('studyDiagnostic.strongTitle')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {strongTopics.slice(0, 5).map(d => (
                      <span key={d.topic} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-success/10 border border-success/20 text-2xs text-success">
                        <Icon name={ICONS.status.success} size={8} />
                        {d.topic} · {d.accuracy}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk flags */}
              {riskFlags.length > 0 && (
                <div>
                  <p className="text-3xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('studyDiagnostic.risksTitle')}</p>
                  <div className="space-y-1.5">
                    {riskFlags.slice(0, 2).map((f, i) => (
                      <div key={i} className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-3xs ${f.severity === 'tinggi' ? 'bg-danger/10 border border-danger/20 text-danger' : 'bg-warning/10 border border-warning/20 text-warning'}`}>
                        <Icon name={ICONS.status.warning} size={10} className="shrink-0 mt-0.5" />
                        <span>{f.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {noDataTopics.length > 0 && (
                <p className="text-3xs text-text-muted">
                  {t('studyDiagnostic.noDataTopics', { topics: noDataTopics.join(', ') })}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}