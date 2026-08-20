import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';

import { examAPI } from '@/services/api';
import { Chip, SectionHeader } from './shared';

export default function BlueprintView({ blueprint, onGenerate, onGenerating, onBack }) {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);

  const items = blueprint?.blueprint_items || [];
  const totalW = items.reduce((s, i) => s + (i.weight_percent || 0), 0);

  useEffect(() => {
    if (!isGenerating) return;
    const start = Date.now();
    const duration = 120000;
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(95, Math.round((elapsed / duration) * 95));
      setProgress(pct);
    }, 1000);
    return () => clearInterval(progressRef.current);
  }, [isGenerating]);

  const handleGenerate = async () => {
    setError(''); setIsGenerating(true); setProgress(0);
    if (onGenerating) onGenerating();
    try {
      const r = await examAPI.generateQuestions(blueprint.blueprint_id);
      if (r.data?.detail) throw new Error(r.data.detail);
      setProgress(100);
      onGenerate(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || t('exam.blueprint.failedGenerate'));
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="p-20 text-center">
        <Icon name={ICONS.status.loading} size={48} className="animate-spin text-primary mx-auto mb-6" />
        <h3 className="text-lg font-semibold text-text mb-2">{t('exam.blueprint.generatingTitle')}</h3>
        <p className="text-text-muted text-sm max-w-sm mx-auto mb-6">
          {t('exam.blueprint.generatingDesc', { strong: <strong className="text-text">1–3 menit</strong> })}
        </p>
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-xs text-text-muted mb-1.5">
            <span>Membuat soal dari blueprint...</span>
            <span className="font-semibold text-primary">{progress}%</span>
          </div>
          <div className="h-3 bg-background rounded-full overflow-hidden border border-border/50">
            <div
              className="h-full bg-primary rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <SectionHeader icon={ICONS.status.pending} title={blueprint?.title || t('exam.blueprint.title')}
          subtitle={t('exam.blueprint.subtitle', { count: items.length, total: totalW })} />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="tr-divider text-xs text-text-muted uppercase tracking-wider">
                <th className="text-left py-2 px-2 font-semibold">{t('exam.blueprint.topic')}</th>
                <th className="text-center py-2 px-2 font-semibold">{t('exam.blueprint.weight')}</th>
                <th className="text-center py-2 px-2 font-semibold">{t('exam.blueprint.questions')}</th>
                <th className="text-center py-2 px-2 font-semibold">{t('exam.blueprint.type')}</th>
                <th className="text-center py-2 px-2 font-semibold">{t('exam.blueprint.bloom')}</th>
                <th className="text-center py-2 px-2 font-semibold">{t('exam.blueprint.difficulty')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="tr-divider last:border-0 hover:bg-background/40">
                  <td className="py-3 px-2">
                    <p className="font-medium text-text">{item.topic}</p>
                    {item.key_concepts?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {item.key_concepts.slice(0, 3).map((c, j) => <Chip key={j} label={c} size="xs" color="blue" />)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      <div className="w-10 h-1.5 rounded-full bg-border overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.weight_percent}%` }} />
                      </div>
                      <span className="text-xs text-text-secondary">{item.weight_percent}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-text font-semibold">{item.question_count}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Chip label={(item.question_types || []).join(', ')} size="xs" color="purple" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Chip label={item.bloom_level} size="xs" color="teal" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Chip label={item.difficulty}  size="xs"
                      color={item.difficulty === 'sulit' ? 'danger' : item.difficulty === 'menengah' ? 'warning' : 'success'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">{error}</div>
      )}

      <div className="flex gap-3 justify-between">
        <button onClick={onBack} className="btn-ghost text-sm border border-border">
          <Icon name={ICONS.ui.chevronLeft} size={14} /> {t('exam.blueprint.changeConfig')}
        </button>
        <button onClick={handleGenerate} className="btn-primary">
          <Icon name={ICONS.media.play} size={14} /> {t('exam.blueprint.generateQuestions')}
        </button>
      </div>
    </div>
  );
}
