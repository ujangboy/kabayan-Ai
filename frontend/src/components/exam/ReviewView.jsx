import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCircle, XCircle, ChevronDown, Loader2, Lightbulb, FileText } from 'lucide-react';
import { examAPI } from '@/services/api';
import { cn } from '@/utils';
import MathMarkdown from '@/components/MathMarkdown';
import { SectionHeader } from './shared';

export default function ReviewView({ sessionData, evalData }) {
  const { t } = useTranslation();
  const [expandedIdx, setExpandedIdx] = useState(null);
  // Map of question index → {loading, text, error}
  const [explanations, setExplanations] = useState({});

  const questions = sessionData?.questions || [];
  const answers   = sessionData?.answers   || {};
  const perQ      = evalData?.per_question_feedback || [];

  const getFb = (qid) => perQ.find(f => String(f.question_id) === String(qid));

  const fetchExplanation = async (q, i) => {
    if (explanations[i]?.text) return; // already loaded
    setExplanations(prev => ({ ...prev, [i]: { loading: true, text: '', error: '' } }));
    try {
      const r = await examAPI.getExplanation({
        bank_id:       q.bank_id || null,
        question:      q.question,
        correct_answer: q.answer || '',
        topic:         q.topic  || '',
      });
      const text = r.data?.explanation || t('exam.review.explanationUnavailable');
      setExplanations(prev => ({ ...prev, [i]: { loading: false, text, error: '' } }));
    } catch {
      setExplanations(prev => ({
        ...prev,
        [i]: { loading: false, text: '', error: 'Gagal memuat penjelasan.' },
      }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="card-base p-5">
        <SectionHeader icon={BookOpen} title="Review Jawaban"
          subtitle={`${questions.length} soal · Klik untuk melihat penjelasan`} />

        <div className="space-y-3">
          {questions.map((q, i) => {
            const fb         = getFb(q.id);
            const isCorrect  = fb?.is_correct;
            const userAns    = fb?.user_answer || answers[String(q.id)] || '(Tidak dijawab)';
            const correctAns = fb?.correct_answer || q.answer || '';
            const isOpen     = expandedIdx === i;
            const expl       = explanations[i];

            return (
              <div key={i} className={cn('rounded-xl border overflow-hidden transition-all',
                isCorrect === true  ? 'border-success/30' :
                isCorrect === false ? 'border-danger/30'  : 'border-border')}>

                <button onClick={() => setExpandedIdx(isOpen ? null : i)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-background/50 transition-colors">
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                    isCorrect === true  ? 'bg-success'  :
                    isCorrect === false ? 'bg-danger'   : 'bg-border')}>
                    {isCorrect === true  ? <CheckCircle size={14} className="text-white" /> :
                     isCorrect === false ? <XCircle     size={14} className="text-white" /> :
                                          <span className="text-[10px] font-bold text-text">?</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-muted mb-0.5">Soal {i+1} · {q.topic} · {q.type}</p>
                    <div className="text-sm text-text font-medium line-clamp-2">
                      <MathMarkdown>{q.question}</MathMarkdown>
                    </div>
                  </div>
                  <ChevronDown size={14} className={cn('text-text-muted shrink-0 transition-transform', isOpen && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
                      transition={{ duration:0.2 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="p-3 rounded-lg bg-background">
                            <p className="text-xs font-semibold text-text-muted mb-1">Jawaban Kamu</p>
                            <div className={cn('font-medium', isCorrect ? 'text-success' : 'text-danger')}>
                              <MathMarkdown>{userAns || '(Tidak dijawab)'}</MathMarkdown>
                            </div>
                          </div>
                          {!isCorrect && (
                            <div className="p-3 rounded-lg bg-success/5 border border-success/15">
                              <p className="text-xs font-semibold text-text-muted mb-1">Jawaban Benar</p>
                              <div className="font-medium text-success">
                                <MathMarkdown>{correctAns}</MathMarkdown>
                              </div>
                            </div>
                          )}
                        </div>

                        {fb?.feedback && (
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                            <p className="text-xs font-semibold text-primary mb-1">Feedback AI</p>
                            <MathMarkdown>{fb.feedback}</MathMarkdown>
                          </div>
                        )}

                        {/* Pre-stored explanation (from question bank) */}
                        {q.explanation && !expl?.text && (
                          <div className="p-3 rounded-lg bg-background border border-border">
                            <p className="text-xs font-semibold text-text-muted mb-1">Penjelasan</p>
                            <MathMarkdown>{q.explanation}</MathMarkdown>
                          </div>
                        )}

                        {/* Lazy AI explanation result */}
                        {expl?.text && (
                          <div className="p-3 rounded-lg bg-accent-teal/5 border border-accent-teal/20">
                            <p className="text-xs font-semibold text-accent-teal mb-1 flex items-center gap-1">
                              <Lightbulb size={11} /> Penjelasan AI
                            </p>
                            <MathMarkdown>{expl.text}</MathMarkdown>
                          </div>
                        )}
                        {expl?.error && (
                          <p className="text-xs text-danger">{expl.error}</p>
                        )}

                        <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted">
                          {q.material_reference && (
                            <span className="flex items-center gap-1">
                              <FileText size={11} /> {q.material_reference}
                            </span>
                          )}
                          {q.tips && (
                            <span className="flex items-center gap-1 text-primary">
                              <Lightbulb size={11} /> {q.tips}
                            </span>
                          )}
                          {/* Jelaskan button — only if no explanation already shown */}
                          {!q.explanation && !expl?.text && (
                            <button
                              onClick={() => fetchExplanation(q, i)}
                              disabled={expl?.loading}
                              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-teal/10 text-accent-teal border border-accent-teal/20 hover:bg-accent-teal/20 transition-colors disabled:opacity-50"
                            >
                              {expl?.loading
                                ? <><Loader2 size={11} className="animate-spin" /> Memuat...</>
                                : <><Lightbulb size={11} /> Jelaskan</>}
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
      </div>
    </div>
  );
}
