import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, CheckCircle, Check, Loader2, Calendar, BookOpen,
  AlertTriangle, TrendingUp, Save, MessageSquare,
} from 'lucide-react';
import { examAPI, sessionsAPI } from '@/services/api';
import { cn } from '@/utils';
import { Chip } from './shared';

export default function ResultView({ evalData, onReview, onFinish, sessionId, onOpenPlanTab, subjectName = '' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadingRec, setLoadingRec]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [saveError, setSaveError]       = useState('');
  const [planSaved, setPlanSaved]       = useState(false);
  const [planPreview, setPlanPreview]   = useState(null);
  const [planSaving, setPlanSaving]     = useState(false);
  const [planSaveError, setPlanSaveError] = useState('');

  if (!evalData) return null;

  const { score = 0, grade = '-', performance_level = '-', total_correct = 0, total_wrong = 0,
    total_unanswered = 0, estimated_exam_score = 0, strong_topics = [], weak_topics = [],
    overall_feedback = '' } = evalData;

  const scoreColor = score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-danger';

  const handleSelesai = async () => {
    if (saved) {
      onFinish?.();
      return;
    }
    setSaveError(''); setSaving(true);
    try {
      let studyPlanData = null;
      try {
        const rr = await examAPI.getRecommendation(sessionId);
        if (rr.data && !rr.data.detail) studyPlanData = rr.data;
      } catch {}

      if (studyPlanData) {
        await sessionsAPI.saveStudyPlan(sessionId, studyPlanData);
      }

      setSaved(true);
      setTimeout(() => { onFinish?.(); }, 1200);
    } catch (e) {
      setSaveError(e.response?.data?.detail || e.message || t('exam.result.saveFailed'));
    } finally { setSaving(false); }
  };

  const handleLihatRencana = async () => {
    setPlanSaveError('');
    if (planPreview) {
      setPlanPreview(null);
      return;
    }
    setLoadingRec(true);
    try {
      const rr = await examAPI.getRecommendation(sessionId);
      if (!rr.data || rr.data.detail) throw new Error(rr.data?.detail || t('exam.result.planFetchFailed'));
      setPlanPreview(rr.data);
    } catch (e) {
      setPlanSaveError(e.message || t('exam.result.planLoadFailed'));
    } finally { setLoadingRec(false); }
  };

  const handleSimpanRencana = async () => {
    if (!planPreview) return;
    setPlanSaving(true);
    setPlanSaveError('');
    try {
      await sessionsAPI.saveStudyPlan(sessionId, planPreview);
      setPlanSaved(true);
      onFinish?.();
      onOpenPlanTab?.();
    } catch (e) {
      setPlanSaveError(e.response?.data?.detail || e.message || t('exam.result.planSaveFailed'));
    } finally { setPlanSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Score hero */}
      <div className="card-base p-8 text-center">
        <Trophy size={48} className="mx-auto text-warning mb-4" />
        <h2 className="text-2xl font-bold text-text mb-1">{t('exam.result.doneTitle')}</h2>
        <div className={cn('text-7xl font-black my-4', scoreColor)}>{score}</div>
        <div className="flex justify-center gap-2 mb-3">
          <Chip label={t('exam.result.gradeLabel', { grade })} color={score>=80?'success':score>=60?'warning':'danger'} />
          <Chip label={performance_level} color="purple" />
        </div>
        <p className="text-text-secondary text-sm">{overall_feedback}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('exam.result.statCorrect'),   value: total_correct,        color:'text-success', bg:'bg-success/10 border-success/20' },
          { label: t('exam.result.statWrong'),     value: total_wrong,          color:'text-danger',  bg:'bg-danger/10 border-danger/20' },
          { label: t('exam.result.statEmpty'),     value: total_unanswered,     color:'text-text-muted', bg:'bg-card border-border' },
          { label: t('exam.result.statEstScore'),  value: estimated_exam_score, color:'text-primary', bg:'bg-primary/10 border-primary/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('p-4 rounded-xl border text-center', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-text-secondary mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strong_topics.length > 0 && (
          <div className="card-base p-4">
            <p className="text-xs font-semibold text-success uppercase tracking-wider mb-3 flex items-center gap-1">
              <TrendingUp size={12} /> {t('exam.result.strongTopics')}
            </p>
            <div className="space-y-2">
              {strong_topics.map((topic, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-text">{topic.topic}</span>
                  <Chip label={topic.mastery} size="xs" color="success" />
                </div>
              ))}
            </div>
          </div>
        )}
        {weak_topics.length > 0 && (
          <div className="card-base p-4">
            <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3 flex items-center gap-1">
              <AlertTriangle size={12} /> {t('exam.result.weakTopics')}
            </p>
            <div className="space-y-2">
              {weak_topics.map((topic, i) => (
                <div key={i} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-background/50 border border-border/50">
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-text font-medium">{topic.topic}</span>
                    {topic.issue && <p className="text-xs text-text-muted mt-0.5">{topic.issue}</p>}
                    
                    {/* Contextual Ask Tutor for weak topic */}
                    {sessionId && (
                      <button
                        onClick={() => navigate(`/chat?tutor=1&exam=${sessionId}&subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(topic.topic)}`)}
                        className="text-[11px] flex items-center gap-1.5 text-primary hover:text-primary-focus transition-colors mt-2"
                      >
                        <MessageSquare size={11} /> {t('exam.result.askTutor')}
                      </button>
                    )}
                  </div>
                  
                  <div className="shrink-0 mt-0.5">
                    <Chip label={t('exam.result.priorityLabel', { priority: topic.priority })} size="xs"
                      color={topic.priority === 'Tinggi' ? 'danger' : topic.priority === 'Menengah' ? 'warning' : 'teal'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {(saveError || planSaveError) && (
        <p className="text-danger text-sm">{saveError || planSaveError}</p>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm">
          <CheckCircle size={15} /> {t('exam.result.savedMsg')}
        </div>
      )}

      {/* Plan preview inline */}
      {planPreview && (
        <div className="card-base p-5 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
              <Calendar size={14} /> {t('exam.result.planPreviewTitle')}
            </h3>
            <button onClick={() => setPlanPreview(null)} className="text-xs text-text-muted hover:text-text">{t('common.close')}</button>
          </div>
          <p className="text-xs text-text-secondary mb-3">{planPreview.motivational_message}</p>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {(planPreview.study_plan || []).map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-background/50 border border-border/50 text-xs">
                <span className="text-text-muted font-mono shrink-0 w-12">H{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-medium text-text">{item.topic}</span>
                    <span className="text-[10px] text-primary">{item.time_slot}</span>
                  </div>
                  <p className="text-text-secondary">{item.activity}</p>
                  {item.resources && <p className="text-primary/80 mt-0.5">{item.resources}</p>}
                </div>
                <span className="text-text-muted shrink-0">{item.duration_minutes}m</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleSimpanRencana} disabled={planSaving || planSaved}
              className="btn-primary text-sm flex items-center gap-1.5">
              {planSaving ? <><Loader2 size={13} className="animate-spin" /> {t('exam.result.saving')}</>
                : planSaved ? <><Check size={13} /> {t('exam.result.saved')}</>
                : <><Save size={13} /> {t('exam.result.savePlan')}</>}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={onReview} className="btn-ghost text-sm border border-border">
          <BookOpen size={13} /> {t('exam.result.reviewAnswers')}
        </button>
        <button onClick={handleLihatRencana} disabled={loadingRec} className="btn-ghost text-sm border border-border">
          {loadingRec ? <><Loader2 size={13} className="animate-spin" /> {t('common.loading')}</>
            : planPreview ? <><Calendar size={13} /> {t('exam.result.closePlan')}</>
            : <><Calendar size={13} /> {t('exam.result.viewPlan')}</>}
        </button>
        <button onClick={handleSelesai} disabled={saving} className="btn-primary text-sm ml-auto">
          {saving
            ? <><Loader2 size={13} className="animate-spin" /> {t('exam.result.saving')}</>
            : saved
              ? <><Check size={13} /> {t('exam.result.goingHistory')}</>
              : <><Check size={13} /> {t('exam.result.doneAndSave')}</>
          }
        </button>
      </div>
    </div>
  );
}
