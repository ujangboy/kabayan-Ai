import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Play, Pause, ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react';
import { examAPI } from '@/services/api';
import { cn } from '@/utils';
import MathMarkdown from '@/components/MathMarkdown';
import { Chip } from './shared';

export default function QuizView({ sessionData, onDone }) {
  const { t } = useTranslation();
  const questions = sessionData?.questions || [];
  const totalQ    = questions.length;
  const duration  = sessionData?.duration_minutes;

  const [idx, setIdx]         = useState(0);
  const [answers, setAnswers] = useState({});
  const [paused, setPaused]   = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration ? duration * 60 : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]     = useState('');

  // Timer
  useEffect(() => {
    if (timeLeft === null || paused) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const timer = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, paused]);

  const formatTime = (s) => {
    if (s === null) return '∞';
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const q = questions[idx];
  const progress = Math.round(((idx + 1) / totalQ) * 100);

  const selectAnswer = (val) => setAnswers(p => ({ ...p, [String(q.id)]: val }));

  const handleSubmit = async () => {
    setError(''); setIsSubmitting(true);
    try {
      const r = await examAPI.submit(sessionData.session_id, answers);
      if (r.data?.detail) throw new Error(r.data.detail);
      const evalResult = r.data;

      onDone(evalResult, answers);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || t('exam.quiz.submitFailed'));
      setIsSubmitting(false);
    }
  };

  if (!q) return null;

  const isObjectiveQ = ['mcq','truefalse'].includes(q.type);
  const userAnswer   = answers[String(q.id)] || '';
  const answered     = Object.keys(answers).length;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="card-base p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">{t('exam.quiz.questionCounter', { current: idx+1, total: totalQ })}</span>
            <span className="text-xs text-text-muted">{t('exam.quiz.answeredCount', { count: answered })}</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {timeLeft !== null && (
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-bold border',
            timeLeft < 60 ? 'text-danger border-danger/30 bg-danger/10 animate-pulse' : 'text-text border-border bg-card')}>
            <Clock size={13} />{formatTime(timeLeft)}
          </div>
        )}

        <button onClick={() => setPaused(p => !p)}
          className="p-2 rounded-lg border border-border bg-card text-text-secondary hover:text-text transition-colors">
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>

      {/* Pause overlay */}
      {paused && (
        <div className="card-base p-16 text-center">
          <Pause size={48} className="mx-auto mb-4 text-text-muted opacity-40" />
          <h3 className="text-lg font-semibold text-text mb-2">{t('exam.quiz.pausedTitle')}</h3>
          <button onClick={() => setPaused(false)} className="btn-primary mt-4">
            <Play size={14} /> {t('exam.quiz.resume')}
          </button>
        </div>
      )}

      {/* Question card */}
      {!paused && (
        <div className="card-base p-6 space-y-5">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
              {idx+1}
            </span>
            <div className="flex-1">
              <div className="flex gap-2 flex-wrap mb-3">
                <Chip label={q.type}        size="xs" color="blue" />
                <Chip label={q.bloom_level} size="xs" color="teal" />
                <Chip label={q.difficulty}  size="xs"
                  color={q.difficulty === 'sulit' ? 'danger' : q.difficulty === 'menengah' ? 'warning' : 'success'} />
              </div>
              <MathMarkdown className="font-medium">{q.question}</MathMarkdown>
            </div>
          </div>

          {/* Options — objective */}
          {isObjectiveQ && (
            <div className="space-y-2">
              {(q.options_list || Object.entries(q.options || {}).map(([k,v]) => `${k}. ${v}`)).map((opt, i) => {
                const key = Object.keys(q.options || {})[i] || opt;
                const sel = userAnswer === key || userAnswer === opt;
                return (
                  <button key={i} onClick={() => selectAnswer(key)}
                    className={cn('w-full text-left p-3.5 rounded-xl border text-sm transition-all',
                      sel ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-card border-border text-text hover:border-primary/40')}>
                    <MathMarkdown>{opt}</MathMarkdown>
                  </button>
                );
              })}
            </div>
          )}

          {/* Text answer — subjective */}
          {!isObjectiveQ && (
            <textarea
              rows={5}
              value={userAnswer}
              onChange={e => selectAnswer(e.target.value)}
              placeholder={t('exam.quiz.answerPlaceholder', { type: q.type === 'calculation' ? 'perhitungan' : q.type === 'essay' ? 'esai' : 'kamu' })}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text focus:outline-none focus:border-primary resize-none"
            />
          )}
        </div>
      )}

      {error && <p className="text-danger text-sm">{error}</p>}

      {/* Navigation */}
      {!paused && (
        <div className="flex items-center justify-between">
          <button onClick={() => setIdx(p => Math.max(0, p-1))} disabled={idx === 0}
            className="btn-ghost text-sm border border-border disabled:opacity-30">
            <ChevronLeft size={14} /> {t('exam.quiz.previous')}
          </button>

          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={cn('w-6 h-6 rounded-md text-[10px] font-medium transition-all',
                  i === idx ? 'bg-primary text-white' :
                  answers[String(questions[i].id)] ? 'bg-success/20 text-success border border-success/30' :
                  'bg-card text-text-muted border border-border hover:border-primary/40')}>
                {i+1}
              </button>
            ))}
          </div>

          {idx < totalQ - 1 ? (
            <button onClick={() => setIdx(p => p+1)} className="btn-primary text-sm">
              {t('exam.quiz.next')} <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary text-sm">
              {isSubmitting ? <><Loader2 size={13} className="animate-spin" /> {t('exam.quiz.evaluating')}</> : <><Check size={13} /> {t('exam.quiz.submit')}</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
