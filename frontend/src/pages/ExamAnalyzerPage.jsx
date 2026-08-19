import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronLeft, Zap } from '@/icons';
import { subjectAPI, sessionsAPI } from '@/services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUiStore } from '@/store';
import { cn } from '@/utils';
import { usePageState } from '@/hooks/usePageState';
import { VIEW } from '@/components/exam/shared';
import { Tooltip, Select, Modal } from '@/components/ui';
import { useToast } from '@/components/Toast';
import DashboardView from '@/components/exam/DashboardView';
import ConfigView from '@/components/exam/ConfigView';
import BlueprintView from '@/components/exam/BlueprintView';
import QuizView from '@/components/exam/QuizView';
import ResultView from '@/components/exam/ResultView';
import ReviewView from '@/components/exam/ReviewView';
import HistoryView from '@/components/exam/HistoryView';

const PAGE_KEY = 'exam-analyzer';
const GENERATE_TIMEOUT_MS = 10 * 60 * 1000;

// Rekonstruksi blueprint_items dari questions_json sesi yang ada,
// supaya tombol "Latihan Lagi" bisa memicu modal blueprint tanpa endpoint baru.
function deriveBlueprintItems(questions = []) {
  const map = new Map();
  questions.forEach((q) => {
    const topic = q.topic || 'Umum';
    if (!map.has(topic)) {
      map.set(topic, { topic, question_count: 0, question_types: new Set(), bloom_level: q.bloom_level || '', difficulty: q.difficulty || '', weight_percent: 0 });
    }
    const e = map.get(topic);
    e.question_count += 1;
    if (q.question_type) e.question_types.add(q.question_type);
  });
  const total = questions.length || 1;
  return [...map.values()].map((e) => ({
    topic: e.topic,
    question_count: e.question_count,
    question_types: [...e.question_types],
    bloom_level: e.bloom_level,
    difficulty: e.difficulty,
    weight_percent: Math.round((e.question_count / total) * 100),
  }));
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ExamAnalyzerPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
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

  // ── Modal state untuk Config & Blueprint (sesuai proposal unifikasi) ──
  const [configOpen, setConfigOpen]       = useState(false);
  const [blueprintModal, setBlueprintModal] = useState(null);

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
      const validViews = [VIEW.HISTORY, VIEW.DASHBOARD, VIEW.QUIZ, VIEW.RESULT, VIEW.REVIEW];
      setView(validViews.includes(saved.view) ? saved.view : VIEW.HISTORY);
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

  // ── Polling legacy (tidak dipakai di alur modal, tetap dipertahankan sebagai guard) ──
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
  const handleSessionReady  = (data) => { setGenerating(null); setSessionData(data); setQuizClockStart(Date.now()); go(VIEW.QUIZ); };
  const handleEvalDone      = (data, answersSnapshot) => {
    if (answersSnapshot) setSessionData(prev => ({ ...prev, answers: answersSnapshot }));
    setEvalData(data);
    go(VIEW.RESULT);
  };

  // ── Modal handlers (Config + Blueprint sebagai modal/drawer) ──
  const clearAll = () => { setAnalysis(null); setBlueprint(null); setSessionData(null); setEvalData(null); setGenerating(null); setQuizClockStart(null); setRecommend(null); clear(); };

  const openConfig = (id) => {
    if (id) setSubjectId(id);
    clearAll();
    setBlueprintModal(null);
    setConfigOpen(true);
  };
  const closeConfig = () => setConfigOpen(false);

  const handleConfigDone = (data) => {
    setBlueprint(data);
    setConfigOpen(false);
    setBlueprintModal(data);
  };
  const handleBlueprintBack = () => {
    setBlueprintModal(null);
    setConfigOpen(true);
  };
  const handleBlueprintGenerate = (data) => {
    setBlueprintModal(null);
    handleSessionReady(data);
  };
  // Progress generate ditangani di dalam BlueprintView (modal), tidak ganti view.
  const handleGenerating = () => {};

  // "Latihan Lagi" dari kartu riwayat → modal blueprint (reuse blueprint_id sesi).
  const handleRetry = async (session) => {
    if (!session.blueprint_id) {
      toast({ title: t('exam.history.retryNoBlueprint') || 'Konfigurasi tidak tersedia', message: t('exam.history.retryNoBlueprintDesc') || 'Buat simulasi baru untuk memulai.' });
      openConfig(session.subject_id || subjectId);
      return;
    }
    try {
      const d = (await sessionsAPI.detail(session.id)).data;
      const items = deriveBlueprintItems(d.questions_json || []);
      setBlueprintModal({ blueprint_id: session.blueprint_id, title: d.title || session.title, blueprint_items: items });
    } catch {
      openConfig(session.subject_id || subjectId);
    }
  };

  const showTabs = !!subjectId && (view === VIEW.HISTORY || view === VIEW.DASHBOARD);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {view !== VIEW.DASHBOARD && subjectId && (
              <Tooltip label={t('common.back')}>
                <button onClick={() => {
                  const confirmExit = () => new Promise((resolve) => {
                    toast.confirm({
                      title: t('exam.confirmExit'),
                      message: t('exam.confirmExit'),
                      danger: true,
                      confirmLabel: t('common.confirm'),
                      onConfirm: resolve,
                    });
                  });
                  const doExit = async () => {
                    if (view === VIEW.GENERATING) {
                      await confirmExit();
                      clearAll(); go(VIEW.HISTORY); return;
                    }
                    if (view === VIEW.QUIZ) {
                      await confirmExit();
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
                      [VIEW.REVIEW]:     VIEW.RESULT,
                    }[view] || null;
                    if (back === null) { go(VIEW.HISTORY); return; }
                    go(back);
                  };
                  doExit();
                }} aria-label={t('common.back')} className="p-1.5 rounded-lg hover:bg-card text-text-secondary transition-colors">
                  <ChevronLeft size={18} />
                </button>
              </Tooltip>
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
            <Select
              value={subjectId}
              onChange={e => { setSubjectId(e.target.value); setAnalysis(null); setBlueprint(null); setSessionData(null); setEvalData(null); setRecommend(null); go(VIEW.HISTORY); }}
            >
              <option value="">{t('exam.selectSubjectPlaceholder')}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            {(view === VIEW.DASHBOARD || view === VIEW.HISTORY) && (
              <button
                onClick={() => { if (!subjectId) return; openConfig(); }}
                disabled={!subjectId}
                className="btn-primary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Zap size={13} /> {t('exam.createSimulation')}
              </button>
            )}
          </div>
        </div>

        {/* ── Tab Riwayat / Analisis ── */}
        {showTabs && (
          <div className="flex gap-1 border-b border-border">
            {[
              { v: VIEW.HISTORY,  label: t('exam.history.tab') },
              { v: VIEW.DASHBOARD, label: t('exam.dashboard.tab') },
            ].map(tab => (
              <button
                key={tab.v}
                onClick={() => go(tab.v)}
                className={cn(
                  'relative px-4 py-2 text-sm font-medium transition-colors',
                  view === tab.v ? 'text-text' : 'text-text-secondary hover:text-text'
                )}
              >
                {tab.label}
                {view === tab.v && (
                  <motion.span layoutId="exam-tab-indicator" className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── View Router ── */}
        <AnimatePresence mode="wait">
          <motion.div key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {view === VIEW.DASHBOARD  && <DashboardView subjectId={subjectId} subjects={subjects} analysis={analysis} onAnalysisDone={handleAnalysisDone} onStartConfig={() => openConfig(subjectId)} />}
            {view === VIEW.HISTORY    && <HistoryView subjectId={subjectId} subjects={subjects} onSelectSubject={(id) => { setSubjectId(id); go(VIEW.HISTORY); }} onStartConfig={(id) => openConfig(id)} onRetry={handleRetry} onResume={(sd) => { setSessionData(sd); setQuizClockStart(Date.now()); go(VIEW.QUIZ); }} detailId={detailId} setDetailId={setDetailId} pendingPlanTab={pendingPlanTab} setPendingPlanTab={setPendingPlanTab} />}
            {view === VIEW.QUIZ       && <QuizView sessionData={sessionData} clockStart={quizClockStart} onDone={handleEvalDone} />}
            {view === VIEW.RESULT     && <ResultView evalData={evalData} onReview={() => go(VIEW.REVIEW)} onFinish={() => { clearAll(); go(VIEW.HISTORY); }} sessionId={sessionData?.session_id} onOpenPlanTab={() => { setPendingPlanTab(true); setDetailId(sessionData?.session_id); }} subjectName={sessionData?.subject_name || ''} />}
            {view === VIEW.REVIEW     && <ReviewView sessionData={sessionData} evalData={evalData} />}
          </motion.div>
        </AnimatePresence>

      </div>

      {/* ── Config modal ── */}
      <Modal open={configOpen} onClose={closeConfig} title={t('exam.config.title')} size="lg">
        {configOpen && <ConfigView subjectId={subjectId} analysis={analysis} onDone={handleConfigDone} />}
      </Modal>

      {/* ── Blueprint modal ── */}
      <Modal open={!!blueprintModal} onClose={() => setBlueprintModal(null)} title={blueprintModal?.title || t('exam.blueprint.title')} size="xl">
        {blueprintModal && (
          <BlueprintView
            blueprint={blueprintModal}
            onGenerate={handleBlueprintGenerate}
            onGenerating={handleGenerating}
            onBack={handleBlueprintBack}
          />
        )}
      </Modal>
    </div>
  );
}
