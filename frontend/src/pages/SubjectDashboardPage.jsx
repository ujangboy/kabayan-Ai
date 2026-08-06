import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Book, FileText, CreditCard, HelpCircle, Pencil, Trash2, X,
  TrendingUp, TrendingDown, Trophy, Target, CalendarCheck, Clock, BookOpen, Zap, Brain, Sparkles, Focus,
  Network, Stethoscope, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { subjectAPI, examAPI, studyAPI } from '@/services/api';
import { useFocusStore } from '@/store';
import { formatDate, fileIcon } from '@/utils';
import ProgressCard from '@/components/ProgressCard';

const TOPIC_STATUS_META = (t) => ({
  dikuasai:      { label: t('subjectDashboard.topicMastered'),     cls: 'badge-success' },
  berjalan:      { label: t('subjectDashboard.topicInProgress'),   cls: 'badge-warning' },
  perlu_latihan: { label: t('subjectDashboard.topicNeedsPractice'), cls: 'badge-danger' },
});

function ScoreChart({ history }) {
  const { t } = useTranslation();
  const data = (history || []).filter(d => d && d.score != null).slice(-10);

  if (data.length < 2) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        {data.length === 1
          ? t('subjectDashboard.chartOneScore')
          : t('subjectDashboard.chartNoScores')}
      </div>
    );
  }

  const W = 560, H = 200, PAD_X = 36, PAD_Y = 24;
  const scores = data.map(d => d.score);
  const minScore = Math.max(0, Math.floor((Math.min(...scores) - 10) / 10) * 10);
  const maxScore = Math.min(100, Math.ceil((Math.max(...scores) + 10) / 10) * 10);

  const x = (i) => PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, data.length - 1);
  const y = (s) => H - PAD_Y - ((s - minScore) / Math.max(1, maxScore - minScore)) * (H - PAD_Y * 2);

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.score).toFixed(1)}`).join(' ');
  const chartPoints = path.replace(/[ML]/g, '').trim();
  const lastX = x(data.length - 1).toFixed(1);
  const bottomY = H - PAD_Y;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0, 1, 2, 3].map(g => {
        const val = minScore + ((maxScore - minScore) * g) / 3;
        const yy = y(val);
        return (
          <g key={g}>
            <line x1={PAD_X} y1={yy} x2={W - PAD_X} y2={yy} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={4} y={yy + 3} fontSize="9" fill="var(--text-muted)">{Math.round(val)}</text>
          </g>
        );
      })}
      {/* Area fill */}
      <polygon
        points={`${PAD_X},${bottomY} ${chartPoints} ${lastX},${bottomY}`}
        fill="var(--primary)" opacity="0.08"
      />
      <polyline points={chartPoints} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.score)} r="4" fill={d.score >= 70 ? 'var(--success)' : d.score >= 50 ? 'var(--warning)' : 'var(--danger)'} stroke="var(--card)" strokeWidth="1.5" />
          <text x={x(i)} y={y(d.score) - 10} fontSize="10" fontWeight="700" fill="var(--text)" textAnchor="middle">{d.score}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 8} fontSize="9" fill="var(--text-muted)" textAnchor="middle">
          {new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
        </text>
      ))}
    </svg>
  );
}

function EditSubjectModal({ subject, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: subject?.name || '',
    semester: subject?.semester || '',
    lecturer: subject?.lecturer || '',
    description: subject?.description || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    try {
      await subjectAPI.update(subject.id, formData);
      onSuccess();
    } catch (err) {
      alert(err.message || t('subjectDashboard.editError'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md card-base shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Book size={18} className="text-primary" />
            <h3 className="font-semibold text-text">{t('subjectDashboard.editTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('subjectDashboard.formNameLabel')}</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('subjectDashboard.formSemesterLabel')}</label>
              <input
                type="text"
                value={formData.semester}
                onChange={(e) => setFormData(p => ({ ...p, semester: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{t('subjectDashboard.formLecturerLabel')}</label>
              <input
                type="text"
                value={formData.lecturer}
                onChange={(e) => setFormData(p => ({ ...p, lecturer: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('subjectDashboard.formNotesLabel')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
            <button type="submit" disabled={isSubmitting || !formData.name} className="btn-primary">
              {isSubmitting ? t('subjectDashboard.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, suffix }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="card-base flex items-center gap-4 p-4">
      <div className={`w-10 h-10 rounded-xl bg-card flex items-center justify-center shrink-0 border border-border ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-text">{value ?? 0}{suffix && <span className="text-sm text-text-muted font-normal"> {suffix}</span>}</p>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    </motion.div>
  );
}

function LearningProfileCard({ profile }) {
  const { t } = useTranslation();
  const mastery = profile?.topics_mastery || {};
  const weak = profile?.weak_topics || [];
  const strong = profile?.strong_topics || [];
  const hasData = !!profile?.has_data;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <div className="flex items-center gap-2 mb-1">
        <Brain size={16} className="text-accent-purple" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.learningTitle')}</h2>
      </div>
      <p className="text-xs text-text-muted mb-4">{t('subjectDashboard.learningSubtitle')}</p>

      {!hasData ? (
        <div className="text-center py-6 text-text-muted text-sm border border-dashed border-border rounded-xl">
          <Sparkles size={20} className="mx-auto mb-2 opacity-60" />
          {t('subjectDashboard.learningEmpty')}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Level + counters */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-text">{profile?.estimated_level ?? 0}<span className="text-xs text-text-muted font-normal">/100</span></p>
              <p className="text-[10px] text-text-secondary mt-0.5">{t('subjectDashboard.learningLevel')}</p>
            </div>
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-text">{profile?.total_sessions ?? 0}</p>
              <p className="text-[10px] text-text-secondary mt-0.5">{t('subjectDashboard.learningSessions')}</p>
            </div>
            <div className="bg-background border border-border rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-text">{profile?.total_questions ?? 0}</p>
              <p className="text-[10px] text-text-secondary mt-0.5">{t('subjectDashboard.learningQuestions')}</p>
            </div>
          </div>

          {/* Mastery bars */}
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

          {/* Weak / strong chips */}
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

          <p className="text-[11px] text-text-muted bg-background border border-border/50 rounded-lg p-2.5 leading-relaxed">
            <Sparkles size={11} className="inline mr-1 text-accent-purple" />
            {t('subjectDashboard.learningAdaptiveNote')}
            <span className="block mt-1 opacity-80">{t('subjectDashboard.learningThreshold', { n: profile?.confidence_threshold ?? 2 })}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
}

const ACTIVITY_META = (t) => ({
  quiz:      { icon: HelpCircle, label: t('subjectDashboard.activityQuiz'),      cls: 'bg-accent-teal/10 text-accent-teal' },
  ujian:     { icon: Trophy,     label: t('subjectDashboard.activityExam'),      cls: 'bg-primary/10 text-primary' },
  flashcard: { icon: CreditCard, label: t('subjectDashboard.activityFlashcard'), cls: 'bg-accent-purple/10 text-accent-purple' },
  materi:    { icon: FileText,   label: t('subjectDashboard.activityMaterial'),  cls: 'bg-accent-blue/10 text-accent-blue' },
});

const STUDY_MODALITY_META = (t) => ({
  flashcard: { icon: CreditCard, label: t('studyRoute.flashcard'),  to: '/flashcard', cls: 'bg-accent-purple/10 text-accent-purple' },
  micro_quiz: { icon: HelpCircle, label: t('studyRoute.microQuiz'), to: '/quiz',      cls: 'bg-accent-teal/10 text-accent-teal' },
  socratic:  { icon: Brain,      label: t('studyRoute.socratic'),   to: '/chat',      cls: 'bg-primary/10 text-primary' },
});

const FATIGUE_META = (t) => ({
  berat:   { cls: 'badge-danger',  label: t('studyMetrics.fatigueHeavy') },
  sedang:  { cls: 'badge-warning', label: t('studyMetrics.fatigueMedium') },
  ringan:  { cls: 'badge-warning', label: t('studyMetrics.fatigueLight') },
  normal:  { cls: 'badge-success', label: t('studyMetrics.fatigueNormal') },
  tidak_cukup_data: { cls: 'badge', label: t('studyMetrics.fatigueInsufficient') },
});

function LearningMetricsCard({ metrics }) {
  const { t } = useTranslation();
  if (!metrics) return null;
  const speed = metrics.speed || {};
  const fatigue = metrics.fatigue || {};
  const opt = metrics.optimal_time || {};
  const fsrs = metrics.fsrs_overview || {};

  const fatigueMeta = FATIGUE_META(t)[fatigue.level] || FATIGUE_META(t).tidak_cukup_data;
  const dueText = fsrs.due_cards != null ? fsrs.due_cards : '—';
  const newText = fsrs.new_cards != null ? fsrs.new_cards : '—';
  const retention = fsrs.retention_pct != null ? `${fsrs.retention_pct}%` : '—';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={16} className="text-accent-teal" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyMetrics.title')}</h2>
      </div>

      {/* FSRS overview */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-background border border-border rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-text">{dueText}</p>
          <p className="text-[10px] text-text-secondary mt-0.5">{t('studyMetrics.fsrsDue')}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-text">{newText}</p>
          <p className="text-[10px] text-text-secondary mt-0.5">{t('studyMetrics.fsrsNew')}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-text">{retention}</p>
          <p className="text-[10px] text-text-secondary mt-0.5">{t('studyMetrics.fsrsRetention')}</p>
        </div>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">{t('studyMetrics.speed')}</span>
          <span className="font-semibold text-text">
            {speed.items_per_minute != null ? `${speed.items_per_minute} ${t('studyMetrics.speedUnit')}` : t('studyMetrics.noData')}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">{t('studyMetrics.fatigue')}</span>
          <span className={`badge text-[10px] ${fatigueMeta.cls}`}>{fatigueMeta.label}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">{t('studyMetrics.bestTime')}</span>
          <span className="font-semibold text-text">
            {opt.best_hour != null
              ? `${String(opt.best_hour).padStart(2, '0')}.00 WIB`
              : t('studyMetrics.noData')}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-text-muted mt-3 leading-relaxed bg-background border border-border/50 rounded-lg p-2">
        {speed.reading_speed_note}
      </p>
    </motion.div>
  );
}

const PLAN_ITEM_META = (t) => ({
  flashcard: { icon: CreditCard, label: t('studyPlan.fcFlashcard'),  cls: 'bg-accent-purple/10 text-accent-purple', to: '/flashcard' },
  micro_quiz: { icon: HelpCircle, label: t('studyPlan.fcQuiz'),       cls: 'bg-accent-teal/10 text-accent-teal',      to: '/quiz' },
  socratic:  { icon: Brain,      label: t('studyPlan.fcSocratic'),   cls: 'bg-primary/10 text-primary',              to: '/chat' },
});

function DailyPlanCard({ subjectId }) {
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

      {/* Free time selector */}
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
          {plan.empty_reason || t('studyPlan.empty')}
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
          {plan.best_hour != null && (
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

function StudyRecommendationCard({ route, subjectId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enterFocus = useFocusStore((s) => s.enterFocus);
  if (!route?.recommendations) return null;

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
        <Zap size={16} className="text-warning" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyRoute.title')}</h2>
      </div>
      <p className="text-xs text-text-muted mb-3">{t('studyRoute.subtitle')}</p>
      <div className="space-y-2">
        {route.recommendations.map((rec) => {
          const m = meta[rec.modality];
          const Icon = m.icon;
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
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text">{m.label}</span>
                    <span className="badge badge-warning text-[9px]">{tierLabel(rec.tier)}</span>
                    {isPrimary && <span className="badge badge-success text-[9px]">{t('studyRoute.recommended')}</span>}
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{rec.reason}</p>
                </div>
              </button>
              <button
                onClick={() => startFocus(rec, m)}
                title={t('focusMode.start')}
                className="w-10 shrink-0 flex items-center justify-center rounded-xl border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
              >
                <Focus size={14} />
              </button>
            </div>
          );
        })}
      </div>
      {primary && (
        <p className="text-[10px] text-text-muted mt-3 bg-background border border-border/50 rounded-lg p-2">
          {t('studyRoute.primaryNote', { label: primary.modality_label, n: primary.resources.flashcards_total ?? 0, q: primary.resources.quizzes_total ?? 0 })}
        </p>
      )}
    </motion.div>
  );
}

function KnowledgeGraphCard({ graph }) {
  const { t } = useTranslation();
  if (!graph) return null;
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  if (nodes.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
        <div className="flex items-center gap-2 mb-4">
          <Network size={16} className="text-accent-blue" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyGraph.title')}</h2>
        </div>
        <p className="text-xs text-text-muted">{t('studyGraph.empty')}</p>
      </motion.div>
    );
  }

  const babs = nodes.filter(n => n.type === 'bab');
  const ungrouped = nodes.filter(n => n.type === 'topik' && !edges.some(e => e.type === 'contains' && e.source === n.id));
  const dependencies = edges.filter(e => e.type === 'depends_on').sort((a, b) => (b.weight || 0) - (a.weight || 0)).slice(0, 6);
  const statusBadge = (n) => {
    if (n.status === 'lemah') return { cls: 'badge-danger', label: t('studyGraph.weak') };
    if (n.status === 'kuat') return { cls: 'badge-success', label: t('studyGraph.strong') };
    if (n.status === 'tanpa_data') return { cls: 'badge', label: t('studyGraph.noData') };
    return null;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <div className="flex items-center gap-2 mb-1">
        <Network size={16} className="text-accent-blue" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyGraph.title')}</h2>
      </div>
      <p className="text-xs text-text-muted mb-3">{t('studyGraph.subtitle')}</p>

      <div className="space-y-3">
        {babs.map(bab => (
          <div key={bab.id} className="bg-background border border-border/60 rounded-xl p-3">
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
              {nodes.filter(n => n.type === 'topik' && edges.some(e => e.type === 'contains' && e.source === n.id && e.target === bab.id))
                .map(n => {
                  const sb = statusBadge(n);
                  return (
                    <span key={n.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-card text-[10px]">
                      <span className="font-medium text-text">{n.label}</span>
                      {n.mastery != null && <span className="text-text-muted">{n.mastery}%</span>}
                      {n.in_latest_blueprint && <Sparkles size={10} className="text-warning" />}
                      {sb && <span className={`badge text-[9px] ${sb.cls}`}>{sb.label}</span>}
                    </span>
                  );
                })}
            </div>
            {nodes.filter(n => n.type === 'topik' && edges.some(e => e.type === 'contains' && e.source === n.id && e.target === bab.id))
              .some(n => (n.concepts || []).length > 0) && (
              <div className="mt-2">
                {nodes.filter(n => n.type === 'topik' && (n.concepts || []).length > 0)
                  .slice(0, 3)
                  .map(n => (
                    <p key={n.id} className="text-[10px] text-text-muted leading-relaxed">
                      <span className="font-semibold text-text-secondary">{n.label}:</span> {n.concepts.join(' · ')}
                    </p>
                  ))}
              </div>
            )}
          </div>
        ))}

        {ungrouped.length > 0 && (
          <div className="bg-background border border-border/60 rounded-xl p-3">
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
          <div className="bg-background border border-border/60 rounded-xl p-3">
            <p className="text-xs font-semibold text-text mb-2">{t('studyGraph.dependencies')}</p>
            <div className="flex flex-wrap gap-1.5">
              {dependencies.map((e, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-card border border-border text-[10px] text-text-secondary">
                  {e.source} <ArrowRight size={10} className="text-text-muted" /> {e.target}
                  <span className="text-text-muted">×{e.weight}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-text-muted mt-3">
        {t('studyGraph.meta', {
          topics: graph.meta?.topics_count ?? 0,
          babs: graph.meta?.babs_count ?? 0,
          deps: graph.meta?.dependencies_count ?? 0,
        })}
      </p>
    </motion.div>
  );
}

const READINESS_META = {
  siap_ujian: { cls: 'badge-success', icon: CheckCircle2 },
  perlu_persiapan: { cls: 'badge-warning', icon: AlertTriangle },
  perlu_banyak_latihan: { cls: 'badge-danger', icon: AlertTriangle },
  belum_ada_data: { cls: 'badge', icon: Clock },
};

function DiagnosticCard({ diagnostic }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!diagnostic) return null;

  const readiness = diagnostic.readiness || {};
  const overview = diagnostic.overview || {};
  const weakTopics = diagnostic.weak_topics || [];
  const strongTopics = diagnostic.strong_topics || [];
  const riskFlags = diagnostic.risk_flags || [];
  const actionItems = diagnostic.action_items || [];
  const noDataTopics = diagnostic.no_data_topics || [];
  const rdMeta = READINESS_META[readiness.level] || READINESS_META.belum_ada_data;
  const RdIcon = rdMeta.icon;
  const modalityMeta = STUDY_MODALITY_META(t);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <div className="flex items-center gap-2 mb-1">
        <Stethoscope size={16} className="text-accent-teal" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyDiagnostic.title')}</h2>
      </div>
      <p className="text-xs text-text-muted mb-3">{t('studyDiagnostic.subtitle')}</p>

      {/* Readiness */}
      <div className="flex items-center justify-between bg-background border border-border rounded-xl p-3 mb-3">
        <span className="text-xs text-text-secondary">{t('studyDiagnostic.readiness')}</span>
        <div className="flex items-center gap-2">
          {readiness.avg_mastery != null && (
            <span className="text-sm font-bold text-text">{readiness.avg_mastery}%</span>
          )}
          <span className={`badge text-[10px] ${rdMeta.cls}`}>
            <RdIcon size={10} className="inline mr-1" />
            {readiness.label || t('studyDiagnostic.levelNoData')}
          </span>
        </div>
      </div>

      {/* Coverage */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
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
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('studyDiagnostic.actionsTitle')}</p>
          <div className="space-y-2">
            {actionItems.map((item, i) => {
              const m = modalityMeta[item.modality] || STUDY_MODALITY_META(t).flashcard;
              const Icon = m.icon;
              return (
                <button
                  key={i}
                  onClick={() => navigate(item.to)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-border hover:border-primary/40 transition-colors cursor-pointer text-left"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.cls}`}>
                    <Icon size={13} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-text truncate">
                      {item.topic ? `${item.topic} · ${m.label}` : m.label}
                    </p>
                    <p className="text-[10px] text-text-muted line-clamp-2">{item.reason}</p>
                  </div>
                  <span className="text-[10px] text-primary shrink-0">{t('studyDiagnostic.start')}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Weak topics */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('studyDiagnostic.weakTitle')}</p>
        {weakTopics.length === 0 ? (
          <p className="text-xs text-text-muted">{t('studyDiagnostic.noWeak')}</p>
        ) : (
          <div className="space-y-1.5">
            {weakTopics.map(d => (
              <div key={d.topic} className="flex items-center justify-between gap-2 bg-background border border-border/60 rounded-lg px-2.5 py-1.5">
                <span className="text-xs text-text truncate">{d.topic}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {d.trend_direction === 'turun' && <TrendingDown size={12} className="text-danger" />}
                  {d.trend_direction === 'naik' && <TrendingUp size={12} className="text-success" />}
                  <span className="text-xs font-semibold text-danger">{d.accuracy}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Strong topics */}
      {strongTopics.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('studyDiagnostic.strongTitle')}</p>
          <div className="flex flex-wrap gap-1.5">
            {strongTopics.map(d => (
              <span key={d.topic} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-success/10 border border-success/20 text-[10px] text-success">
                <CheckCircle2 size={10} />
                {d.topic} · {d.accuracy}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risk flags */}
      {riskFlags.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('studyDiagnostic.risksTitle')}</p>
          <div className="space-y-1.5">
            {riskFlags.map((f, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-[10px] ${f.severity === 'tinggi' ? 'bg-danger/10 border border-danger/20 text-danger' : 'bg-warning/10 border border-warning/20 text-warning'}`}>
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                <span>{f.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {noDataTopics.length > 0 && (
        <p className="text-[10px] text-text-muted">
          {t('studyDiagnostic.noDataTopics', { topics: noDataTopics.join(', ') })}
        </p>
      )}
    </motion.div>
  );
}

export default function SubjectDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const subjectId = Number(id);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['subject-dashboard', subjectId],
    queryFn: () => subjectAPI.getDashboard(subjectId).then((res) => res.data),
    enabled: !!subjectId,
  });

  const { data: learningProfile } = useQuery({
    queryKey: ['learning-profile', subjectId],
    queryFn: () => examAPI.getLearningProfile(subjectId),
    enabled: !!subjectId,
  });

  const { data: studyRoute } = useQuery({
    queryKey: ['study-route', subjectId],
    queryFn: () => studyAPI.route(subjectId),
    enabled: !!subjectId,
    staleTime: 60_000,
  });

  const { data: studyMetrics } = useQuery({
    queryKey: ['study-metrics', subjectId],
    queryFn: () => studyAPI.metrics(subjectId),
    enabled: !!subjectId,
    staleTime: 60_000,
  });

  const { data: knowledgeGraph } = useQuery({
    queryKey: ['study-graph', subjectId],
    queryFn: () => studyAPI.knowledgeGraph(subjectId),
    enabled: !!subjectId,
    staleTime: 60_000,
  });

  const { data: diagnostic } = useQuery({
    queryKey: ['study-diagnostic', subjectId],
    queryFn: () => studyAPI.diagnostic(subjectId),
    enabled: !!subjectId,
    staleTime: 60_000,
  });

  const { data: studyProgress } = useQuery({
    queryKey: ['study-progress', subjectId],
    queryFn: () => studyAPI.progress(subjectId),
    enabled: !!subjectId,
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => subjectAPI.delete(subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries(['subjects']);
      navigate('/subjects');
    },
    onError: (err) => {
      console.error('Failed to delete subject:', err);
    },
  });

  const subject = data?.subject;
  const topicProgress = data?.topic_progress || [];
  const scoreHistory = data?.score_history || [];
  const recentActivity = data?.recent_activity || [];
  const activePlan = data?.active_study_plan;

  const handleDelete = () => {
    if (confirm(t('subjectDashboard.deleteConfirm'))) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-5xl mx-auto card-base p-8 space-y-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-5 bg-border rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-5xl mx-auto card-base p-8 text-center text-text-muted">{t('subjectDashboard.notFound')}</div>
      </div>
    );
  }

  const masteryPct = subject.best_score != null ? Math.min(100, Math.round((subject.best_score / 75) * 100)) : 0;
  const topicMeta = TOPIC_STATUS_META(t);
  const activityMeta = ACTIVITY_META(t);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ─── Header ─── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/subjects')} className="btn-ghost px-3 py-2 rounded-xl text-sm">
            <ArrowLeft size={16} /> {t('common.back')}
          </button>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold text-text">{subject.name}</h1>
            <p className="text-text-secondary text-sm mt-0.5">
              {[subject.semester, subject.lecturer && t('subjectDashboard.headerLecturer', { name: subject.lecturer })].filter(Boolean).join(' • ') || t('subjectDashboard.headerFallback')}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsEditOpen(true)} className="btn-ghost px-3 py-2 rounded-xl text-sm border border-border">
              <Pencil size={14} /> {t('subjectDashboard.editButton')}
            </button>
            <button onClick={handleDelete} className="btn-ghost px-3 py-2 rounded-xl text-sm text-danger border border-border">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {subject.description && (
          <p className="text-sm text-text-secondary -mt-2 italic">"{subject.description}"</p>
        )}

        {/* ─── Quick Actions ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Zap,    label: t('subjectDashboard.quickExam'),    to: '/exam-analyzer', color: 'bg-primary/10 text-primary' },
            { icon: HelpCircle, label: t('subjectDashboard.quickQuiz'),        to: '/quiz',          color: 'bg-accent-teal/10 text-accent-teal' },
            { icon: CreditCard, label: t('subjectDashboard.quickFlashcard'),   to: '/flashcard',     color: 'bg-accent-purple/10 text-accent-purple' },
            { icon: FileText, label: t('subjectDashboard.quickUpload'), to: '/materi',        color: 'bg-accent-blue/10 text-accent-blue' },
          ].map(({ icon: Icon, label, to, color }) => (
            <motion.button
              key={to}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(to)}
              className="card-base flex items-center gap-3 p-3 text-left hover:border-primary/30 transition-colors cursor-pointer"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={15} />
              </div>
              <span className="text-xs font-semibold text-text">{label}</span>
            </motion.button>
          ))}
        </div>

        {/* ─── Stats ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={FileText}   label={t('subjectDashboard.statMaterials')}    value={subject.total_materials}  color="text-accent-blue" />
          <StatCard icon={HelpCircle} label={t('subjectDashboard.statQuizzes')}      value={subject.total_quizzes}    color="text-accent-teal" />
          <StatCard icon={CreditCard} label={t('subjectDashboard.statFlashcards')}   value={subject.total_flashcards} color="text-accent-purple" />
          <StatCard icon={TrendingUp} label={t('subjectDashboard.statAvgScore')}     value={subject.avg_score}       color="text-success" suffix={subject.avg_score != null ? '/100' : ''} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Progress & Topic Breakdown (2/3) ─── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Score ring */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-5">
                <Target size={16} className="text-warning" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.masteryTitle')}</h2>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke={masteryPct >= 70 ? 'var(--success)' : masteryPct >= 40 ? 'var(--warning)' : 'var(--danger)'}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${(masteryPct / 100) * 326.7} 326.7`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-text">{subject.best_score != null ? subject.best_score : '—'}</span>
                    <span className="text-[10px] text-text-muted">{t('subjectDashboard.bestTargetLabel')}</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-text-secondary">
                    {subject.best_score == null
                      ? t('subjectDashboard.masteryNoScore')
                      : masteryPct >= 70
                        ? t('subjectDashboard.masteryGood')
                        : masteryPct >= 40
                          ? t('subjectDashboard.masteryOnTrack')
                          : t('subjectDashboard.masteryFar')}
                  </p>
                  <div className="flex items-center gap-2">
                    <CalendarCheck size={14} className="text-text-muted" />
                    <span className="text-xs text-text-muted">
                      {subject.last_activity_at ? t('subjectDashboard.lastActivity', { date: formatDate(subject.last_activity_at) }) : t('subjectDashboard.noActivity')}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Topic progress */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={16} className="text-success" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.topicProgressTitle')}</h2>
              </div>
              {topicProgress.length === 0 ? (
                <p className="text-center py-6 text-text-muted text-sm">
                  {t('subjectDashboard.topicProgressEmpty')}
                </p>
              ) : (
                <div className="space-y-4">
                  {topicProgress.map((tp) => {
                    const meta = topicMeta[tp.status] || topicMeta.berjalan;
                    return (
                      <div key={tp.topic}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-text truncate mr-2">{tp.topic}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-text-secondary">{tp.accuracy}%</span>
                            <span className={`badge text-[10px] ${meta.cls}`}>{meta.label}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden border border-border/50">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${t.accuracy}%` }}
                            transition={{ duration: 0.6 }}
                            className={`h-full rounded-full ${tp.accuracy >= 70 ? 'bg-success' : tp.accuracy >= 40 ? 'bg-warning' : 'bg-danger'}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Adaptive learning profile */}
            <LearningProfileCard profile={learningProfile} />

            {/* Konsistensi & tren mastery (PRD US5.1) */}
            <ProgressCard progress={studyProgress} />

            {/* Diagnostik belajar (PRD US4.2) */}
            <DiagnosticCard diagnostic={diagnostic} />

            {/* Peta konsep (PRD US4.1) */}
            <KnowledgeGraphCard graph={knowledgeGraph} />

            {/* Score history chart */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.scoreHistoryTitle')}</h2>
              </div>
              <ScoreChart history={scoreHistory} />
            </motion.div>
          </div>

          {/* ─── Sidebar (1/3) ─── */}
          <div className="space-y-6">
            {/* Rencana belajar hari ini — FSRS due + mastery + waktu luang (PRD US4.3) */}
            <DailyPlanCard subjectId={subjectId} />

            {/* Rekomendasi modalitas belajar (PRD US3.2) */}
            <StudyRecommendationCard route={studyRoute} subjectId={subjectId} />

            {/* Metrik belajar: speed, kelelahan, waktu optimal, FSRS (PRD US3.3) */}
            <LearningMetricsCard metrics={studyMetrics} />

            {/* Active study plan */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarCheck size={16} className="text-accent-blue" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.studyPlanTitle')}</h2>
              </div>
              {activePlan ? (
                <div>
                  <p className="text-sm font-semibold text-text mb-1">{activePlan.title}</p>
                  <p className="text-xs text-text-muted mb-3">
                    {t('subjectDashboard.planProgress', { completed: activePlan.completed_days, total: activePlan.total_days })}
                    {activePlan.start_date ? ` ${t('subjectDashboard.planStarted', { date: formatDate(activePlan.start_date) })}` : ''}
                  </p>
                  <div className="h-2 bg-background rounded-full overflow-hidden border border-border/50 mb-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${activePlan.progress}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                  <button
                    onClick={() => navigate('/exam-analyzer')}
                    className="w-full text-xs text-primary hover:text-primary/80 transition-colors text-left"
                  >
                    {t('subjectDashboard.continueLearning')}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  {t('subjectDashboard.planEmpty')}
                </p>
              )}
            </motion.div>

            {/* Recent activity */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-text-secondary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.recentActivityTitle')}</h2>
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-text-muted">{t('subjectDashboard.recentActivityEmpty')}</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((a, i) => {
                    const meta = activityMeta[a.type] || activityMeta.materi;
                    const Icon = meta.icon;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-text truncate" title={a.label}>{a.label}</p>
                          <p className="text-[10px] text-text-muted">
                            {meta.label} • {formatDate(a.date)}
                            {a.score != null && <span className="ml-1 font-semibold text-success">{a.score}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* ─── Materials table ─── */}
        <div className="card-base overflow-x-auto p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <FileText size={14} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('subjectDashboard.materialsTitle', { count: subject.total_materials })}</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {subject.materials.length === 0 ? (
                <tr>
                  <td className="text-center py-10 text-text-muted">{t('subjectDashboard.materialsEmpty')}</td>
                </tr>
              ) : (
                subject.materials.map((m, idx) => (
                  <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 text-text-muted text-xs w-8">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{fileIcon(m.material_type)}</span>
                        <span className="text-text font-medium truncate max-w-[300px]" title={m.filename}>{m.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{m.material_type}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`badge text-[10px] ${m.status === 'Ready' ? 'badge-success' : m.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">{formatDate(m.upload_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isEditOpen && (
          <EditSubjectModal
            subject={subject}
            onClose={() => setIsEditOpen(false)}
            onSuccess={() => {
              setIsEditOpen(false);
              queryClient.invalidateQueries(['subject-dashboard', subjectId]);
              queryClient.invalidateQueries(['subjects']);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
