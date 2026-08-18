import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarCheck, Clock, CheckCircle2, Focus, CreditCard, HelpCircle, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { studyAPI } from '@/services/api';
import { useFocusStore } from '@/store';

const PLAN_ITEM_META = (t) => ({
  flashcard: { icon: CreditCard, label: t('studyPlan.fcFlashcard'),  cls: 'bg-accent-purple/10 text-accent-purple', to: '/flashcard' },
  micro_quiz: { icon: HelpCircle, label: t('studyPlan.fcQuiz'),       cls: 'bg-accent-teal/10 text-accent-teal',      to: '/quiz' },
  socratic:  { icon: Brain,      label: t('studyPlan.fcSocratic'),   cls: 'bg-primary/10 text-primary',              to: '/chat' },
});

export default function DailyPlanCard({ subjectId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enterFocus = useFocusStore((s) => s.enterFocus);
  const [freeMinutes, setFreeMinutes] = useState(60);

  const { data: plan, isLoading } = useQuery({
    queryKey: ['daily-plan', subjectId, freeMinutes],
    queryFn: () => studyAPI.dailyPlan(subjectId, freeMinutes),
    enabled: !!subjectId,
  });

  const doneKey = useCallback((item) => {
    const date = new Date().toISOString().slice(0, 10);
    return `kabayan-plan-done:${subjectId}:${date}:${item.type}:${item.topic || ''}`;
  }, [subjectId]);

  const [doneMap, setDoneMap] = useState({});
  useEffect(() => {
    const map = {};
    (plan?.items || []).forEach((item) => {
      const key = doneKey(item);
      map[key] = localStorage.getItem(key) === '1';
    });
    setDoneMap(map);
  }, [doneKey, freeMinutes, plan]);

  const toggleDone = (item) => {
    const key = doneKey(item);
    const next = !doneMap[key];
    if (next) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
    setDoneMap((p) => ({ ...p, [key]: next }));
  };

  const items = plan?.items || [];
  const doneCount = items.filter((item) => doneMap[doneKey(item)]).length;
  const meta = PLAN_ITEM_META(t);

  const startFocus = (item, m) => {
    enterFocus({
      type: item.type,
      to: m.to,
      label: item.topic ? `${m.label} · ${item.topic}` : (item.subject_name || m.label),
      subjectId,
    });
    navigate(m.to);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarCheck size={16} className="text-accent-blue" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyPlan.title')}</h2>
      </div>
      <p className="text-xs text-text-muted mb-3">{t('studyPlan.subtitle')}</p>

      <div className="flex items-center gap-2 mb-4">
        {[15, 30, 60, 90].map((m) => (
          <button
            key={m}
            onClick={() => setFreeMinutes(m)}
            className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors ${
              freeMinutes === m
                ? 'border-primary/50 bg-primary/10 text-primary font-semibold'
                : 'border-border text-text-secondary hover:border-primary/30'
            }`}
          >
            {m} {t('studyPlan.minutesShort')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-border rounded animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4 border border-dashed border-border rounded-xl">
          {plan?.empty_reason || t('studyPlan.empty')}
        </p>
      ) : (
        <div className="space-y-2">
          {doneCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 bg-background rounded-full overflow-hidden border border-border/50">
                <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: `${(doneCount / items.length) * 100}%` }} />
              </div>
              <span className="text-[10px] text-text-muted shrink-0">
                {t('studyPlan.doneCount', { done: doneCount, total: items.length })}
              </span>
            </div>
          )}
          {items.map((item, i) => {
            const m = meta[item.type] || meta.micro_quiz;
            const Icon = m.icon;
            const isDone = !!doneMap[doneKey(item)];
            return (
              <div key={i} className={`flex items-stretch gap-2 ${isDone ? 'opacity-60' : ''}`}>
                <button
                  onClick={() => toggleDone(item)}
                  title={t('studyPlan.markDone')}
                  className={`w-8 shrink-0 flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                    isDone
                      ? 'border-success/40 bg-success/10 text-success'
                      : 'border-border text-text-muted hover:text-success hover:border-success/40'
                  }`}
                >
                  <CheckCircle2 size={14} />
                </button>
                <button
                  onClick={() => navigate(m.to)}
                  className={`flex-1 min-w-0 flex items-center gap-3 p-2.5 rounded-xl border hover:border-primary/30 transition-colors cursor-pointer text-left ${
                    isDone ? 'border-success/20 bg-success/5' : 'border-border'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.cls}`}>
                    <Icon size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold text-text truncate ${isDone ? 'line-through' : ''}`}>
                      {m.label}{item.topic ? ` · ${item.topic}` : ''}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{item.reason}</p>
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0">
                    {item.duration_minutes} {t('studyPlan.minutesShort')}
                  </span>
                </button>
                <button
                  onClick={() => startFocus(item, m)}
                  title={t('focusMode.start')}
                  className="w-10 shrink-0 flex items-center justify-center rounded-xl border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <Focus size={14} />
                </button>
              </div>
            );
          })}
          {plan?.best_hour != null && (
            <p className="text-[10px] text-text-muted pt-1">
              <Clock size={10} className="inline mr-1" />
              {t('studyPlan.bestHour', { hour: String(plan.best_hour).padStart(2, '0') })}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
