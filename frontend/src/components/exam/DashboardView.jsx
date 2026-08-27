import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon , Button} from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';

import { examAPI } from '@/services/api';
import { cn } from '@/utils';
import { springLift } from '@/lib/motion';
import { Chip, SectionHeader, StarRating } from './shared';

export default function DashboardView({ subjectId, subjects, analysis, onAnalysisDone, onStartConfig }) {
  const { t } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [expandedNode, setExpandedNode] = useState(null);

  const runAnalysis = async () => {
    if (!subjectId) return setError(t('exam.dashboard.selectSubjectFirst'));
    setError(''); setIsAnalyzing(true);
    try {
      const r = await examAPI.analyze(subjectId);
      if (r.data?.detail) throw new Error(r.data.detail);
      onAnalysisDone(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || t('exam.dashboard.analysisFailed'));
    } finally { setIsAnalyzing(false); }
  };

  if (!subjectId) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="noselect" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }} className="card-base p-16 text-center">
          <Icon name={ICONS.learning.brain} size={56} className="mx-auto mb-4 text-primary opacity-40" />
          <h3 className="text-lg font-semibold text-text mb-2">{t('exam.dashboard.title')}</h3>
          <p className="text-text-muted text-sm max-w-md mx-auto">
            {t('exam.dashboard.selectSubjectPrompt')}
          </p>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!analysis) {
    const subjectName = subjects.find(s => String(s.id) === String(subjectId))?.name || '';
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="noanalysis" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }} className="card-base p-16 text-center">
          <Icon name={ICONS.learning.brain} size={56} className="mx-auto mb-4 text-primary opacity-60" />
          <h3 className="text-lg font-semibold text-text mb-2">{t('exam.dashboard.analysisTitle', { subjectname: subjectName })}</h3>
          <p className="text-text-muted text-sm max-w-md mx-auto mb-6">
            {t('exam.dashboard.analysisDesc')}
          </p>
          {error && <p className="text-danger text-sm mb-4">{error}</p>}
          <Button onClick={runAnalysis} disabled={isAnalyzing} className="mx-auto" variant="primary">
            {isAnalyzing ? <><Icon name={ICONS.status.loading} size={15} className="animate-spin" /> {t('exam.dashboard.analyzing')}</> : <><Icon name={ICONS.learning.brain} size={15} /> {t('exam.dashboard.startAnalysis')}</>}
          </Button>
        </motion.div>
      </AnimatePresence>
    );
  }

  const { overview = {}, stats = {}, topic_priority = [], knowledge_map = [], weakness_indicators = [] } = analysis;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }} className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('exam.dashboard.statMateri'), value: stats.material_count ?? 0,  icon: ICONS.files.document,   color:'text-accent-blue' },
          { label: t('exam.dashboard.statTopic'), value: overview.total_topics ?? 0,  icon: ICONS.learning.target,     color:'text-primary' },
          { label: t('exam.dashboard.statNotes'), value: stats.note_count ?? 0,       icon: ICONS.learning.bookmarks, color:'text-success' },
          { label: t('exam.dashboard.statEstHours'), value: `${overview.estimated_study_hours ?? 0}j`, icon: ICONS.learning.clock, color:'text-warning' },
         ].map(({ label, value, icon, color }) => (
           <motion.div key={label} whileHover={{ y: -3 }} transition={springLift} className="card-base p-4 flex items-center gap-3 hover:border-primary/40">
             <div className={`w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 ${color}`}>
               <Icon name={icon} size={16} />
             </div>
             <div>
               <p className="text-xl font-bold text-text">{value}</p>
               <p className="text-xs text-text-muted">{label}</p>
             </div>
           </motion.div>
         ))}
      </div>

      {/* Summary + Complexity */}
      {overview.summary && (
        <div className="card-base p-4 flex items-start gap-3">
          <Icon name={ICONS.status.info} size={15} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-base text-text">{overview.summary}</p>
            <div className="mt-2">
              <Chip label={t('exam.dashboard.complexityLabel', { level: overview.complexity_level || '-' })}
                color={overview.complexity_level === 'Tinggi' ? 'danger' : overview.complexity_level === 'Menengah' ? 'warning' : 'success'} />
            </div>
          </div>
        </div>
      )}

      {/* Topic Priority */}
      <div className="card-base p-5">
        <SectionHeader icon={ICONS.learning.target} title={t('exam.dashboard.topicPriority')} subtitle={t('exam.dashboard.topicPrioritySubtitle')} />
        <div className="space-y-3">
          {topic_priority.slice(0, 8).map((tp, i) => (
             <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background border border-transparent hover:border-primary/30 hover:bg-card/60 transition-colors">
              <span className="text-xs font-bold text-text-muted w-5 mt-0.5">{i+1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-base text-text">{tp.topic}</span>
                  <StarRating stars={tp.stars} />
                </div>
                <p className="text-xs text-text-muted mt-0.5">{tp.reason}</p>
                {tp.subtopics?.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1.5">
                    {tp.subtopics.map((st, j) => <Chip key={j} label={st} color="blue" size="xs" />)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Map */}
      {knowledge_map.length > 0 && (
        <div className="card-base p-5">
          <SectionHeader icon={ICONS.learning.map} title={t('exam.dashboard.knowledgeMap')} subtitle={t('exam.dashboard.knowledgeMapSubtitle')} />
          <div className="space-y-2">
            {knowledge_map.map((node, i) => (
              <div key={i}>
                 <button
                   onClick={() => setExpandedNode(expandedNode === i ? null : i)}
                   className="w-full flex items-center gap-2 p-3 rounded-xl bg-background border border-transparent hover:border-primary/30 hover:bg-card/60 transition-colors text-left"
                 >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon name={ICONS.learning.bookOpen} size={13} className="text-primary" />
                  </div>
                  <span className="font-semibold text-base text-text flex-1">{node.node}</span>
                  <Icon name={ICONS.ui.chevronDown} size={14} className={cn('text-text-muted transition-transform', expandedNode === i && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {expandedNode === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-9 pl-4 border-l-2 border-primary/20 pb-2 mt-1 space-y-2">
                        <p className="text-xs text-text-secondary">{node.description}</p>
                        {node.children?.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {node.children.map((c, j) => (
                              <span key={j} className="flex items-center gap-1 text-xs text-text-secondary">
                                <Icon name={ICONS.actions.forward} size={10} className="text-primary" />{c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weakness Analysis */}
      {weakness_indicators.length > 0 && (
        <div className="card-base p-5">
          <SectionHeader icon={ICONS.status.warning} title={t('exam.dashboard.weaknessAnalysis')} subtitle={t('exam.dashboard.weaknessSubtitle')} />
          <div className="space-y-3">
            {weakness_indicators.map((w, i) => (
              <div key={i} className="p-3 rounded-xl bg-danger/5 border border-danger/15">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name={ICONS.status.error} size={13} className="text-danger shrink-0" />
                  <span className="font-semibold text-base text-text">{w.topic}</span>
                </div>
                <p className="text-xs text-text-secondary ml-5">{w.reason}</p>
                {w.suggestion && (
                  <p className="text-xs text-primary ml-5 mt-1 flex items-center gap-1">
                    <Icon name={ICONS.learning.lightbulb} size={11} /> {w.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh + CTA */}
      <div className="flex gap-3">
        <Button onClick={runAnalysis} disabled={isAnalyzing} className="text-xs border border-border" variant="ghost">
          {isAnalyzing ? <Icon name={ICONS.status.loading} size={13} className="animate-spin" /> : <Icon name={ICONS.actions.refresh} size={13} />}
          {t('exam.dashboard.refreshAnalysis')}
        </Button>
        <Button onClick={onStartConfig} className="text-xs" variant="primary">
          {t('exam.dashboard.generateSimulation')}
        </Button>
      </div>
      </motion.div>
    </AnimatePresence>
  );
}