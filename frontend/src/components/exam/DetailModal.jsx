import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, BarChart2, BookOpen, Calendar, RotateCcw, CheckCircle, XCircle,
  ChevronDown, Lightbulb, FileText, Check, Award, Clock, TrendingUp, Target,
  AlertTriangle, AlertCircle, RefreshCw, ArrowRight, ExternalLink, PenLine, X,
} from '@/icons';
import { examAPI, sessionsAPI } from '@/services/api';
import { cn } from '@/utils';
import MathMarkdown from '@/components/MathMarkdown';
import { Chip, ProgressBar, STATUS_META, getBadge, getGradeColor } from './shared';
import { Tooltip } from '@/components/ui/Tooltip';

// ─── Detail Modal ─────────────────────────────────────────────────────────────
export default function DetailModal({ historySessionId, onClose, onResume, pendingPlanTab, setPendingPlanTab }) {
   const { t } = useTranslation();
   const queryClient = useQueryClient();
  const [tab, setTab] = useState(pendingPlanTab ? 'plan' : 'overview');

  // Lifted up from StudyPlanTab so refetch() doesn't reset these states
  const [practiceMode, setPracticeMode]   = useState(null); // null | { itemId, topic, questions, _v }
  const [practiceError, setPracticeError] = useState('');
  const [loadingItemId, setLoadingItemId] = useState(null);

  useEffect(() => {
    if (pendingPlanTab && tab === 'plan') setPendingPlanTab(false);
  }, [tab]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['exam-history-detail', historySessionId],
    queryFn:  () => sessionsAPI.detail(historySessionId).then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (itemId) => sessionsAPI.togglePlanItem(itemId),
    // Skip refetch while practice is active — refetch would rebuild plan prop
    // and cause InlinePractice to flicker. We refetch when practice closes instead.
    onSuccess: () => {
      if (!practiceMode) {
        refetch();
        queryClient.invalidateQueries(['exam-sessions']);
      }
    },
  });

  if (isLoading) {
    return (
      <ModalShell>
        <div className="flex-1 flex items-center justify-center p-20">
          <Loader2 size={36} className="animate-spin text-primary" />
        </div>
      </ModalShell>
    );
  }
  if (!data) return null;

  const latestAttempt = data.attempts?.[data.attempts.length - 1];
  const meta  = STATUS_META[data.status] || STATUS_META.completed;
  const badge = getBadge(data.best_score || 0);

  return (
    <ModalShell>
      <div className="p-5 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
               <Chip label={data.exam_type?.toUpperCase() || t('exam.history.defaultExamType')} size="xs" color="blue" />
              <Chip label={meta.label} size="xs" color={meta.color} />
              <Chip label={badge.label} size="xs" color={badge.color} />
            </div>
            <h2 className="text-lg font-bold text-text">{data.title}</h2>
            <p className="text-sm text-text-muted">{data.subject_name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={cn('text-4xl font-black', getGradeColor(data.grade))}>{data.best_score ?? '--'}</p>
            <p className={cn('text-sm font-bold', getGradeColor(data.grade))}>Grade {data.grade || '?'}</p>
          </div>
        </div>

        <div className="flex gap-1 mt-4">
          {[
            { id:'overview', label:t('exam.detail.overview'),  icon: BarChart2 },
            { id:'review',   label:t('exam.detail.review'),     icon: BookOpen  },
            { id:'plan',     label:t('exam.detail.studyPlan'),   icon: Calendar  },
            { id:'attempts', label:t('exam.detail.attempts'),    icon: RotateCcw },
          ].map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} onClick={() => setTab(id)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                tab === id ? 'bg-primary text-white' : 'bg-card text-text-secondary hover:text-text border border-border')}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'overview'  && <OverviewTab data={data} />}
        {tab === 'review'    && <ReviewTab attempt={latestAttempt} />}
        {tab === 'plan'      && <StudyPlanTab
          plan={data.study_plan}
          sessionId={historySessionId}
          onToggle={(id) => toggleMutation.mutate(id)}
          onPlanSaved={() => refetch()}
          practiceMode={practiceMode}
          setPracticeMode={setPracticeMode}
          practiceError={practiceError}
          setPracticeError={setPracticeError}
          loadingItemId={loadingItemId}
          setLoadingItemId={setLoadingItemId}
          onPracticeClose={() => {
            // Refetch plan data now that practice is closed
            refetch();
            queryClient.invalidateQueries(['exam-sessions']);
          }}
        />}
        {tab === 'attempts'  && <AttemptsTab attempts={data.attempts || []} />}
      </div>

      <div className="p-4 border-t border-border shrink-0 flex gap-2 flex-wrap">
        <RetryButton historySessionId={historySessionId} sessionData={data} onClose={onClose} onResume={onResume} />
         <button type="button" onClick={onClose} className="btn-ghost text-sm border border-border ml-auto">
           {t('common.close')}
         </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl max-h-[90vh] flex flex-col card-base shadow-2xl overflow-hidden"
      >
        {children}
      </motion.div>
    </div>
  );
}

function OverviewTab({ data }) {
   const { t } = useTranslation();
   const attempts = data.attempts || [];
   const hasGrowth = attempts.length >= 2;

   return (
     <div className="space-y-4">
       <div className="card-base p-4">
         <div className="flex justify-between mb-2">
           <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{t('exam.detail.overallProgress')}</span>
          <span className="text-xs font-bold text-text">{data.progress || 0}%</span>
        </div>
        <ProgressBar value={data.progress || 0}
          color={data.status === 'mastered' ? 'success' : (data.progress||0) >= 70 ? 'primary' : 'warning'} />
        {data.overall_feedback && (
          <p className="text-xs text-text-secondary mt-2">{data.overall_feedback}</p>
        )}
      </div>

      {hasGrowth && (
        <div className="card-base p-4">
           <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">{t('exam.detail.gradeProgression')}</p>
          <div className="flex items-end gap-3 h-16">
            {attempts.map((a, i) => {
              const h = Math.max(8, ((a.score||0)/100)*64);
              return (
                <div key={a.id} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[10px] font-bold text-text">{a.score}</span>
                  <div className="w-full rounded-t-md bg-primary/20 relative overflow-hidden"
                    style={{ height: `${h}px` }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-md"
                      style={{ height: `${h}px` }} />
                  </div>
                  <span className="text-[9px] text-text-muted">#{i+1}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-success mt-2 flex items-center gap-1">
            <TrendingUp size={11} />
            Peningkatan: +{(attempts[attempts.length-1].score||0) - (attempts[0].score||0)} poin
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(data.strong_topics || []).length > 0 && (
          <div className="p-3 rounded-xl bg-success/5 border border-success/15">
             <p className="text-xs font-semibold text-success mb-2 flex items-center gap-1">
               <TrendingUp size={11} /> {t('exam.detail.strongTopics')}
             </p>
            {(data.strong_topics || []).slice(0,5).map((topic,i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-success/10 last:border-0">
                <span className="text-xs text-text">{typeof topic === 'string' ? topic : topic.topic || ''}</span>
                {topic.mastery && <Chip label={topic.mastery} size="xs" color="success" />}
              </div>
            ))}
          </div>
        )}
        {(data.weak_topics || []).length > 0 && (
          <div className="p-3 rounded-xl bg-danger/5 border border-danger/15">
             <p className="text-xs font-semibold text-danger mb-2 flex items-center gap-1">
               <AlertTriangle size={11} /> {t('exam.detail.weakTopics')}
             </p>
            {(data.weak_topics || []).slice(0,5).map((topic,i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-danger/10 last:border-0">
                <span className="text-xs text-text">{typeof topic === 'string' ? topic : topic.topic || ''}</span>
                {topic.priority && <Chip label={topic.priority} size="xs"
                  color={topic.priority==='Tinggi'?'danger':topic.priority==='Menengah'?'warning':'teal'} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewTab({ attempt }) {
  const { t } = useTranslation();
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [explanations, setExplanations] = useState({});
  const reviews = attempt?.reviews || [];

  if (!attempt) return <p className="text-text-muted text-sm py-8 text-center">{t('exam.detail.noReviewData')}</p>;
  if (reviews.length === 0) return <p className="text-text-muted text-sm py-8 text-center">{t('exam.detail.noReviewForAttempt')}</p>;

  const correct = reviews.filter(r => r.is_correct).length;
  const total   = reviews.length;

  const fetchExplanation = async (r, i) => {
    if (explanations[i]?.text) return;
    setExplanations(prev => ({ ...prev, [i]: { loading: true, text: '', error: '' } }));
    try {
      const res = await examAPI.getExplanation({
        question:      r.question_text,
        correct_answer: r.correct_answer || '',
        topic:         r.topic || '',
      });
      const text = res.data?.explanation || 'Penjelasan tidak tersedia.';
      setExplanations(prev => ({ ...prev, [i]: { loading: false, text, error: '' } }));
    } catch {
      setExplanations(prev => ({ ...prev, [i]: { loading: false, text: '', error: 'Gagal memuat penjelasan.' } }));
    }
  };

  return (
    <div className="space-y-3">
       <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border text-sm">
         <CheckCircle size={14} className="text-success" />
         <span className="text-text">{correct}/{total} {t('exam.detail.correct')}</span>
         <span className="text-text-muted">·</span>
         <span className="text-text-muted">{t('exam.detail.attemptLabel')} #{attempt.attempt_number}</span>
       </div>

      {reviews.map((r, i) => {
        const expl = explanations[i];
        return (
          <div key={r.id || i}
            className={cn('rounded-xl border overflow-hidden',
              r.is_correct ? 'border-success/25' : 'border-danger/25')}>
            <button type="button" onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-background/40 transition-colors">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                r.is_correct ? 'bg-success' : 'bg-danger')}>
                {r.is_correct ? <CheckCircle size={13} className="text-white" /> : <XCircle size={13} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-text-muted mb-0.5">{r.topic} · {r.question_type} · {r.difficulty}</p>
                <div className="text-sm text-text line-clamp-2">
                  <MathMarkdown>{r.question_text}</MathMarkdown>
                </div>
              </div>
              <ChevronDown size={13} className={cn('text-text-muted shrink-0 transition-transform', expandedIdx === i && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {expandedIdx === i && (
                <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
                  transition={{ duration:0.2 }} className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-2 border-t border-border/40 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="p-2 rounded-lg bg-background">
                         <p className="text-[10px] text-text-muted mb-0.5">{t('exam.detail.yourAnswer')}</p>
                        <div className={cn('font-medium text-sm', r.is_correct ? 'text-success' : 'text-danger')}>
                          <MathMarkdown>{r.user_answer || '(Tidak dijawab)'}</MathMarkdown>
                        </div>
                      </div>
                      {!r.is_correct && (
                        <div className="p-2 rounded-lg bg-success/5 border border-success/15">
                           <p className="text-[10px] text-text-muted mb-0.5">{t('exam.detail.correctAnswer')}</p>
                          <div className="font-medium text-sm text-success">
                            <MathMarkdown>{r.correct_answer}</MathMarkdown>
                          </div>
                        </div>
                      )}
                    </div>

                    {r.ai_explanation && !expl?.text && (
                      <div className="p-2 rounded-lg bg-primary/5 border border-primary/15 text-xs text-text">
                         <p className="font-semibold text-primary mb-0.5">{t('exam.detail.aiExplanation')}</p>
                         <MathMarkdown>{r.ai_explanation}</MathMarkdown>
                       </div>
                     )}

                     {expl?.text && (
                       <div className="p-2 rounded-lg bg-accent-teal/5 border border-accent-teal/20 text-xs text-text">
                         <p className="font-semibold text-accent-teal mb-0.5 flex items-center gap-1">
                           <Lightbulb size={10} /> {t('exam.detail.aiExplanation')}
                        </p>
                        <MathMarkdown>{expl.text}</MathMarkdown>
                      </div>
                    )}
                       {expl?.error && <p className="text-[10px] text-danger">{t('exam.detail.explanationError')}</p>}

                    <div className="flex items-center gap-3 text-[10px] text-text-muted flex-wrap">
                      {r.material_ref && <span className="flex items-center gap-1"><FileText size={10}/>{r.material_ref}</span>}
                      {r.tips && <span className="flex items-center gap-1 text-primary"><Lightbulb size={10}/>{r.tips}</span>}
                      {!r.ai_explanation && !expl?.text && (
                        <button
                          type="button"
                          onClick={() => fetchExplanation(r, i)}
                          disabled={expl?.loading}
                          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent-teal/10 text-accent-teal border border-accent-teal/20 hover:bg-accent-teal/20 transition-colors disabled:opacity-50"
                        >
                           {expl?.loading
                             ? <><Loader2 size={10} className="animate-spin" /> {t('common.loading')}</>
                             : <><Lightbulb size={10} /> {t('exam.detail.explainBtn')}</>}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function InlinePractice({ questions, topic, onComplete, onClose, onRetryTopic }) {
  const { t } = useTranslation();
  const [idx, setIdx]             = useState(0);
  const [answers, setAnswers]     = useState({});
  const [results, setResults]     = useState({});
  const [explanations, setExplanations] = useState({});
  const [showExpl, setShowExpl]   = useState(false);
  const [fetchingExpl, setFetchingExpl] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [retryingTopic, setRetryingTopic] = useState(null); // topik yang sedang di-retry

  const q = questions[idx];
  const total = questions.length;
  const isLast = idx === total - 1;
  const userAnswer = answers[String(q.id)] || '';
  const isObjective = ['mcq', 'truefalse'].includes(q.type);

  const selectAnswer = (val) => {
    if (showExpl) return;
    setAnswers(p => ({ ...p, [String(q.id)]: val }));
  };

  const handleJawab = async () => {
    if (!userAnswer) return;
    const isCorrect = userAnswer === q.answer;
    setResults(p => ({ ...p, [String(q.id)]: isCorrect }));
    setShowExpl(true);
    setFetchingExpl(true);
    try {
      const r = await examAPI.getExplanation({
        bank_id: q.bank_id || null,
        question: q.question,
        correct_answer: q.answer || '',
        topic: q.topic || '',
      });
       const text = r.data?.explanation || t('exam.detail.explanationUnavailable');
       setExplanations(p => ({ ...p, [String(q.id)]: text }));
     } catch {
       setExplanations(p => ({ ...p, [String(q.id)]: t('exam.detail.explanationUnavailable') }));
    } finally { setFetchingExpl(false); }
  };

  const handleNext = () => {
    if (isLast) {
      setShowSummary(true);
    } else {
      setIdx(i => i + 1);
      setShowExpl(false);
    }
  };

  const correctCount = Object.values(results).filter(Boolean).length;
  const wrongCount   = total - correctCount;
  const score        = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  // Group wrong answers by topic for recommendations
  const wrongByTopic = {};
  questions.forEach((question) => {
    const qid = String(question.id);
    if (results[qid] === false) {
      const t = question.topic || 'Umum';
      if (!wrongByTopic[t]) wrongByTopic[t] = { count: 0, tips: question.tips || '', material: question.material_reference || '' };
      wrongByTopic[t].count++;
      if (!wrongByTopic[t].tips && question.tips) wrongByTopic[t].tips = question.tips;
      if (!wrongByTopic[t].material && question.material_reference) wrongByTopic[t].material = question.material_reference;
    }
  });
  const weakTopics = Object.entries(wrongByTopic).sort((a, b) => b[1].count - a[1].count);

  // ── Summary View ──
  if (showSummary) {
    return (
      <div className="mt-2 p-4 rounded-xl bg-background border border-primary/20 space-y-4">
        {/* Score hero */}
        <div className="text-center">
          <p className="text-3xl font-black text-text">{score}%</p>
          <p className={cn('text-sm font-semibold', score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-danger')}>
            {correctCount} dari {total} soal benar
          </p>
        </div>

        {/* Breakdown per soal */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{t('exam.detail.answerDetail')}</p>
          {questions.map((question, i) => {
            const qid = String(question.id);
            const isCorrect = results[qid];
            return (
              <div key={qid} className="flex items-center gap-2 text-xs py-1">
                {isCorrect
                  ? <CheckCircle size={11} className="text-success shrink-0" />
                  : <XCircle size={11} className="text-danger shrink-0" />}
                 <span className="text-text-muted">{t('exam.detail.question')} {i + 1}</span>
                <span className="text-text-secondary truncate flex-1">{question.topic}</span>
                 {!isCorrect && <span className="text-danger text-[10px]">{t('exam.detail.answer')}: {question.answer}</span>}
              </div>
            );
          })}
        </div>

        {/* Recommendations — satu baris per topik lemah dengan tombol latih individual */}
        {weakTopics.length > 0 && (
          <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 space-y-2">
             <p className="text-xs font-semibold text-text-secondary flex items-center gap-1">
               <Target size={11} /> {t('exam.detail.learningRecommendation')}
             </p>
            {weakTopics.map(([weakTopic, data]) => (
              <div key={weakTopic} className="text-xs text-text-secondary space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text truncate">• "{weakTopic}" — {data.count} soal salah</p>
                    {data.tips && <p className="ml-3 text-primary/80 flex items-center gap-1"><Lightbulb size={9} /> {data.tips}</p>}
                    {data.material && <p className="ml-3 text-text-muted flex items-center gap-1"><BookOpen size={10} className="shrink-0" /> {data.material}</p>}
                  </div>
                  {onRetryTopic && (
                    <button
                      type="button"
                      disabled={retryingTopic !== null}
                      onClick={async () => {
                        if (retryingTopic !== null) return;
                        setRetryingTopic(weakTopic);
                        try {
                          await onRetryTopic(weakTopic);
                        } finally {
                          setRetryingTopic(null);
                        }
                      }}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-primary text-white text-[10px] font-bold hover:brightness-110 transition-all disabled:opacity-40"
                    >
                      {retryingTopic === weakTopic
                        ? <><Loader2 size={9} className="animate-spin" /> Memuat...</>
                        : <><RefreshCw size={9} /> Latih</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 flex-wrap">
          {score >= 100 ? (
            <button onClick={() => onComplete && onComplete()} type="button" className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1">
              <Check size={12} /> Selesai
            </button>
          ) : (
            <button type="button" onClick={onClose} className="btn-ghost text-xs border border-border px-4 py-1.5">
              Tutup
            </button>
          )}
          {/* Ulangi topik ini — re-fetch soal untuk topik yang sama */}
          {topic && onRetryTopic && (
            <button
              type="button"
              disabled={retryingTopic !== null}
              onClick={async () => {
                if (retryingTopic !== null) return;
                setRetryingTopic(topic);
                try {
                  await onRetryTopic(topic);
                } finally {
                  setRetryingTopic(null);
                }
              }}
              className="btn-ghost text-xs border border-warning/40 text-warning px-4 py-1.5 flex items-center gap-1 disabled:opacity-40"
            >
              {retryingTopic === topic
                ? <><Loader2 size={11} className="animate-spin" /> Memuat...</>
                : <><RotateCcw size={11} /> Ulangi Topik Ini</>}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Quiz View ──
  return (
    <div className="mt-2 p-3 rounded-xl bg-background border border-primary/20 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text">Soal {idx + 1}/{total}</span>
          <Chip label={q.type} size="xs" color="blue" />
          {q.bloom_level && <Chip label={q.bloom_level.toLowerCase()} size="xs" color="purple" />}
          {q.difficulty && <Chip label={q.difficulty} size="xs" color={q.difficulty === 'sulit' ? 'danger' : q.difficulty === 'menengah' ? 'warning' : 'success'} />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-success">{correctCount}✓</span>
          <span className="text-[10px] text-danger">{wrongCount}✗</span>
          <button type="button" onClick={onClose} className="text-[10px] text-text-muted hover:text-text">Tutup</button>
        </div>
      </div>

      {/* Question */}
      <div className="text-sm text-text">
        <MathMarkdown>{q.question}</MathMarkdown>
      </div>

      {/* Options */}
      {isObjective ? (
        <div className="space-y-1.5">
          {(q.options_list || Object.entries(q.options || {}).map(([k, v]) => `${k}. ${v}`)).map((opt, i) => {
            const key = Object.keys(q.options || {})[i] || opt;
            const sel = userAnswer === key || userAnswer === opt;
            const isCorrectOpt = key === q.answer || opt.startsWith(q.answer + '.');
            return (
              <button type="button" key={i} onClick={() => selectAnswer(key)} disabled={showExpl}
                className={cn('w-full text-left p-2.5 rounded-lg border text-xs transition-all',
                  showExpl && isCorrectOpt ? 'bg-success/10 border-success/30 text-success' :
                  showExpl && sel && !isCorrectOpt ? 'bg-danger/10 border-danger/30 text-danger' :
                  sel ? 'bg-primary/10 border-primary text-primary' :
                  'bg-card border-border text-text hover:border-primary/40',
                  showExpl && 'cursor-default')}>
                <MathMarkdown>{opt}</MathMarkdown>
              </button>
            );
          })}
        </div>
      ) : (
        <textarea rows={3} value={userAnswer} onChange={e => selectAnswer(e.target.value)} disabled={showExpl}
          placeholder="Tulis jawaban di sini..."
          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary resize-none disabled:opacity-50" />
      )}

      {/* Jawab button */}
      {!showExpl && (
        <button type="button" onClick={handleJawab} disabled={!userAnswer}
          className="btn-primary text-xs px-4 py-1.5 disabled:opacity-40">
          Jawab
        </button>
      )}

      {/* Enhanced Explanation */}
      {showExpl && (
        <div className={cn('p-3 rounded-lg border text-xs space-y-2',
          results[String(q.id)] ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20')}>
          {/* User answer vs correct */}
          <div className="space-y-1">
            {!results[String(q.id)] && (
              <p className="text-danger flex items-center gap-1.5">
                <XCircle size={11} className="shrink-0" />
                <span>Jawaban kamu: <strong>{userAnswer}</strong>{q.options?.[userAnswer] ? `. ${q.options[userAnswer]}` : ''}</span>
              </p>
            )}
            <p className="text-success flex items-center gap-1.5">
              <CheckCircle size={11} className="shrink-0" />
              <span>Jawaban benar: <strong>{q.answer}</strong>{q.options?.[q.answer] ? `. ${q.options[q.answer]}` : ''}</span>
            </p>
          </div>

          {/* Explanation */}
          <div className="border-t border-border/50 pt-2">
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1 flex items-center gap-1"><PenLine size={10} /> Penjelasan</p>
            {fetchingExpl ? (
              <p className="text-text-muted flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Memuat penjelasan...</p>
            ) : explanations[String(q.id)] ? (
              <p className="text-text-secondary leading-relaxed">{explanations[String(q.id)]}</p>
            ) : (
              <p className="text-text-muted italic">Penjelasan tidak tersedia.</p>
            )}
          </div>

          {/* Tips */}
          {q.tips && (
            <div className="border-t border-border/50 pt-2">
              <p className="text-primary/80 flex items-start gap-1.5">
                <Lightbulb size={10} className="shrink-0 mt-0.5" />
                <span>{q.tips}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Next / Selesai */}
      {showExpl && (
        <button type="button" onClick={handleNext}
          className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1">
          {isLast ? <><Check size={12} /> Lihat Hasil</> : <><ArrowRight size={12} /> Soal Berikutnya</>}
        </button>
      )}
    </div>
  );
}

function StudyPlanTab({ plan, sessionId, onToggle, onPlanSaved,
  practiceMode, setPracticeMode,
  practiceError, setPracticeError,
  loadingItemId, setLoadingItemId,
  onPracticeClose,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(plan?.start_date || today);
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState('');

  // Sync startDate when plan prop refreshes from outside
  useEffect(() => {
    if (plan?.start_date) setStartDate(plan.start_date);
  }, [plan?.start_date]);

  const DAYS_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  function formatItemDate(startDateStr, orderNumber) {
    const d = new Date(startDateStr);
    d.setDate(d.getDate() + orderNumber);
    return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
  }

  async function handleDateChange(newDate) {
    const prevDate = startDate;
    setStartDate(newDate);
    setDateSaving(true); setDateError('');
    try {
      const planPayload = {
        title: plan.title,
        motivational_message: plan.motivational_message,
        priority_actions: plan.priority_actions,
        start_date: newDate,
        study_plan: (plan.items || []).map(item => ({
          label: item.day_label,
          topic: item.topic,
          activity: item.activity,
          type: item.activity_type,
          duration_minutes: item.duration_minutes,
          resources: item.resources,
        })),
      };
      await sessionsAPI.saveStudyPlan(sessionId, planPayload);
      onPlanSaved?.();
    } catch {
      setStartDate(prevDate);
      setDateError('Gagal menyimpan tanggal. Coba lagi.');
    } finally { setDateSaving(false); }
  }

  if (!plan) return (
    <p className="text-text-muted text-sm py-8 text-center">
      Belum ada rencana belajar tersimpan untuk sesi ini.
    </p>
  );

  const typeColor = { review:'blue', practice:'purple', simulation:'warning', rest:'success' };

  const completedItems = (plan.items || []).filter(i => i.completed).length;
  const totalItems     = (plan.items || []).length;
  const progressValue  = totalItems > 0
    ? Math.round((completedItems / totalItems) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Date picker + open full plan */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={14} className="text-primary" />
        <span className="text-xs font-semibold text-text-secondary">Mulai Belajar:</span>
        <input
          type="date"
          value={startDate}
          onChange={e => handleDateChange(e.target.value)}
          disabled={dateSaving}
          className="px-2 py-1 bg-card border border-border rounded-lg text-xs text-text
                     focus:outline-none focus:border-primary disabled:opacity-50"
        />
        {dateSaving && <Loader2 size={12} className="animate-spin text-primary" />}
        <button
          onClick={() => navigate(`/study-plan?session_id=${sessionId}`)}
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary/30 text-primary text-[11px] font-semibold hover:bg-primary/10 transition-colors"
        >
          <ExternalLink size={11} /> Buka Halaman Penuh
        </button>
      </div>
      {dateError && <p className="text-danger text-xs mb-2">{dateError}</p>}

      {practiceError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/5 border border-danger/20 text-xs text-danger">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span className="flex-1">{practiceError}</span>
          <Tooltip label={t('common.close')}>
            <button type="button" onClick={() => setPracticeError('')} aria-label={t('common.close')} className="shrink-0 text-danger/60 hover:text-danger"><X size={12} /></button>
          </Tooltip>
        </div>
      )}

      {plan.motivational_message && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 flex items-start gap-2">
          <Award size={14} className="text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-text">{plan.motivational_message}</p>
        </div>
      )}

      {/* Dynamic progress bar */}
      <div className="flex justify-between text-xs text-text-muted mb-1">
        <span>Progress Rencana Belajar</span>
        <span>
          {progressValue >= 100
            ? <span className="flex items-center gap-1"><Award size={12} className="text-success" /> Rencana Selesai!</span>
            : `${completedItems}/${totalItems} hari · ${progressValue}%`}
        </span>
      </div>
      <ProgressBar value={progressValue} color={progressValue >= 100 ? 'success' : 'primary'} />

      {(plan.priority_actions || []).length > 0 && (
        <div className="p-3 rounded-xl bg-card border border-border">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Aksi Prioritas</p>
          {(plan.priority_actions || []).map((a, i) => (
            <p key={i} className="text-xs text-text flex items-start gap-1.5 py-1">
              <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i+1}</span>
              {a}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {(plan.items || []).map((item) => {
          const dateLabel = formatItemDate(startDate, item.order_number);
          const inPractice = practiceMode && practiceMode.itemId === item.id;
          return (
            <div key={item.id}
              className={cn('rounded-xl border transition-all overflow-hidden',
                inPractice ? 'border-primary/30 bg-primary/5' :
                item.completed ? 'bg-success/5 border-success/20 opacity-70' : 'bg-card border-border')}>
              <div className={cn('flex items-start gap-3 p-3', inPractice && 'border-b border-primary/10')}>
                <button type="button" onClick={() => onToggle(item.id)}
                  className={cn('w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                    item.completed ? 'bg-success border-success text-white' : 'border-border hover:border-primary')}>
                  {item.completed && <Check size={11} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-text-muted">{dateLabel}</span>
                    {item.time_slot && (
                      <span className="text-[10px] text-text-muted">{item.time_slot}</span>
                    )}
                    <Chip label={item.activity_type || 'review'} size="xs"
                      color={typeColor[item.activity_type] || 'blue'} />
                    {item.duration_minutes && (
                      <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                        <Clock size={9} />{item.duration_minutes}m
                      </span>
                    )}
                  </div>
                  <p className={cn("text-sm font-medium text-text", item.completed && "line-through")}>
                    {item.topic}
                  </p>
                  {item.activity && <p className="text-xs text-text-secondary">{item.activity}</p>}
                  {item.resources && !inPractice && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-primary flex items-center gap-0.5">
                        <Lightbulb size={9}/>{item.resources}
                      </p>
                      {item.resources.includes('soal latihan') && !item.completed && (
                        <button
                          type="button"
                          disabled={loadingItemId === item.id}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPracticeError('');
                            setLoadingItemId(item.id);
                            try {
                              const r = await sessionsAPI.fetchPracticeQuestions(sessionId, item.topic);
                              if (r.data?.detail) throw new Error(r.data.detail);
                              if (!r.data?.questions?.length) throw new Error('Tidak ada soal tersedia untuk topik ini.');
                              setPracticeMode({ itemId: item.id, topic: item.topic, questions: r.data.questions, _v: Date.now() });
                            } catch (err) {
                              setPracticeError(err.message || 'Gagal memuat soal latihan.');
                            } finally {
                              setLoadingItemId(null);
                            }
                          }}
                          className="text-[10px] px-2 py-1 rounded bg-gradient-primary text-white font-bold
                                     hover:brightness-110 transition-all shrink-0 shadow-sm disabled:opacity-50 flex items-center gap-1">
                          {loadingItemId === item.id
                            ? <><Loader2 size={9} className="animate-spin" /> Memuat...</>
                            : 'Mulai Latihan →'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {!inPractice && !item.completed && (
                  <button type="button" onClick={() => onToggle(item.id)}
                    className="text-[10px] px-2 py-0.5 rounded border border-border text-text-muted
                               hover:border-warning/40 hover:text-warning transition-colors shrink-0">
                    Lewati
                  </button>
                )}
              </div>

              {/* Inline Practice */}
              {inPractice && (
                <InlinePractice
                  key={`${practiceMode.topic}-${practiceMode._v || 'practice'}`}
                  questions={practiceMode.questions}
                  topic={practiceMode.topic}
                  onComplete={() => {
                    onToggle(item.id);
                    setPracticeMode(null);
                    onPracticeClose?.();
                  }}
                  onClose={() => {
                    setPracticeMode(null);
                    onPracticeClose?.();
                  }}
                  onRetryTopic={async (topic) => {
                    try {
                      const r = await sessionsAPI.fetchPracticeQuestions(sessionId, topic);
                      if (r.data?.detail) throw new Error(r.data.detail);
                      if (!r.data?.questions?.length) throw new Error('Tidak ada soal tersedia untuk topik ini.');
                      setPracticeMode({ itemId: item.id, topic, questions: r.data.questions, _v: Date.now() });
                    } catch (err) {
                      setPracticeError(err.message || 'Gagal memuat soal.');
                    }
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttemptsTab({ attempts }) {
  if (!attempts.length) return <p className="text-text-muted text-sm py-8 text-center">Belum ada attempt.</p>;

  return (
    <div className="space-y-3">
      {attempts.map((a, i) => {
        const gradeC = getGradeColor(a.grade);
        const isLatest = i === attempts.length - 1;
        const prevScore = i > 0 ? (attempts[i-1].score || 0) : null;
        const delta = prevScore !== null ? (a.score || 0) - prevScore : null;
        return (
          <div key={a.id}
            className={cn('p-4 rounded-xl border flex items-center gap-4',
              isLatest ? 'border-primary/30 bg-primary/5' : 'border-border bg-card')}>
            <div className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
              #{a.attempt_number}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-2xl font-black', gradeC)}>{a.score ?? '--'}</span>
                <span className={cn('text-sm font-bold', gradeC)}>Grade {a.grade || '?'}</span>
                {isLatest && <Chip label="Terbaru" size="xs" color="primary" />}
                {delta !== null && (
                  <span className={cn('text-xs font-semibold flex items-center gap-0.5',
                    delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-text-muted')}>
                    {delta > 0 ? <TrendingUp size={10}/> : delta < 0 ? '↓' : '='}
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
              <div className="flex gap-3 text-xs text-text-muted">
                <span className="flex items-center gap-1"><CheckCircle size={10} className="text-success"/>{a.total_correct} benar</span>
                <span className="flex items-center gap-1"><XCircle size={10} className="text-danger"/>{a.total_wrong} salah</span>
                {a.duration_seconds && (
                  <span className="flex items-center gap-1"><Clock size={10}/>
                    {Math.floor(a.duration_seconds/60)}:{String(a.duration_seconds%60).padStart(2,'0')}
                  </span>
                )}
                <span>{a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID') : '--'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RetryButton({ historySessionId, sessionData, onClose, onResume }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [selectedQType, setSelectedQType] = useState(sessionData.question_type || 'mixed');

  const handleRetry = async () => {
    setError(''); setLoading(true);
    try {
      // Pass question_type — if different from session, backend creates new session row
      const payload = selectedQType !== sessionData.question_type ? { question_type: selectedQType } : {};
      const r = await sessionsAPI.retryInplace(historySessionId, payload);
      if (r.data?.detail) throw new Error(r.data.detail);
      if (!r.data?.session_id) throw new Error('Sesi latihan gagal disiapkan.');
      onClose();
      onResume({ ...r.data, subject_id: sessionData.subject_id, subject_name: sessionData.subject_name });
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Gagal memulai latihan ulang.');
    } finally { setLoading(false); }
  };

  const isDifferentType = selectedQType !== (sessionData.question_type || 'mixed');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={selectedQType}
          onChange={e => setSelectedQType(e.target.value)}
          disabled={loading}
          className="px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary disabled:opacity-50"
        >
          <option value="mixed">Campuran</option>
          <option value="mcq">Pilihan Ganda</option>
          <option value="truefalse">Benar / Salah</option>
          <option value="short_answer">Isian Singkat</option>
          <option value="essay">Essay</option>
          <option value="case_study">Studi Kasus</option>
          <option value="analysis">Analisis</option>
          <option value="calculation">Perhitungan</option>
        </select>
        <button type="button" onClick={handleRetry} disabled={loading} className="btn-primary text-sm flex items-center gap-1.5">
          {loading
            ? <><Loader2 size={13} className="animate-spin"/> Menyiapkan...</>
            : <><RotateCcw size={13}/> {isDifferentType ? 'Buat Baru' : 'Latihan Lagi'}</>}
        </button>
      </div>
      {isDifferentType && !error && (
        <p className="text-xs text-warning flex items-center gap-1">
          <AlertCircle size={11}/> Jenis soal berbeda — akan membuat history baru
        </p>
      )}
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
