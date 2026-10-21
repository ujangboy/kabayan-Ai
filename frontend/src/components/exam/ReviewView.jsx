import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { Icon } from '@/components/ui';
import { motion, AnimatePresence } from 'framer-motion';

import { examAPI } from '@/services/api';
import { cn } from '@/utils';
import MathMarkdown from '@/components/MathMarkdown';
import { useNavigate } from 'react-router-dom';
import { SectionHeader } from './shared';

export default function ReviewView({ sessionData, evalData }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
        [i]: { loading: false, text: '', error: t('exam.detail.explanationError') },
      }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="card-base p-5">
        <SectionHeader icon={ICONS.learning.bookOpen} title={t('common.reviewAnswers')}
          subtitle={t('exam.review.subtitle', { count: questions.length })} />

        <div className="space-y-3">
          {questions.map((q, i) => {
            const fb         = getFb(q.id);
            const isCorrect  = fb?.is_correct;
            const userAns    = fb?.user_answer || answers[String(q.id)] || '';
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
                    {isCorrect === true  ? <Icon name={ICONS.status.success} size={14} className="text-white" /> :
                     isCorrect === false ? <Icon name={ICONS.status.error}     size={14} className="text-white" /> :
                                          <span className="text-3xs font-bold text-text">?</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-muted mb-0.5">{t('exam.detail.questionProgress', { current: i + 1, total: questions.length })} · {q.topic} · {q.type}</p>
                    <div className="text-base text-text font-medium line-clamp-2">
                      <MathMarkdown>{q.question}</MathMarkdown>
                    </div>
                  </div>
                  <Icon name={ICONS.ui.chevronDown} size={14} className={cn('text-text-muted shrink-0 transition-transform', isOpen && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
                      transition={{ duration:0.2 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="p-3 rounded-lg bg-background">
                            <p className="text-xs font-semibold text-text-muted mb-1">{t('exam.detail.yourAnswer')}</p>
                            <div className={cn('font-medium', isCorrect ? 'text-success' : 'text-danger')}>
                              <MathMarkdown>{userAns || t('quiz.notAnswered')}</MathMarkdown>
                            </div>
                          </div>
                          {!isCorrect && (
                            <div className="p-3 rounded-lg bg-success/5 border border-success/15">
                              <p className="text-xs font-semibold text-text-muted mb-1">{t('exam.detail.correctAnswer')}</p>
                              <div className="font-medium text-success">
                                <MathMarkdown>{correctAns}</MathMarkdown>
                              </div>
                            </div>
                          )}
                        </div>

                        {fb?.feedback && (
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                            <p className="text-xs font-semibold text-primary mb-1">{t('exam.detail.aiFeedback')}</p>
                            <MathMarkdown>{fb.feedback}</MathMarkdown>
                          </div>
                        )}

                        {/* Explanation: pre-stored / lazy AI / error — crossfade saat resolve */}
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={expl?.text ? 'ai' : expl?.error ? 'error' : q.explanation ? 'pre' : 'none'}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                          >
                            {q.explanation && !expl?.text && (
                              <div className="p-3 rounded-lg bg-background border border-border">
                                <p className="text-xs font-semibold text-text-muted mb-1">{t('common.explanation')}</p>
                                <MathMarkdown>{q.explanation}</MathMarkdown>
                              </div>
                            )}

                            {expl?.text && (
                              <div className="p-3 rounded-lg bg-accent-teal/5 border border-accent-teal/20">
                                <p className="text-xs font-semibold text-accent-teal mb-1 flex items-center gap-1">
                                  <Icon name={ICONS.learning.lightbulb} size={11} /> {t('exam.detail.aiExplanation')}
                                </p>
                                <MathMarkdown>{expl.text}</MathMarkdown>
                              </div>
                            )}
                            {expl?.error && (
                              <p className="text-xs text-danger">{expl.error}</p>
                            )}
                          </motion.div>
                        </AnimatePresence>

                        <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted">
                          {q.material_reference && (
                            <span className="flex items-center gap-1">
                              <Icon name={ICONS.files.document} size={11} /> {q.material_reference}
                            </span>
                          )}
                          {q.tips && (
                            <span className="flex items-center gap-1 text-primary">
                              <Icon name={ICONS.learning.lightbulb} size={11} /> {q.tips}
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
                                ? <><Icon name={ICONS.status.loading} size={11} className="animate-spin" /> {t('common.loading')}</>
                                : <><Icon name={ICONS.learning.lightbulb} size={11} /> {t('exam.detail.explainBtn')}</>}
                            </button>
                          )}
                          
                          {/* Contextual Ask Tutor for wrong question */}
                          {(!q.is_correct || expl?.text || q.explanation) && (
                            <button
                              onClick={() => {
                                const topic = q.topic || t('exam.detail.review');
                                const sessionId = sessionData?.id;
                                const subjectName = sessionData?.subject_name || '';
                                navigate(`/chat?tutor=1&exam=${sessionId}&subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(topic)}`);
                              }}
                              className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors border",
                                (!q.explanation && !expl?.text) ? "ml-2" : "ml-auto",
                                "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                              )}
                            >
                              <Icon name={ICONS.communication.chat} size={11} /> {t('exam.detail.askTutor')}
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