import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon , Button} from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';

import { examAPI } from '@/services/api';
import { cn } from '@/utils';
import { springWave } from '@/lib/motion';
import MathMarkdown from '@/components/MathMarkdown';
import { Chip, getQuestionTypeLabel, getBloomLabel, getDifficultyLabel } from './shared';

export default function QuizView({ sessionData, clockStart, onDone }) {
  const { t } = useTranslation();
  const questions = sessionData?.questions || [];
  const totalQ    = questions.length;
  const duration  = sessionData?.duration_minutes;

  const [idx, setIdx]         = useState(0);
  const [answers, setAnswers] = useState({});
  const [paused, setPaused]   = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!duration) return null;
    const base = duration * 60;
    if (clockStart) {
      const elapsed = Math.floor((Date.now() - clockStart) / 1000);
      return Math.max(0, base - elapsed);
    }
    return base;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]     = useState('');
  // Ref (bukan state) karena effect timer dan klik manual bisa memanggil
  // submit pada tick yang sama. React StrictMode juga menjalankan effect
  // dua kali saat mount; tanpa lock, sesi bisa ter-submit berulang dan
  // memicu 422 saat jawaban masih kosong.
  const submitLock = useRef(false);

  const formatTime = (s) => {
    if (s === null) return '∞';
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const q = questions[idx];
  const progress = Math.round(((idx + 1) / totalQ) * 100);

  const typeLabel = getQuestionTypeLabel(t, q?.type);
  const bloomLabel = getBloomLabel(t, q?.bloom_level);
  const difficultyLabel = getDifficultyLabel(t, q?.difficulty);

  const selectAnswer = (val) => setAnswers(p => ({ ...p, [String(q.id)]: val }));

  const handleSubmit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setError(''); setIsSubmitting(true);
    try {
      const r = await examAPI.submit(sessionData.session_id, answers);
      if (r.data?.detail) throw new Error(r.data.detail);
      const evalResult = r.data;

      onDone(evalResult, answers);
    } catch (e) {
      submitLock.current = false;
      setError(e.response?.data?.detail || e.message || t('exam.quiz.submitFailed'));
      setIsSubmitting(false);
    }
  };

  // Timer. Dependensi sengaja dibatasi ke waktu/pause agar timer tidak
  // di-reset setiap kali jawaban berubah; render tick terakhir tetap memakai
  // closure answers terbaru saat auto-submit.
  useEffect(() => {
    if (timeLeft === null || paused) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const timer = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, paused]);

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
            <div className="h-full w-full bg-primary rounded-full origin-left transition-transform" style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
        </div>

        {timeLeft !== null && (
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-bold border',
            timeLeft < 60 ? 'text-danger border-danger/30 bg-danger/10 animate-pulse' : 'text-text border-border bg-card')}>
            <Icon name={ICONS.learning.clock} size={13} />{formatTime(timeLeft)}
          </div>
        )}

        <button onClick={() => setPaused(p => !p)}
          className="p-2 rounded-lg border border-border bg-card text-text-secondary hover:text-text transition-colors">
          {paused ? <Icon name={ICONS.media.play} size={14} /> : <Icon name={ICONS.media.pause} size={14} />}
        </button>
      </div>

      {/* Pause overlay + Question card — crossfade pause/resume */}
      <AnimatePresence mode="wait" initial={false}>
        {paused ? (
          <motion.div
            key="paused"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="card-base p-16 text-center"
          >
            <Icon name={ICONS.media.pause} size={48} className="mx-auto mb-4 text-text-muted opacity-40" />
            <h3 className="text-lg font-semibold text-text mb-2">{t('exam.quiz.pausedTitle')}</h3>
            <Button onClick={() => setPaused(false)} className="mt-4" variant="primary">
              <Icon name={ICONS.media.play} size={14} /> {t('exam.quiz.resume')}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="card-base p-6 space-y-5"
          >
            <div className="flex items-start gap-3">
              <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
                {idx+1}
              </span>
              <div className="flex-1">
                <div className="flex gap-2 flex-wrap mb-3">
                  <Chip label={typeLabel} size="xs" color="blue" />
                  <Chip label={bloomLabel} size="xs" color="teal" />
                  <Chip label={difficultyLabel} size="xs"
                    color={['sulit', 'hard'].includes(q.difficulty) ? 'danger' : ['menengah', 'medium'].includes(q.difficulty) ? 'warning' : 'success'} />
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
                      className={cn('relative w-full text-left p-3.5 rounded-xl border text-sm overflow-hidden transition-colors',
                        sel ? 'border-primary text-primary font-medium'
                            : 'bg-card border-border text-text hover:border-primary/40')}>
                      {sel && (
                        <motion.span layoutId="quiz-opt-indicator" transition={springWave} className="absolute inset-0 bg-primary/10" />
                      )}
                      <span className="relative"><MathMarkdown>{opt}</MathMarkdown></span>
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
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-base text-text focus:outline-none focus:border-primary resize-none"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-danger text-sm">{error}</p>}

      {/* Navigation */}
      {!paused && (
        <div className="flex items-center justify-between">
          <Button onClick={() => setIdx(p => Math.max(0, p-1))} disabled={idx === 0}
            className="text-sm border border-border disabled:opacity-30" variant="ghost">
            <Icon name={ICONS.ui.chevronLeft} size={14} /> {t('exam.quiz.previous')}
          </Button>

          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={cn('w-6 h-6 rounded-md text-3xs font-medium transition-all',
                  i === idx ? 'bg-primary text-white' :
                  answers[String(questions[i].id)] ? 'bg-success/20 text-success border border-success/30' :
                  'bg-card text-text-muted border border-border hover:border-primary/40')}>
                {i+1}
              </button>
            ))}
          </div>

          {idx < totalQ - 1 ? (
            <Button onClick={() => setIdx(p => p+1)} className="text-sm" variant="primary">
              {t('exam.quiz.next')} <Icon name={ICONS.ui.chevronRight} size={14} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting} className="text-sm" variant="primary">
              {isSubmitting ? <><Icon name={ICONS.status.loading} size={13} className="animate-spin" /> {t('exam.quiz.evaluating')}</> : <><Icon name={ICONS.status.check} size={13} /> {t('exam.quiz.submit')}</>}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}