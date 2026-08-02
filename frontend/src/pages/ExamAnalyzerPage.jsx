import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronLeft, Zap } from 'lucide-react';
import { subjectAPI } from '@/services/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { VIEW } from '@/components/exam/shared';
import DashboardView from '@/components/exam/DashboardView';
import ConfigView from '@/components/exam/ConfigView';
import BlueprintView from '@/components/exam/BlueprintView';
import QuizView from '@/components/exam/QuizView';
import ResultView from '@/components/exam/ResultView';
import ReviewView from '@/components/exam/ReviewView';
import HistoryView from '@/components/exam/HistoryView';

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ExamAnalyzerPage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [view, setView]               = useState(VIEW.HISTORY);
  const [subjectId, setSubjectId]     = useState('');
  const [analysis, setAnalysis]       = useState(null);
  const [blueprint, setBlueprint]     = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [evalData, setEvalData]       = useState(null);
  const [detailId, setDetailId]       = useState(null);
  const [pendingPlanTab, setPendingPlanTab] = useState(false);
  const [recommend, setRecommend]     = useState(null);

  // ── Pick up retry session from Exam History ──
  useEffect(() => {
    const params = new URLSearchParams(location.search);
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
      // Clean up the URL param without a full reload
      navigate('/exam-analyzer', { replace: true });
    }
  }, []);

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data),
  });
  const subjects = subjectData?.subjects || [];

  const go = (v) => setView(v);

  const handleAnalysisDone = (data) => { setAnalysis(data); go(VIEW.DASHBOARD); };
  const handleBlueprintDone = (data) => { setBlueprint(data); go(VIEW.BLUEPRINT); };
  const handleSessionReady  = (data) => { setSessionData(data); go(VIEW.QUIZ); };
  const handleEvalDone      = (data, answersSnapshot) => {
    // Merge answers snapshot into sessionData so ResultView can persist them
    if (answersSnapshot) setSessionData(prev => ({ ...prev, answers: answersSnapshot }));
    setEvalData(data);
    go(VIEW.RESULT);
  };

  const resetToConfig = () => { setBlueprint(null); setSessionData(null); setEvalData(null); go(VIEW.CONFIG); };
  const startConfigFor = (id) => { setSubjectId(id); setAnalysis(null); setBlueprint(null); setSessionData(null); setEvalData(null); go(VIEW.CONFIG); };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {view !== VIEW.DASHBOARD && subjectId && (
              <button onClick={() => {
                if (view === VIEW.GENERATING) return;
                if (view === VIEW.QUIZ) {
                  if (!confirm('Yakin ingin keluar? Progres ujian ini akan hilang.')) return;
                  setSubjectId(''); setSessionData(null); go(VIEW.HISTORY); return;
                }
                const back = {
                  [VIEW.CONFIG]:     null,
                  [VIEW.BLUEPRINT]:  VIEW.CONFIG,
                  [VIEW.RESULT]:     VIEW.HISTORY,
                  [VIEW.REVIEW]:     VIEW.RESULT,
                  [VIEW.HISTORY]:    null,
                }[view] || null;
                if (back === null) { setSubjectId(''); go(VIEW.HISTORY); return; }
                go(back);
              }} className="p-1.5 rounded-lg hover:bg-card text-text-secondary transition-colors">
                <ChevronLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-text flex items-center gap-2">
                <Brain size={22} className="text-primary" />
                Exam Analyzer
              </h1>
              <p className="text-text-secondary text-sm mt-0.5">
                Analisis cerdas seluruh materi &amp; simulasi ujian berbasis AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={subjectId}
              onChange={e => { setSubjectId(e.target.value); setAnalysis(null); setBlueprint(null); setSessionData(null); setEvalData(null); setRecommend(null); go(VIEW.HISTORY); }}
              className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
            >
              <option value="">-- Pilih Mata Kuliah --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {(view === VIEW.DASHBOARD || view === VIEW.HISTORY) && subjectId && (
              <button onClick={resetToConfig} className="btn-primary text-xs">
                <Zap size={13} /> Buat Simulasi
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
            {view === VIEW.BLUEPRINT  && <BlueprintView blueprint={blueprint} onGenerate={handleSessionReady} onBack={() => go(VIEW.CONFIG)} />}
            {view === VIEW.QUIZ       && <QuizView sessionData={sessionData} onDone={handleEvalDone} />}
            {view === VIEW.RESULT     && <ResultView evalData={evalData} onReview={() => go(VIEW.REVIEW)} onFinish={() => go(VIEW.HISTORY)} sessionId={sessionData?.session_id} onOpenPlanTab={() => { setPendingPlanTab(true); setDetailId(sessionData?.session_id); }} />}
            {view === VIEW.REVIEW     && <ReviewView sessionData={sessionData} evalData={evalData} />}
            {view === VIEW.HISTORY    && <HistoryView subjectId={subjectId} subjects={subjects} onSelectSubject={(id) => { setSubjectId(id); go(VIEW.HISTORY); }} onStartConfig={startConfigFor} onResume={(sd) => { setSessionData(sd); go(VIEW.QUIZ); }} detailId={detailId} setDetailId={setDetailId} pendingPlanTab={pendingPlanTab} setPendingPlanTab={setPendingPlanTab} />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}
