import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Clock, Play, Trophy, Brain, CheckCircle, FileText, MessageSquare } from '@/icons';
import { sessionsAPI } from '@/services/api';
import MathMarkdown from '@/components/MathMarkdown';
import { extractErrorMessage } from '@/utils/errors';
import { useToast } from '@/components/Toast';
import { usePageState } from '@/hooks/usePageState';
import { Button, Textarea } from '@/components/ui';
import { TYPE_META, formatItemDate } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// Inline quiz practice dengan submit ke PracticeResult
// ─────────────────────────────────────────────────────────────────────────────
export default function InlinePlanPractice({ item, practiceState, onClose, onSubmitted }) {
  const { toast } = useToast();
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
      toast.success(`Latihan selesai — skor ${score}!`);
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
            {correctCount} dari {total} soal benar
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
                  <CheckCircle size={12} className="text-success shrink-0" />
                ) : (
                  <XCircle size={12} className="text-danger shrink-0" />
                )}
                <span className="text-text-muted">Soal {i + 1}</span>
                <span className="text-text-secondary truncate flex-1">{question.topic}</span>
                {isCorrect === false && <span className="text-danger text-[10px]">Jawaban: {question.answer}</span>}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-ghost text-sm border border-border">Tutup</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            {submitting ? <><Loader2 size={13} className="animate-spin" /> Menyimpan...</> : <><ClipboardCheck size={13} /> Simpan Hasil & Tandai Selesai</>}
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null;

  const userAnswer = answers[String(q.id)] || '';

  return (
    <div className="p-4 bg-background border-t border-primary/10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-text-secondary">Latihan: {practiceState.topic}</span>
        <span className="px-2.5 py-1 bg-card rounded-full text-xs font-medium text-text-secondary border border-border">
          {idx + 1} / {total}
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-gradient-primary rounded-full transition-all duration-300" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>

      <h4 className="text-sm font-medium text-text mb-4 leading-relaxed">
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
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${isSelected ? 'bg-primary/10 border-primary text-primary-light font-medium' : 'bg-card border-border text-text hover:border-primary/50'}`}
              >
                <MathMarkdown>{opt}</MathMarkdown>
              </button>
            );
          })}
        </div>
      ) : (
        <Textarea
          value={userAnswer}
          onChange={(e) => selectAnswer(e.target.value)}
          rows={3}
          placeholder="Tulis jawaban Anda..."
          className="w-full resize-y"
        />
      )}

      <div className="flex justify-end mt-4">
        {isObjective && !userAnswer ? (
          <button onClick={() => selectAnswer('')} className="btn-ghost text-sm text-danger">Lewati (anggap salah)</button>
        ) : (
          <button
            onClick={() => {
              if (isObjective && !userAnswer) {
                setResults(p => ({ ...p, [String(q.id)]: false }));
              } else {
                const isCorrect = !isObjective || userAnswer === q.answer;
                setResults(p => ({ ...p, [String(q.id)]: isObjective ? isCorrect : undefined }));
              }
              handleNext();
            }}
            className="btn-primary text-sm"
          >
            {idx === total - 1 ? 'Lihat Hasil' : 'Jawab & Lanjut'}
          </button>
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
  const meta = TYPE_META[item.activity_type] || TYPE_META.review;
  const dateLabel = planStartDate ? formatItemDate(planStartDate, item.order_number) : (item.day_label || `Hari ${item.order_number + 1}`);
  const latestResult = item.practice_results?.[item.practice_results.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border overflow-hidden transition-all ${isPracticeOpen ? 'border-primary/30 bg-primary/5' : item.completed ? 'bg-success/5 border-success/20' : 'card-base'}`}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          onClick={() => onToggle(item.id)}
          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${item.completed ? 'bg-success border-success text-white' : 'border-border hover:border-primary'}`}
        >
          {item.completed && <Check size={11} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-text-muted">{dateLabel}</span>
            {item.time_slot && <span className="text-[10px] text-text-muted">{item.time_slot}</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.cls}`}>{meta.label}</span>
            {item.duration_minutes && (
              <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                <Clock size={9} /> {item.duration_minutes}m
              </span>
            )}
          </div>
          <p className={`text-sm font-medium text-text ${item.completed ? 'line-through opacity-60' : ''}`}>{item.topic}</p>
          {item.activity && <p className="text-xs text-text-secondary mt-0.5">{item.activity}</p>}

          {/* Latest practice result */}
          {latestResult && (
            <div className="mt-2 flex items-center gap-3 text-[11px]">
              {latestResult.practice_type === 'quiz' ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20">
                  <Trophy size={11} className="text-warning" />
                  <span className="font-bold text-warning">{latestResult.score}</span>
                  <span className="text-text-muted">latihan quiz terakhir {latestResult.created_at ? new Date(latestResult.created_at).toLocaleDateString('id-ID') : ''}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-accent-purple/10 border border-accent-purple/20">
                  <Brain size={11} className="text-accent-purple" />
                  <span className="text-accent-purple font-semibold">{latestResult.flashcard_reviewed} kartu</span>
                  <span className="text-text-muted">flashcard direview {latestResult.created_at ? new Date(latestResult.created_at).toLocaleDateString('id-ID') : ''}</span>
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {!item.completed && item.activity_type !== 'rest' && (
              <button
                disabled={isPracticeOpen}
                onClick={() => onOpenPractice(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-primary text-white text-[11px] font-bold hover:brightness-110 transition-all disabled:opacity-40"
              >
                <Play size={11} /> Latihan Quiz
              </button>
            )}
            {subjectId && (
              <button
                disabled={generating}
                onClick={() => onGenerateSummary(item)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 border ${
                  summary
                    ? 'border-success/40 text-success hover:bg-success/10'
                    : 'border-accent-blue/40 text-accent-blue hover:bg-accent-blue/10'
                }`}
              >
                {generating ? (
                  <><Loader2 size={11} className="animate-spin" /> Menyusun...</>
                ) : summary ? (
                  <><CheckCircle size={11} /> Lihat Rangkuman</>
                ) : (
                  <><FileText size={11} /> Lihat Rangkuman</>
                )}
              </button>
            )}
            {subjectId && !item.completed && (
              <button
                onClick={() => onAskTutor(item)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-blue/40 text-accent-blue text-[11px] font-semibold hover:bg-accent-blue/10 transition-colors"
              >
                <MessageSquare size={11} /> Tanya Tutor
              </button>
            )}
          </div>
        </div>
      </div>

      {isPracticeOpen && (
        <InlinePlanPractice
          item={item}
          practiceState={practiceState}
          onClose={onPracticeClose}
          onSubmitted={onPracticeSubmitted}
        />
      )}
    </motion.div>
  );
}
