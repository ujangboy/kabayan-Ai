import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Award, Target, FileText, CalendarCheck, Loader2 } from '@/icons';
import { sessionsAPI } from '@/services/api';
import MathMarkdown from '@/components/MathMarkdown';
import { extractErrorMessage } from '@/utils/errors';
import { useToast } from '@/components/Toast';
import { usePageState } from '@/hooks/usePageState';
import { fadeSlide } from '@/utils';
import { Modal, Button, EmptyState } from '@/components/ui';
import { StudyPlanItem } from '@/components/studyplan/StudyPlanItem';
import { formatItemDate } from '@/components/studyplan/shared';

export default function StudyPlanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
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

  if (!sessionId) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="nosession" {...fadeSlide} className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <EmptyState
            icon={CalendarCheck}
            title={t('studyplan.noSessionTitle', 'Belum ada rencana belajar')}
            description={t('studyplan.noSessionDesc', 'Buat Ujian Simulasi terlebih dahulu untuk mendapatkan rencana belajar yang dipersonalisasi.')}
            action={<button onClick={() => navigate('/exam-analyzer')} className="btn-primary">{t('nav.exam')}</button>}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  if (isLoading) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="loading" {...fadeSlide} className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-primary" />
        </motion.div>
      </AnimatePresence>
    );
  }

  if (error || !data) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="error" {...fadeSlide} className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-danger mb-4">Gagal memuat rencana belajar: {extractErrorMessage(error)}</p>
          <button onClick={() => navigate('/exam-analyzer')} className="btn-ghost border border-border">Kembali</button>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!plan) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="noplan" {...fadeSlide} className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <EmptyState
            title={t('studyplan.noPlan', 'Belum ada rencana belajar untuk sesi ini.')}
            action={<button onClick={() => navigate('/exam-analyzer')} className="btn-ghost border border-border">Kembali</button>}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  const inPracticeItem = practiceState ? practiceState.itemId : null;

  const handleOpenPractice = async (item) => {
    if (practiceState?.itemId === item.id) return;
    try {
      const r = await sessionsAPI.fetchPracticeQuestions(sessionId, item.topic);
      if (r.data?.detail) throw new Error(r.data.detail);
      if (!r.data?.questions?.length) throw new Error('Tidak ada soal tersedia untuk topik ini.');
      setPracticeState({ itemId: item.id, topic: item.topic, questions: r.data.questions });
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Gagal memuat soal latihan.');
    }
  };

  const handleGenerateSummary = async (item) => {
    if (isGeneratingSummary) return;
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
        setGeneratedSummaries(prev => ({ ...prev, [item.id]: { summary: sumData, topic: sumTopic } }));
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
  };

  const handleAskTutor = (item) => {
    const subjectName = data?.subject_name || '';
    navigate(`/chat?tutor=1&subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(item.topic)}`);
  };

  const handlePracticeClose = () => { setPracticeState(null); clear(); };
  const handlePracticeSubmitted = () => {
    setPracticeState(null); clear();
    queryClient.invalidateQueries(['session-detail', sessionId]);
    queryClient.invalidateQueries(['subject-dashboard']);
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key="plan" {...fadeSlide} className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="w-full space-y-6">
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
          {items.map((item) => (
            <StudyPlanItem
              key={item.id}
              item={item}
              planStartDate={plan.start_date}
              isPracticeOpen={inPracticeItem === item.id}
              summary={allSummaries[item.id]}
              generating={isGeneratingSummary === item.id}
              subjectId={subjectId}
              onToggle={(id) => toggleMutation.mutate(id)}
              onOpenPractice={handleOpenPractice}
              onGenerateSummary={handleGenerateSummary}
              onAskTutor={handleAskTutor}
              practiceState={practiceState}
              onPracticeClose={handlePracticeClose}
              onPracticeSubmitted={handlePracticeSubmitted}
            />
          ))}
        </div>
      </div>

      {/* SUMMARY MODAL */}
      <Modal
        open={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        size="lg"
        title={<span className="flex items-center gap-2"><FileText size={16} className="text-accent-blue" />Rangkuman: {summaryTopic}</span>}
        footer={<Button onClick={() => setSummaryModalOpen(false)}>Tutup</Button>}
      >
        <div className="prose prose-sm prose-invert max-w-none leading-relaxed text-text-secondary">
          <MathMarkdown>{summaryData || ''}</MathMarkdown>
        </div>
      </Modal>
    </motion.div>
    </AnimatePresence>
  );
}
