import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronLeft, Zap, Loader2 } from 'lucide-react';
import { subjectAPI, sessionsAPI } from '@/services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUiStore } from '@/store';
import { usePageState } from '@/hooks/usePageState';
import { VIEW } from '@/components/exam/shared';
import DashboardView from '@/components/exam/DashboardView';
import ConfigView from '@/components/exam/ConfigView';
import BlueprintView from '@/components/exam/BlueprintView';
import QuizView from '@/components/exam/QuizView';
import ResultView from '@/components/exam/ResultView';
import ReviewView from '@/components/exam/ReviewView';
import HistoryView from '@/components/exam/HistoryView';

const PAGE_KEY = 'exam-analyzer';
const GENERATE_TIMEOUT_MS = 10 * 60 * 1000;

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ExamAnalyzerPage() {
  const { t } = useTranslation();
  const location  = useLocation();
  const navigate  = useNavigate();
  const { restore, persist, clear } = usePageState(PAGE_KEY);
  const [view, setView]               = useState(VIEW.HISTORY);
  const subjectId                     = useUiStore((s) => s.subjectFilterExam);
  const setSubjectFilter              = useUiStore((s) => s.setSubjectFilter);
  const setSubjectId                  = useCallback((v) => setSubjectFilter('exam', v), [setSubjectFilter]);
  const [analysis, setAnalysis]       = useState(null);
  const [blueprint, setBlueprint]     = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [evalData, setEvalData]       = useState(null);
  const [detailId, setDetailId]       = useState(null);
  const [pendingPlanTab, setPendingPlanTab] = useState(false);
  const [recommend, setRecommend]     = useState(null);
  const [generating, setGenerating]   = useState(null);
  const [quizClockStart, setQuizClockStart] = useState(null);
  const [restored, setRestored]       = useState(false);

  // ── Mount: restore saved state + pick up URL params ──
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // 1) Retry session from history
    if (params.get('retry') === '1') {
      const storedSession = sessionStorage.getItem('retry_session_data');
      const historyId     = sessionStorage.getItem('retry_history_session_id');
      if (storedSession) {
        try {
          const sd = JSON.parse(storedSession);
          setSessionData({ ...sd, _retry_history_id: historyId });
          setSubjectId(String(sd.subject_id || ''));
          setView(VIEW.QUIZ);
          sessionStorage.removeItem('retry_session_data');
          sessionStorage.removeItem('retry_history_session_id');
        } catch {}
      }
      navigate('/exam-analyzer', { replace: true });
      setRestored(true);
      return;
    }

    // 2) subject_id from URL (dashboard quick actions)
    const sid = params.get('subject_id');
    if (sid) setSubjectId(sid);

    // 3) Restore persisted page state
    const saved = restore();
    if (saved) {
      setView(saved.view ?? VIEW.HISTORY);
      if (saved.analysis != null) setAnalysis(saved.analysis);
      if (saved.blueprint != null) setBlueprint(saved.blueprint);
      if (saved.sessionData != null) setSessionData(saved.sessionData);
      if (saved.evalData != null) setEvalData(saved.evalData);
      if (saved.detailId != null) setDetailId(saved.detailId);
      if (saved.pendingPlanTab) setPendingPlanTab(true);
      if (saved.recommend != null) setRecommend(saved.recommend);
      if (saved.generating) setGenerating(saved.generating);
      if (saved.quizClockStart) setQuizClockStart(saved.quizClockStart);

      // Expired generating → clear
      if (saved.generating?.startedAt && Date.now() - saved.generating.startedAt > GENERATE_TIMEOUT_MS) {
        setGenerating(null);
        setView(VIEW.HISTORY);
      }
    }

    if (location.search) navigate('/exam-analyzer', { replace: true });
    setRestored(true);
  }, []);

  // ── Persist state on every change ──
  useEffect(() => {
    if (!restored) return;
    persist({ view, analysis, blueprint, sessionData, evalData, detailId, pendingPlanTab, recommend, generating, quizClockStart });
  }, [restored, view, analysis, blueprint, sessionData, evalData, detailId, pendingPlanTab, recommend, generating, quizClockStart]);

  // ── Polling: find generated session while generating ──
  useEffect(() => {
    if (!restored || !generating || view !== VIEW.GENERATING) return;
    let stop = false;
    let timer;
    const poll = async () => {
      try {
        const r = await sessionsAPI.list(subjectId || undefined);
        const found = (r.data?.sessions || []).find(s =>
          String(s.blueprint_id) === String(generating.blueprintId) &&
          s.status === 'active' &&
          Date.parse(s.created_at) >= generating.startedAt - 5000
        );
        if (found && !stop) {
          const d = await sessionsAPI.detail(found.id);
          const payload = { ...(d.data || {}), session_id: (d.data || {}).id };
          setGenerating(null);
          setSessionData(payload);
          setQuizClockStart(Date.now());
          go(VIEW.QUIZ);
          return;
        }
      } catch {}
      if (!stop) timer = setTimeout(poll, 3000);
    };
    timer = setTimeout(poll, 1500);
    return () => { stop = true; clearTimeout(timer); };
  }, [restored, view, generating, subjectId]);

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data),
  });
  const subjects = subjectData?.subjects || [];

  const go = (v) => setView(v);

  const handleAnalysisDone = (data) => { setAnalysis(data); go(VIEW.DASHBOARD); };
  const handleBlueprintDone = (data) => { setBlueprint(data); go(VIEW.BLUEPRINT); };
  const handleGenerating = () => { setGenerating({ blueprintId: blueprint?.blueprint_id, startedAt: Date.now() }); go(VIEW.GENERATING); };
  const handleSessionReady  = (data) => { setGenerating(null); setSessionData(data); setQuizClockStart(Date.now()); go(VIEW.QUIZ); };
  const handleEvalDone      = (data, answersSnapshot) => {
    if (answersSnapshot) setSessionData(prev => ({ ...prev, answers: answersSnapshot }));
    setEvalData(data);
    go(VIEW.RESULT);
  };

  const clearAll = () => { setAnalysis(null); setBlueprint(null); setSessionData(null); setEvalData(null); setGenerating(null); setQuizClockStart(null); setRecommend(null); clear(); };
  const resetToConfig = () => { clearAll(); go(VIEW.CONFIG); };
  const startConfigFor = (id) => { setSubjectId(id); clearAll(); go(VIEW.CONFIG); };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {view !== VIEW.DASHBOARD && subjectId && (
              <button onClick={() => {
                if (view === VIEW.GENERATING) {
                  if (!confirm(t('exam.confirmExit'))) return;
                  clearAll(); go(VIEW.HISTORY); return;
                }
                if (view === VIEW.QUIZ) {
                  if (!confirm(t('exam.confirmExit'))) return;
                  clearAll(); go(VIEW.HISTORY); return;
                }
                if (view === VIEW.HISTORY) {
                  setSubjectId('');
                  setAnalysis(null); setBlueprint(null); setSessionData(null); setEvalData(null);
                  setDetailId(null); setGenerating(null); setQuizClockStart(null); setRecommend(null); clear();
                  return;
                }
                if (view === VIEW.RESULT) {
                  setSubjectId('');
                  setAnalysis(null); setBlueprint(null); setSessionData(null); setEvalData(null);
                  setDetailId(null); setGenerating(null); setQuizClockStart(null); setRecommend(null); clear();
                  return;
                }
                const back = {
                  [VIEW.CONFIG]:     null,
                  [VIEW.BLUEPRINT]:  VIEW.CONFIG,
                  [VIEW.REVIEW]:     VIEW.RESULT,
                }[view] || null;
                if (back === null) { go(VIEW.HISTORY); return; }
                go(back);
              }} className="p-1.5 rounded-lg hover:bg-card text-text-secondary transition-colors">
                <ChevronLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-text flex items-center gap-2">
                <Brain size={22} className="text-primary" />
                {t('exam.title')}
                <span
                  className="badge badge-success text-[10px]"
                  title={t('exam.adaptiveBadgeHint')}
                >
                  <Zap size={9} className="inline mr-0.5" />
                  {t('exam.adaptiveBadge')}
                </span>
              </h1>
              <p className="text-text-secondary text-sm mt-0.5">
                {t('exam.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={subjectId}
              onChange={e => { setSubjectId(e.target.value); setAnalysis(null); setBlueprint(null); setSessionData(null); setEvalData(null); setRecommend(null); go(VIEW.HISTORY); }}
              className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
            >
              <option value="">{t('exam.selectSubjectPlaceholder')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {(view === VIEW.DASHBOARD || view === VIEW.HISTORY) && (
              <button
                onClick={() => {
                  if (!subjectId) return;
                  resetToConfig();
                }}
                disabled={!subjectId}
                className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Zap size={13} /> {t('exam.createSimulation')}
              </button>
            )}
          </div>
        </div>

        {/* ── View Router ── */}
        <AnimatePresence mode="wait">
          <motion.div key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {view === VIEW.DASHBOARD  && <DashboardView subjectId={subjectId} subjects={subjects} analysis={analysis} onAnalysisDone={handleAnalysisDone} onStartConfig={resetToConfig} />}
            {view === VIEW.CONFIG     && <ConfigView subjectId={subjectId} analysis={analysis} onDone={handleBlueprintDone} />}
            {view === VIEW.BLUEPRINT  && <BlueprintView blueprint={blueprint} onGenerate={handleSessionReady} onGenerating={handleGenerating} onBack={() => go(VIEW.CONFIG)} />}
            {view === VIEW.GENERATING && (
              <div className="card-base p-20 text-center">
                <Loader2 size={48} className="animate-spin text-primary mx-auto mb-6" />
                <h3 className="text-lg font-semibold text-text mb-2">{t('exam.blueprint.generatingTitle')}</h3>
                <p className="text-text-muted text-sm max-w-sm mx-auto">{t('exam.blueprint.generatingDesc', { strong: <strong className="text-text">1–3 menit</strong> })}</p>
              </div>
            )}
            {view === VIEW.QUIZ       && <QuizView sessionData={sessionData} clockStart={quizClockStart} onDone={handleEvalDone} />}
            {view === VIEW.RESULT     && <ResultView evalData={evalData} onReview={() => go(VIEW.REVIEW)} onFinish={() => { clearAll(); go(VIEW.HISTORY); }} sessionId={sessionData?.session_id} onOpenPlanTab={() => { setPendingPlanTab(true); setDetailId(sessionData?.session_id); }} subjectName={sessionData?.subject_name || ''} />}
            {view === VIEW.REVIEW     && <ReviewView sessionData={sessionData} evalData={evalData} />}
            {view === VIEW.HISTORY    && <HistoryView subjectId={subjectId} subjects={subjects} onSelectSubject={(id) => { setSubjectId(id); go(VIEW.HISTORY); }} onStartConfig={startConfigFor} onResume={(sd) => { setSessionData(sd); setQuizClockStart(Date.now()); go(VIEW.QUIZ); }} detailId={detailId} setDetailId={setDetailId} pendingPlanTab={pendingPlanTab} setPendingPlanTab={setPendingPlanTab} />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}
