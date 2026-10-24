import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ICONS } from '@/lib/icons';

import { sessionsAPI } from '@/services/api';
import MathMarkdown from '@/components/MathMarkdown';
import { extractErrorMessage } from '@/utils/errors';
import { cn, formatDate } from '@/utils';
import { useToast } from '@/components/Toast';
import { usePageState } from '@/hooks/usePageState';
import { springWave } from '@/lib/motion';
import { Button, Textarea, Icon, Tooltip } from '@/components/ui';
import { TYPE_META, formatItemDate, formatRealDate } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Inline quiz practice dengan submit ke PracticeResult
// ─────────────────────────────────────────────────────────────────────────────
export default function InlinePlanPractice({ item, practiceState, onClose, onSubmitted }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const practiceKey = `practice-${item.id}`;
  const { restore: restorePractice, persist: persistPractice } = usePageState(practiceKey);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Restore practice progress on mount
  useEffect(() => {
    const saved = restorePractice();
    if (saved) {
      if (saved.idx != null) setIdx(saved.idx);
      if (saved.answers) setAnswers(saved.answers);
      if (saved.results) setResults(saved.results);
      if (saved.showSummary) setShowSummary(saved.showSummary);
    }
  }, []);

  // Persist practice progress on changes
  useEffect(() => {
    persistPractice({ idx, answers, results, showSummary });
  }, [idx, answers, results, showSummary]);

  const questions = practiceState.questions;
  const q = questions[idx];
  const total = questions.length;
  const isObjective = ['mcq', 'truefalse'].includes(q?.type);

  const optionsList = q?.options_list || (q?.options ? Object.values(q.options) : []);

  const selectAnswer = (val) => {
    if (showSummary) return;
    setAnswers(p => ({ ...p, [String(q.id)]: val }));
  };

  const handleNext = () => {
    if (idx < total - 1) {
      setIdx(i => i + 1);
    } else {
      setShowSummary(true);
    }
  };

  const correctCount = Object.values(results).filter(Boolean).length;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        score,
        total_questions: total,
        correct_count: correctCount,
      };
      await sessionsAPI.submitPlanQuiz(item.id, payload);
      toast.success(t('studyPlanPage.practiceDone', { score }));
      onSubmitted();
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setSubmitting(false);
    }
  };

  // Summary view
  if (showSummary) {
    return (
      <div className="p-4 bg-background border-t border-primary/10 space-y-4">
        <div className="text-center">
          <p className="text-3xl font-black text-text">{score}%</p>
          <p className={`text-sm font-semibold ${score >= 70 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger'}`}>
            {t('studyPlanPage.correctOf', { correct: correctCount, total })}
          </p>
        </div>
        <div className="space-y-1">
          {questions.map((question, i) => {
            const isCorrect = results[String(question.id)];
            return (
              <div key={question.id} className="flex items-center gap-2 text-xs py-1">
                {isCorrect === undefined ? (
                  <span className="text-text-muted">•</span>
                ) : isCorrect ? (
                  <Icon name={ICONS.status.success} size={12} className="text-success shrink-0" />
                ) : (
                  <Icon name={ICONS.status.error} size={12} className="text-danger shrink-0" />
                )}
                <span className="text-text-muted">{t('studyPlanPage.questionN', { n: i + 1 })}</span>
                <Tooltip label={question.topic}>
                  <span className="text-text-secondary truncate flex-1">{question.topic}</span>
                </Tooltip>
                {isCorrect === false && <span className="text-danger text-3xs">{t('studyPlanPage.answerLabel', { answer: question.answer })}</span>}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 justify-end">
          <Button onClick={onClose} className="text-sm border border-border" variant="ghost">{t('common.close')}</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm flex items-center gap-1.5"
           variant="primary">
            {submitting ? <><Icon name={ICONS.status.loading} size={13} className="animate-spin" /> {t('common.saving')}</> : <><Icon name={ICONS.status.completed} size={13} /> {t('studyPlanPage.saveResult')}</>}
          </Button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const userAnswer = answers[String(q.id)] || '';

  return (
    <div className="p-4 bg-background border-t border-primary/10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-text-secondary">{t('studyPlanPage.practiceLabel', { topic: practiceState.topic })}</span>
        <span className="px-2.5 py-1 bg-card rounded-full text-xs font-medium text-text-secondary border border-border">
          {idx + 1} / {total}
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full mb-4 overflow-hidden">
        <div className="h-full w-full bg-primary rounded-full origin-left transition-transform duration-300" style={{ transform: `scaleX(${((idx + 1) / total) / 100})` }} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
        >
          <h4 className="text-base font-medium text-text mb-4 leading-relaxed">
            <MathMarkdown>{q.question}</MathMarkdown>
          </h4>

          {isObjective ? (
            <div className="space-y-2">
              {optionsList.map((opt, i) => {
                const key = (q.options ? Object.keys(q.options)[i] : null) || opt.split('.')[0].trim();
                const isSelected = userAnswer === key;
                return (
                  <button
                    key={i}
                    onClick={() => selectAnswer(key)}
                    className={`relative w-full text-left px-3 py-2.5 rounded-lg border text-base overflow-hidden transition-colors ${isSelected ? 'border-primary text-primary-light font-medium' : 'bg-card border-border text-text hover:border-primary/50'}`}
                  >
                    {isSelected && (
                      <motion.span layoutId="plan-opt-indicator" transition={springWave} className="absolute inset-0 bg-primary/10" />
                    )}
                    <span className="relative"><MathMarkdown>{opt}</MathMarkdown></span>
                  </button>
                );
              })}
            </div>
          ) : (
            <Textarea
              value={userAnswer}
              onChange={(e) => selectAnswer(e.target.value)}
              rows={3}
              placeholder={t('quiz.answerPlaceholder')}
              className="w-full resize-y"
            />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-end mt-4">
        {isObjective && !userAnswer ? (
          <Button onClick={() => selectAnswer('')} className="text-sm text-danger" variant="ghost">{t('studyPlanPage.skipWrong')}</Button>
        ) : (
          <Button
            onClick={() => {
              if (isObjective && !userAnswer) {
                setResults(p => ({ ...p, [String(q.id)]: false }));
              } else {
                const isCorrect = !isObjective || userAnswer === q.answer;
                setResults(p => ({ ...p, [String(q.id)]: isObjective ? isCorrect : undefined }));
              }
              handleNext();
            }}
            className="text-sm"
           variant="primary">
            {idx === total - 1 ? t('common.viewResult') : t('studyPlanPage.answerNext')}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kartu satu item rencana belajar
// ─────────────────────────────────────────────────────────────────────────────
export function StudyPlanItem({
  item, planStartDate, isPracticeOpen, summary, generating, subjectId,
  onToggle, onOpenPractice, onGenerateSummary, onAskTutor,
  practiceState, onPracticeClose, onPracticeSubmitted,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meta = TYPE_META[item.activity_type] || TYPE_META.review;
  // Tanggal jadwal: start_date rencana (dipilih user di ResultView) + nomor
  // hari → tiap item punya tanggal sendiri. Fallback: tanggal real materi,
  // atau label "Hari N" bila keduanya tidak ada.
  const realCreatedAt = item.material_created_at || null;
  const dateLabel = item.material_created_at && !planStartDate
    ? formatRealDate(realCreatedAt, t)
    : planStartDate
      ? (formatItemDate(planStartDate, item.order_number ?? item.orderNumber ?? 0) || item.day_label)
      : (item.day_label || t('studyPlanPage.day', { n: item.order_number + 1 }));
  const latestResult = item.practice_results?.[item.practice_results.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-xl border overflow-hidden transition-all',
        isPracticeOpen
          ? 'border-primary/30 bg-primary/5'
          : item.completed
            ? 'bg-success/5 border-success/20'
            : 'bg-surface border-border hover:border-strong'
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          onClick={() => onToggle(item.id)}
          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${item.completed ? 'bg-success border-success text-white' : 'border-border hover:border-primary hover:bg-primary/10'}`}
        >
          {item.completed && <Icon name={ICONS.status.check} size={11} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-text-muted">{dateLabel}</span>
            {item.time_slot && <span className="text-3xs text-text-muted">{item.time_slot}</span>}
            <span className={`text-3xs px-1.5 py-0.5 rounded border ${meta.cls}`}>{t(meta.labelKey)}</span>
            {item.duration_minutes && (
              <span className="text-3xs text-text-muted flex items-center gap-0.5">
                <Icon name={ICONS.learning.clock} size={9} /> {item.duration_minutes}{t('studyPlan.minutesShort')}
              </span>
            )}
          </div>
          <p className={`text-base font-medium text-text ${item.completed ? 'line-through opacity-60' : ''}`}>{item.topic}</p>
          {item.activity && <p className="text-xs text-text-secondary mt-0.5">{item.activity}</p>}
          {item.resources && <p className="text-3xs text-text-muted mt-1">{item.resources}</p>}

          {/* Materi terkait + tanggal real dibuat (bukan now) */}
          {item.material_names?.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              {item.material_names.slice(0, 4).map((name, i) => (
                <Tooltip key={i} label={name}>
                  <span className="inline-flex items-center gap-0.5 text-3xs px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[220px]">
                    <Icon name={ICONS.files.document} size={8} className="shrink-0" />{name}
                  </span>
                </Tooltip>
              ))}
              {item.material_names.length > 4 && (
                <Tooltip label={item.material_names.slice(4).join(', ')}>
                  <span className="text-3xs text-text-muted cursor-default">{t('studyPlanPage.moreMaterials', { count: item.material_names.length - 4 })}</span>
                </Tooltip>
              )}
            </div>
          )}

          {/* Latest practice result */}
          {latestResult && (
            <div className="mt-2 flex items-center gap-3 text-2xs">
              {latestResult.practice_type === 'quiz' ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20">
                  <Icon name={ICONS.learning.trophy} size={11} className="text-warning" />
                  <span className="font-bold text-warning">{latestResult.score}</span>
                  <span className="text-text-muted">{t('studyPlanPage.lastQuizPractice', { date: latestResult.created_at ? formatDate(latestResult.created_at) : '' })}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent-purple/10 border border-accent-purple/20">
                  <Icon name={ICONS.learning.brain} size={11} className="text-accent-purple" />
                  <span className="text-accent-purple font-semibold">{t('studyPlanPage.cardsReviewed', { count: latestResult.flashcard_reviewed })}</span>
                  <span className="text-text-muted">{t('studyPlanPage.flashcardReviewed', { date: latestResult.created_at ? formatDate(latestResult.created_at) : '' })}</span>
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-3 flex-wrap items-center">
            {item.activity_type === 'simulation' && subjectId && (
              // Item Simulasi Penuh = sesi ujian yang dijadwalkan → buka simulator
              <button
                onClick={() => navigate(`/exam-analyzer?subject_id=${subjectId}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-bold transition-colors border border-warning/40 text-warning hover:bg-warning/10"
              >
                <Icon name={ICONS.nav.exam} size={11} /> {t('studyPlanPage.openExam')}
              </button>
            )}
            {!item.completed && item.activity_type !== 'rest' && (
              <button
                disabled={isPracticeOpen}
                onClick={() => onOpenPractice(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-solid text-white text-2xs font-bold hover:bg-primary-solid-hover transition-colors disabled:opacity-40"
              >
                <Icon name={ICONS.media.play} size={11} /> {t('studyPlanPage.practiceQuiz')}
              </button>
            )}
            {subjectId && (
              <button
                disabled={generating}
                onClick={() => onGenerateSummary(item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-semibold transition-colors disabled:opacity-50 border ${
                  summary
                    ? 'border-success/40 text-success hover:bg-success/10'
                    : 'border-accent-blue/40 text-accent-blue hover:bg-accent-blue/10'
                }`}
              >
                {generating ? (
                  <><Icon name={ICONS.status.loading} size={11} className="animate-spin" /> {t('studyPlanPage.composing')}</>
                ) : summary ? (
                  <><Icon name={ICONS.status.success} size={11} /> {t('common.viewSummary')}</>
                ) : (
                  <><Icon name={ICONS.files.document} size={11} /> {t('common.viewSummary')}</>
                )}
              </button>
            )}
            {subjectId && !item.completed && (
              <button
                onClick={() => onAskTutor(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-blue/40 text-accent-blue text-2xs font-semibold hover:bg-accent-blue/10 transition-colors"
              >
                <Icon name={ICONS.communication.chat} size={11} /> {t('studyPlanPage.askTutor')}
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isPracticeOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <InlinePlanPractice
              item={item}
              practiceState={practiceState}
              onClose={onPracticeClose}
              onSubmitted={onPracticeSubmitted}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}