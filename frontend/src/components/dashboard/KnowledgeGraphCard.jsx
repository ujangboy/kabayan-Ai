import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import { useTranslation } from 'react-i18next';

export default function KnowledgeGraphCard({ graph }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (!graph) return null;
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  if (nodes.length === 0) return null;

  const babs = nodes.filter(n => n.type === 'bab');

  const containsEdgeMap = {};
  edges.filter(e => e.type === 'contains').forEach(e => {
    if (!containsEdgeMap[e.target]) containsEdgeMap[e.target] = [];
    containsEdgeMap[e.target].push(e.source);
  });

  const ungrouped = nodes.filter(n => n.type === 'topik' && !edges.some(e => e.type === 'contains' && e.source === n.id));
  const dependencies = edges.filter(e => e.type === 'depends_on').sort((a, b) => (b.weight || 0) - (a.weight || 0)).slice(0, 6);

  const statusBadge = (n) => {
    if (n.status === 'lemah') return { cls: 'badge-danger', label: t('studyGraph.weak') };
    if (n.status === 'kuat') return { cls: 'badge-success', label: t('studyGraph.strong') };
    if (n.status === 'tanpa_data') return { cls: 'badge', label: t('studyGraph.noData') };
    return null;
  };

  const topicNodesById = {};
  nodes.filter(n => n.type === 'topik').forEach(n => { topicNodesById[n.id] = n; });

  const topicCount = graph.meta?.topics_count ?? nodes.filter(n => n.type === 'topik').length;
  const babCount = graph.meta?.babs_count ?? babs.length;
  const weakCount = nodes.filter(n => n.type === 'topik' && n.status === 'lemah').length;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Icon name={ICONS.learning.network} size={16} className="text-accent-blue" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyGraph.title')}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] text-text-muted">
            <span>{babCount} {t('studyGraph.babsShort', 'bab')}</span>
            <span>·</span>
            <span>{topicCount} {t('studyGraph.topicsShort', 'topik')}</span>
            {weakCount > 0 && <span className="text-danger">· {weakCount} lemah</span>}
          </div>
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
            <p className="text-xs text-text-muted mt-2 mb-3">{t('studyGraph.subtitle')}</p>

            <div className="space-y-3">
              {babs.map(bab => {
                const childTopicIds = containsEdgeMap[bab.id] || [];
                const childTopics = childTopicIds.map(id => topicNodesById[id]).filter(Boolean);
                const hasConcepts = childTopics.some(n => (n.concepts || []).length > 0);

                return (
                  <div key={bab.id} className="bg-black/25 border border-white/[0.06] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-text">{bab.label}</span>
                      <div className="flex items-center gap-2">
                        {bab.mastery != null && (
                          <span className="text-[10px] text-text-secondary">
                            {t('studyGraph.mastery')}: {bab.mastery}%
                          </span>
                        )}
                        <span className="text-[10px] text-text-muted">{bab.topics_count} {t('studyGraph.topics')}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {childTopics.map(n => {
                        const sb = statusBadge(n);
                        return (
                          <span key={n.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-card text-[10px]">
                            <span className="font-medium text-text">{n.label}</span>
                            {n.mastery != null && <span className="text-text-muted">{n.mastery}%</span>}
                            {n.in_latest_blueprint && <Icon name={ICONS.learning.sparkles} size={10} className="text-warning" />}
                            {sb && <span className={`badge text-[9px] ${sb.cls}`}>{sb.label}</span>}
                          </span>
                        );
                      })}
                    </div>
                    {hasConcepts && (
                      <div className="mt-2">
                        {childTopics
                          .filter(n => (n.concepts || []).length > 0)
                          .slice(0, 3)
                          .map(n => (
                            <p key={n.id} className="text-[10px] text-text-muted leading-relaxed">
                              <span className="font-semibold text-text-secondary">{n.label}:</span> {n.concepts.join(' · ')}
                            </p>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {ungrouped.length > 0 && (
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3">
                  <p className="text-xs font-semibold text-text mb-2">{t('studyGraph.ungrouped')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ungrouped.map(n => {
                      const sb = statusBadge(n);
                      return (
                        <span key={n.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-card text-[10px]">
                          <span className="font-medium text-text">{n.label}</span>
                          {n.mastery != null && <span className="text-text-muted">{n.mastery}%</span>}
                          {sb && <span className={`badge text-[9px] ${sb.cls}`}>{sb.label}</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {dependencies.length > 0 && (
                <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3">
                  <p className="text-xs font-semibold text-text mb-2">{t('studyGraph.dependencies')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dependencies.map((e, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-card border border-border text-[10px] text-text-secondary">
                        {e.source} <Icon name={ICONS.actions.forward} size={10} className="text-text-muted" /> {e.target}
                        <span className="text-text-muted">×{e.weight}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
