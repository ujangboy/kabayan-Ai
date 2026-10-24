import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { sessionsAPI } from '@/services/api';
import MathMarkdown from '@/components/MathMarkdown';
import { extractErrorMessage } from '@/utils/errors';
import { useToast } from '@/components/Toast';
import { usePageState } from '@/hooks/usePageState';
import { useHighlightScroll } from '@/hooks/useHighlightScroll';
import { cn, fadeSlide } from '@/utils';
import { Modal, Button, EmptyState, HelpTip, getSubjectPalette, Icon, Tooltip } from '@/components/ui';
import { StudyPlanItem } from '@/components/studyplan/StudyPlanItem';
import { formatItemDate } from '@/components/studyplan/shared';

function PlanCard({ plan, onOpen, t }) {
  const palette = getSubjectPalette(plan.subject_id);
  const nextItem = (plan.study_plan_items || []).find((i) => !i.completed);
  const total = plan.study_plan_total_items ?? (plan.study_plan_items || []).length;
  const done = plan.study_plan_completed_items ?? (plan.study_plan_items || []).filter((i) => i.completed).length;
  const progress = Math.max(0, Math.min(100, plan.study_plan_progress ?? 0));
  const startDate = plan.study_plan_start_date;
  const endLabel = startDate && total > 0 ? formatItemDate(startDate, total - 1) : '';

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'card-base card-hoverable relative flex w-full flex-col gap-4 overflow-hidden p-5 text-left'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', palette?.badge)}>
          <Icon name={ICONS.learning.calendarCheck} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <Tooltip label={plan.study_plan_title || plan.title}>
            <p className="truncate text-sm font-semibold text-text">
              {plan.study_plan_title || plan.title || t('nav.studyPlan')}
            </p>
          </Tooltip>
          <Tooltip label={plan.subject_name}>
            <p className="mt-0.5 truncate text-xs text-text-muted">{plan.subject_name || t('nav.subjects')}</p>
          </Tooltip>
        </div>
        <span className="shrink-0 text-sm font-bold text-text">{progress}%</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-wash">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-3xs text-text-muted">
        <span className="inline-flex items-center gap-1">
          <Icon name={ICONS.editor.listChecks} size={10} />
          {t('studyPlanPage.hub.items', { done, total })}
        </span>
        {startDate ? (
          <span className="inline-flex items-center gap-1">
            <Icon name={ICONS.learning.calendar} size={10} />
            {formatItemDate(startDate, 0)}{endLabel ? ` – ${endLabel}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Icon name={ICONS.learning.calendar} size={10} />
            {t('studyPlanPage.hub.emptyDate', 'Tanggal mulai belum diatur')}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <Tooltip label={nextItem?.topic}>
          <span className="min-w-0 truncate text-xs text-text-secondary">
            {nextItem ? t('studyPlanPage.hub.next', { topic: nextItem.topic || '—' }) : t('studyPlanPage.hub.done', 'Semua item selesai')}
          </span>
        </Tooltip>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-light">
          {nextItem ? t('studyPlanPage.hub.continue', 'Lanjutkan') : t('studyPlanPage.hub.open', 'Buka')}
          <Icon name={ICONS.actions.forward} size={13} />
        </span>
      </div>
    </motion.button>
  );
}

export default function StudyPlanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const rawSessionId = searchParams.get('session_id');
  const parsedSessionId = Number(rawSessionId);
  const sessionId = Number.isFinite(parsedSessionId) && parsedSessionId > 0 ? parsedSessionId : null;
  const { restore, persist, clear } = usePageState(`study-plan-${sessionId || 'hub'}`);
  const [startDate, setStartDate] = useState('');
  const [dateSaving, setDateSaving] = useState(false);
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

  // Hub: semua sesi yang sudah punya rencana belajar. Memakai endpoint sesi
  // terpadu agar tidak perlu endpoint baru hanya untuk daftar.
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['study-plans'],
    queryFn: () => sessionsAPI.list().then((r) => (r.data?.sessions || []).filter((s) => s.has_study_plan)),
    enabled: !sessionId,
  });
  const studyPlans = [...(plansData || [])].sort((a, b) => {
    const ad = a.study_plan_updated_at || a.created_at || '';
    const bd = b.study_plan_updated_at || b.created_at || '';
    return String(bd).localeCompare(String(ad));
  });

  const subjectId = data?.subject_id;

  useEffect(() => {
    if (data?.study_plan) setStartDate(data.study_plan.start_date || '');
  }, [data?.study_plan?.id, data?.study_plan?.start_date]);

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
  // Tanpa ?highlight → sorot otomatis 1 item berikutnya yang belum selesai (fallback).
  const lastWorked = items.find(i => !i.completed) || items.at(-1);
  const lastWorkedId = lastWorked ? `item-${lastWorked.id}` : null;
  const { activeId: highlightedItemId, missed: planItemMissed } = useHighlightScroll('highlight', { fallbackId: lastWorkedId });
  useEffect(() => {
    if (planItemMissed) toast.error(t('studyPlanPage.itemNotFound'));
  }, [planItemMissed, toast, t]);

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
        <motion.div key="hub" {...fadeSlide} className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="mx-auto w-full max-w-5xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-1 text-3xs font-semibold uppercase tracking-[0.16em] text-primary-light">
                  {t('nav.studyPlan')}
                </p>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
                  {t('studyPlanPage.hub.title', 'Rencana Belajar')}
                  <HelpTip label={t('help.studyPlan')} />
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                  {t('studyPlanPage.hub.subtitle', 'Semua rencana dari ujian simulasimu, lengkap dengan progres dan tanggal mulai.')}
                </p>
              </div>
              <Button onClick={() => navigate('/exam-analyzer')} className="inline-flex shrink-0 items-center justify-center gap-2 bg-primary-solid hover:bg-primary-solid-hover">
                <Icon name={ICONS.nav.exam} size={16} />
                {t('studyPlanPage.hub.newPlan', 'Buat Rencana Baru')}
              </Button>
            </div>

            {plansLoading ? (
              <div className="flex items-center justify-center rounded-2xl border border-border bg-surface-2 py-20">
                <Icon name={ICONS.status.loading} size={28} className="animate-spin text-primary" />
              </div>
            ) : studyPlans.length > 0 ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {studyPlans.map((p) => {
                    const next = (p.study_plan_items || []).find((i) => !i.completed);
                    return (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        t={t}
                        onOpen={() => navigate(`/study-plan?session_id=${p.id}${next ? `&highlight=item-${next.id}` : ''}`)}
                      />
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-border bg-surface-2 p-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    {t('studyPlanPage.hub.howTo', 'Cara pakai')}
                  </p>
                  <ol className="grid gap-3 text-sm text-text-secondary sm:grid-cols-3">
                    {[1, 2, 3].map((n) => (
                      <li key={n} className="flex items-start gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs font-bold text-primary-light">{n}</span>
                        <span>{t(`studyPlanPage.empty.step${n}`)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className="flex flex-col items-center gap-6 rounded-lg border border-border bg-surface-2 p-8 text-center md:p-10"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary-light">
                  <Icon name={ICONS.learning.calendarCheck} size={36} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-tight text-text md:text-2xl">{t('studyPlanPage.empty.title')}</h2>
                  <p className="mx-auto max-w-md text-15 leading-relaxed text-text-secondary">{t('studyPlanPage.empty.desc')}</p>
                </div>

                <ol className="w-full max-w-[420px] divide-y divide-border rounded-xl border border-border bg-wash px-2 text-left">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="flex items-center gap-4 px-2 py-3.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-bold text-primary-light">{n}</span>
                      <span className="text-sm text-text-secondary">{t(`studyPlanPage.empty.step${n}`)}</span>
                    </li>
                  ))}
                </ol>

                <div className="flex w-full flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
                  <Button
                    onClick={() => navigate('/exam-analyzer')}
                    size="lg"
                    className="inline-flex min-w-[200px] flex-1 items-center justify-center gap-2 bg-primary-solid hover:bg-primary-solid-hover sm:flex-initial"
                  >
                    <Icon name={ICONS.nav.exam} size={18} />
                    {t('studyPlanPage.empty.ctaPrimary', 'Kerjakan Ujian Simulasi')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() => navigate('/materi')}
                    className="inline-flex min-w-[160px] flex-1 items-center justify-center gap-1.5 border-border bg-subtle hover:border-primary/30 hover:bg-subtle sm:flex-initial"
                  >
                    <Icon name={ICONS.files.document} size={16} className="text-text-secondary" />
                    {t('studyPlanPage.empty.ctaSecondary', 'Lihat Materi')}
                  </Button>
                </div>

                <p className="text-xs text-text-muted">{t('studyPlanPage.empty.hint')}</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (isLoading) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="loading" {...fadeSlide} className="flex-1 flex items-center justify-center">
          <Icon name={ICONS.status.loading} size={32} className="animate-spin text-primary" />
        </motion.div>
      </AnimatePresence>
    );
  }

  if (error || !data) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="error" {...fadeSlide} className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-danger mb-4">{t('studyPlanPage.loadFailed', { error: extractErrorMessage(error) })}</p>
          <Button onClick={() => navigate('/exam-analyzer')} className="border border-border" variant="ghost">{t('common.back')}</Button>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!plan) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key="noplan" {...fadeSlide} className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <EmptyState
            title={t('studyPlanPage.noPlan')}
            action={<Button onClick={() => navigate('/exam-analyzer')} className="border border-border" variant="ghost">{t('common.back')}</Button>}
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
      if (!r.data?.questions?.length) throw new Error(t('studyPlanPage.noQuestions'));
      setPracticeState({ itemId: item.id, topic: item.topic, questions: r.data.questions });
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || t('studyPlanPage.questionsFailed'));
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
        throw new Error(t('studyPlanPage.summaryEmpty'));
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || t('studyPlanPage.summaryFailed'));
    } finally {
      setIsGeneratingSummary(null);
    }
  };

  const handleAskTutor = (item) => {
    const subjectName = data?.subject_name || '';
    navigate(`/chat?tutor=1&subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(item.topic)}`);
  };

  const handleStartDateChange = async (value) => {
    const previous = startDate;
    setStartDate(value);
    setDateSaving(true);
    try {
      await sessionsAPI.updatePlanStartDate(sessionId, value || null);
      queryClient.invalidateQueries(['session-detail', sessionId]);
      queryClient.invalidateQueries(['study-plans']);
      toast.success(t('studyPlanPage.dateSaved', 'Tanggal mulai tersimpan.'));
    } catch (err) {
      setStartDate(previous);
      toast.error(extractErrorMessage(err) || t('studyPlanPage.dateSaveFailed', 'Gagal menyimpan tanggal mulai.'));
    } finally {
      setDateSaving(false);
    }
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
          <Button onClick={() => navigate('/exam-analyzer')} className="px-3 py-2 rounded-xl text-sm" variant="ghost">
            <Icon name={ICONS.actions.back} size={16} /> {t('common.back')}
          </Button>
          <Button onClick={() => navigate('/study-plan')} className="px-3 py-2 rounded-xl text-sm" variant="secondary">
            <Icon name={ICONS.editor.listChecks} size={15} /> {t('studyPlanPage.hub.allPlans', 'Semua Rencana')}
          </Button>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              {plan.title || t('nav.studyPlan')}
              <HelpTip label={t('help.studyPlan')} />
            </h1>
            <p className="text-text-secondary text-sm mt-0.5">
              {data.subject_name || t('nav.subjects')}
              {plan.start_date ? ` • ${t('studyPlanPage.startDate', { date: formatItemDate(plan.start_date, 0) })}` : ''}
              {(data.created_at || data.started_at) ? ` • ${t('studyPlanPage.createdOn', {
                date: new Date(data.created_at || data.started_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
              })}` : ''}
            </p>
            {data.material_names?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {data.material_names.map((name, i) => (
                  <Tooltip key={i} label={name}>
                    <span className="inline-flex items-center gap-1 text-3xs px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[240px]">
                      <Icon name={ICONS.files.document} size={9} className="shrink-0" />{name}
                    </span>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        </div>

        {plan.motivational_message && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 flex items-start gap-3">
            <Icon name={ICONS.learning.certificate} size={18} className="text-primary mt-0.5 shrink-0" />
            <p className="text-15 text-text">{plan.motivational_message}</p>
          </div>
        )}

        {/* Progress */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
          <div className="flex justify-between text-xs text-text-muted mb-2">
            <span className="flex items-center gap-1.5">
              <Icon name={ICONS.learning.target} size={12} className="text-primary" />
              {t('studyPlanPage.progressTitle')}
            </span>
            <span className="font-semibold text-text-secondary">
              {progress >= 100 ? <span className="flex items-center gap-1"><Icon name={ICONS.learning.certificate} size={12} className="text-success" /> {t('studyPlanPage.completedTitle')}</span> : t('studyPlanPage.dayProgress', { completed: completedItems, total: totalItems, progress })}
            </span>
          </div>
          <div className="h-3 bg-background rounded-full overflow-hidden border border-border">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6 }}
              className={`h-full rounded-full ${progress >= 100 ? 'bg-success' : 'bg-primary'}`}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Icon name={ICONS.learning.calendar} size={14} className="shrink-0 text-text-muted" />
            <label htmlFor="plan-start-date" className="text-xs font-medium text-text-secondary">
              {t('studyPlanPage.hub.startDateLabel', 'Tanggal mulai')}
            </label>
            <input
              id="plan-start-date"
              type="date"
              value={startDate}
              disabled={dateSaving}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="input-base w-auto py-1.5 text-xs"
            />
            {dateSaving && <Icon name={ICONS.status.loading} size={13} className="animate-spin text-primary" />}
            <span className="text-3xs text-text-muted">
              {t('studyPlanPage.hub.startDateHint', 'Geser tanggal untuk mengatur ulang jadwal. Progresmu tetap aman.')}
            </span>
          </div>
          {(plan.priority_actions || []).length > 0 && (
            <div className="mt-4 pt-4 border-t border-border space-y-1.5">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{t('common.priorityActions')}</p>
              {(plan.priority_actions || []).map((a, i) => (
                <p key={i} className="text-xs text-text flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                  {a}
                </p>
              ))}
            </div>
          )}
        </motion.div>

        {/* Items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              id={`highlight-item-${item.id}`}
              className={highlightedItemId === `item-${item.id}` ? 'rounded-2xl ring-2 ring-warning/60 bg-warning/5 animate-pulse' : ''}
            >
            <StudyPlanItem
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
            </div>
          ))}
        </div>
      </div>

      {/* SUMMARY MODAL */}
      <Modal
        open={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
        size="lg"
        title={<span className="flex items-center gap-2"><Icon name={ICONS.files.document} size={16} className="text-accent-blue" />{t('studyPlanPage.summaryTitle', { topic: summaryTopic })}</span>}
        footer={<Button onClick={() => setSummaryModalOpen(false)}>{t('common.close')}</Button>}
      >
        <div className="prose prose-sm prose-invert max-w-none leading-relaxed text-text-secondary">
          <MathMarkdown>{summaryData || ''}</MathMarkdown>
        </div>
      </Modal>
    </motion.div>
    </AnimatePresence>
  );
}