import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Check, Loader2, Clock, Play, Brain, Trophy,
  CheckCircle, XCircle, Award, Target, ClipboardCheck, MessageSquare, FileText, X
} from '@/icons';
import { sessionsAPI, materiAPI } from '@/services/api';
import MathMarkdown from '@/components/MathMarkdown';
import { extractErrorMessage } from '@/utils/errors';
import { useToast } from '@/components/Toast';
import { usePageState } from '@/hooks/usePageState';

const TYPE_META = {
  review:     { label: 'Review',    cls: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20' },
  practice:   { label: 'Latihan',   cls: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20' },
  simulation: { label: 'Simulasi',  cls: 'bg-warning/15 text-warning border-warning/30' },
  rest:       { label: 'Istirahat', cls: 'bg-success/10 text-success border-success/20' },
};

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatItemDate(startDateStr, orderNumber) {
  const d = new Date(startDateStr);
  d.setDate(d.getDate() + orderNumber);
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
}

export default function StudyPlanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionId = Number(searchParams.get('session_id'));
  const { restore, persist, clear } = usePageState(`study-plan-${sessionId}`);
  const [practiceState, setPracticeState] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryTopic, setSummaryTopic] = useState('');
  const [generatedSummaries, setGeneratedSummaries] = useState({});

  // Restore practice state on mount
  useEffect(() => {
    const saved = restore();
    if (saved) {
      if (saved.practiceState) setPracticeState(saved.practiceState);
      if (saved.isGeneratingSummary) setIsGeneratingSummary(saved.isGeneratingSummary);
    }
  }, []);

  // Persist practice state on changes
  useEffect(() => {
    persist({ practiceState, isGeneratingSummary });
  }, [practiceState, isGeneratingSummary]);

  // Clear on unmount
  useEffect(() => {
    return () => clear();
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['session-detail', sessionId],
    queryFn: () => sessionsAPI.detail(sessionId).then(r => r.data),
    enabled: !!sessionId,
  });

  const subjectId = data?.subject_id;

  const { data: materialsData } = useQuery({
    queryKey: ['materials', subjectId],
    queryFn: () => materiAPI.getAll(subjectId).then(r => r.data),
    enabled: !!subjectId,
  });

  const toggleMutation = useMutation({
    mutationFn: (itemId) => sessionsAPI.togglePlanItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries(['session-detail', sessionId]);
      queryClient.invalidateQueries(['subject-dashboard']);
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const plan = data?.study_plan;
  const items = plan?.items || [];
  const readyMaterialIds = (materialsData?.materials || []).filter(m => m.status === 'Ready').map(m => m.id);
  const completedItems = items.filter(i => i.completed).length;
  const totalItems = items.length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Initialize generatedSummaries from persisted data
  const persistedSummaries = {};
  items.forEach(item => {
    if (item.summary) {
      persistedSummaries[item.id] = { summary: item.summary, topic: item.topic };
    }
  });
  // Merge: local cache (for newly generated) takes precedence over persisted
  const allSummaries = { ...persistedSummaries, ...generatedSummaries };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-danger mb-4">Gagal memuat rencana belajar: {extractErrorMessage(error)}</p>
        <button onClick={() => navigate('/exam-analyzer')} className="btn-ghost border border-border">Kembali</button>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-text-muted mb-4">Belum ada rencana belajar untuk sesi ini.</p>
        <button onClick={() => navigate('/exam-analyzer')} className="btn-ghost border border-border">Kembali</button>
      </div>
    );
  }

  const inPracticeItem = practiceState ? practiceState.itemId : null;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/exam-analyzer')} className="btn-ghost px-3 py-2 rounded-xl text-sm">
            <ArrowLeft size={16} /> Kembali
          </button>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold text-text">{plan.title || 'Rencana Belajar'}</h1>
            <p className="text-text-secondary text-sm mt-0.5">
              {data.subject_name || 'Mata Kuliah'}
              {plan.start_date ? ` • mulai ${formatItemDate(plan.start_date, 0)}` : ''}
            </p>
          </div>
        </div>

        {plan.motivational_message && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 flex items-start gap-3">
            <Award size={18} className="text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-text">{plan.motivational_message}</p>
          </div>
        )}

        {/* Progress */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
          <div className="flex justify-between text-xs text-text-muted mb-2">
            <span className="flex items-center gap-1.5">
              <Target size={12} className="text-primary" />
              Progress Rencana Belajar
            </span>
            <span className="font-semibold text-text-secondary">
              {progress >= 100 ? <span className="flex items-center gap-1"><Award size={12} className="text-success" /> Rencana Selesai!</span> : `${completedItems}/${totalItems} hari · ${progress}%`}
            </span>
          </div>
          <div className="h-3 bg-background rounded-full overflow-hidden border border-border/50">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6 }}
              className={`h-full rounded-full ${progress >= 100 ? 'bg-gradient-to-r from-success to-accent-teal' : 'bg-gradient-primary'}`}
            />
          </div>
          {(plan.priority_actions || []).length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50 space-y-1.5">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Aksi Prioritas</p>
              {(plan.priority_actions || []).map((a, i) => (
                <p key={i} className="text-xs text-text flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                  {a}
                </p>
              ))}
            </div>
          )}
        </motion.div>

        {/* Items */}
        <div className="space-y-3">
          {items.map((item) => {
            const meta = TYPE_META[item.activity_type] || TYPE_META.review;
            const dateLabel = plan.start_date ? formatItemDate(plan.start_date, item.order_number) : (item.day_label || `Hari ${item.order_number + 1}`);
            const latestResult = item.practice_results?.[item.practice_results.length - 1];
            const isPracticeOpen = inPracticeItem === item.id;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border overflow-hidden transition-all ${isPracticeOpen ? 'border-primary/30 bg-primary/5' : item.completed ? 'bg-success/5 border-success/20' : 'card-base'}`}
              >
                <div className="flex items-start gap-3 p-4">
                  <button
                    onClick={() => toggleMutation.mutate(item.id)}
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
                          onClick={async () => {
                            if (isPracticeOpen) return;
                            try {
                              const r = await sessionsAPI.fetchPracticeQuestions(sessionId, item.topic);
                              if (r.data?.detail) throw new Error(r.data.detail);
                              if (!r.data?.questions?.length) throw new Error('Tidak ada soal tersedia untuk topik ini.');
                              setPracticeState({ itemId: item.id, topic: item.topic, questions: r.data.questions });
                            } catch (err) {
                              toast.error(err.response?.data?.detail || err.message || 'Gagal memuat soal latihan.');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-primary text-white text-[11px] font-bold hover:brightness-110 transition-all disabled:opacity-40"
                        >
                          <Play size={11} /> Latihan Quiz
                         </button>
                      )}
                      {subjectId && (
                        <button
                          disabled={isGeneratingSummary === item.id}
                          onClick={async () => {
                            if (isGeneratingSummary) return;
                            
                            // Check cache (persisted + local) first
                            if (allSummaries[item.id]) {
                              setSummaryData(allSummaries[item.id].summary);
                              setSummaryTopic(allSummaries[item.id].topic);
                              setSummaryModalOpen(true);
                              return;
                            }

                            setIsGeneratingSummary(item.id);
                            try {
                              const result = await sessionsAPI.generateSummary(sessionId, item.topic || '');
                              if (result.data?.summary) {
                                const sumData = result.data.summary;
                                const sumTopic = item.topic || '';
                                setGeneratedSummaries(prev => ({
                                  ...prev,
                                  [item.id]: { summary: sumData, topic: sumTopic }
                                }));
                                setSummaryData(sumData);
                                setSummaryTopic(sumTopic);
                                setSummaryModalOpen(true);
                              } else {
                                throw new Error('Rangkuman kosong.');
                              }
                            } catch (err) {
                              toast.error(err.response?.data?.detail || err.message || 'Gagal membuat rangkuman.');
                            } finally {
                              setIsGeneratingSummary(null);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50 border ${
                            allSummaries[item.id]
                              ? 'border-success/40 text-success hover:bg-success/10'
                              : 'border-accent-blue/40 text-accent-blue hover:bg-accent-blue/10'
                          }`}
                        >
                          {isGeneratingSummary === item.id ? (
                            <><Loader2 size={11} className="animate-spin" /> Menyusun...</>
                          ) : allSummaries[item.id] ? (
                            <><CheckCircle size={11} /> Lihat Rangkuman</>
                          ) : (
                            <><FileText size={11} /> Lihat Rangkuman</>
                          )}
                        </button>
                      )}
                      {subjectId && !item.completed && (
                        <button
                          onClick={() => {
                            const subjectName = data?.subject_name || '';
                            navigate(`/chat?tutor=1&subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(item.topic)}`);
                          }}
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
                    onClose={() => { setPracticeState(null); clear(); }}
                    onSubmitted={() => {
                      setPracticeState(null);
                      clear();
                      queryClient.invalidateQueries(['session-detail', sessionId]);
                      queryClient.invalidateQueries(['subject-dashboard']);
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* SUMMARY MODAL */}
      {summaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-background/50">
              <h3 className="font-bold text-text flex items-center gap-2">
                <FileText size={16} className="text-accent-blue" />
                Rangkuman: {summaryTopic}
              </h3>
              <button onClick={() => setSummaryModalOpen(false)} className="text-text-muted hover:text-text transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto custom-scrollbar">
              <div className="prose prose-sm prose-invert max-w-none text-text-secondary leading-relaxed">
                <MathMarkdown>{summaryData || ''}</MathMarkdown>
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end bg-background/50">
              <button onClick={() => setSummaryModalOpen(false)} className="btn-primary text-sm px-6">Tutup</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline quiz practice dengan submit ke PracticeResult
// ─────────────────────────────────────────────────────────────────────────────
function InlinePlanPractice({ item, practiceState, onClose, onSubmitted }) {
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
        <textarea
          value={userAnswer}
          onChange={(e) => selectAnswer(e.target.value)}
          rows={3}
          placeholder="Tulis jawaban Anda..."
          className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
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
