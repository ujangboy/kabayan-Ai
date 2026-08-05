import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, Plus, X, Book, Zap, Loader2, Play,
  Trash2, ChevronLeft, ChevronRight, RotateCcw, Trophy, Clock, Calendar, FileText, Brain, Sparkles
} from 'lucide-react';
import { flashcardAPI, subjectAPI } from '@/services/api';
import { useUiStore } from '@/store';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/utils/errors';
import MathMarkdown from '@/components/MathMarkdown';
import MaterialPicker from '@/components/MaterialPicker';
import { formatDate, formatDateTime, formatTimeOnly } from '@/utils';
import { usePendingOperation } from '@/hooks/usePendingOperation';

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function FlashcardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState(null); // null = list view
  const [historyBatchId, setHistoryBatchId] = useState(null); // null = no history modal
  const subjectFilter = useUiStore((s) => s.subjectFilterFlashcard);
  const setSubjectFilter = useUiStore((s) => s.setSubjectFilter);

  const { data: flashcardData, isLoading } = useQuery({
    queryKey: ['flashcards'],
    queryFn: () => flashcardAPI.getAll().then(r => r.data),
  });

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data),
  });

  const allFlashcards = flashcardData?.flashcards || [];
  const subjects = subjectData?.subjects || [];

  // Group flashcards by batch_id — setiap generate = deck terpisah
  const batchGroups = {};
  for (const f of allFlashcards) {
    const bid = f.batch_id || `legacy-${f.subject?.id ?? 0}`;
    if (!batchGroups[bid]) {
      batchGroups[bid] = {
        batch_id: bid,
        subject: f.subject || { id: 0, name: 'Umum' },
        cards: [],
      };
    }
    batchGroups[bid].cards.push(f);
  }
  // Urutkan: deck terbaru di atas (berdasarkan created_at kartu pertama)
  const groups = Object.values(batchGroups).sort((a, b) => {
    const aTime = new Date(a.cards[0]?.created_at || 0);
    const bTime = new Date(b.cards[0]?.created_at || 0);
    return bTime - aTime;
  });
  const filteredGroups = subjectFilter
    ? groups.filter((g) => String(g.subject?.id) === subjectFilter)
    : groups;

  const clearAllMutation = useMutation({
    mutationFn: () => flashcardAPI.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries(['flashcards']);
      toast.success(t('flashcard.allDeleted'));
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const handleClearAll = () => {
    if (confirm(t('flashcard.confirmClearAll'))) clearAllMutation.mutate();
  };

  // Jika deck aktif, tampilkan session view
  if (activeBatchId !== null) {
    const group = groups.find(g => g.batch_id === activeBatchId);
    const cards = group?.cards || [];
    return (
      <FlashcardSession
        cards={cards}
        subjectName={group?.subject?.name || t('flashcard.defaultName')}
        onClose={() => {
          setActiveBatchId(null);
          queryClient.invalidateQueries(['flashcards']);
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">{t('flashcard.pageTitle')}</h1>
            <p className="text-text-secondary text-sm mt-1">{t('flashcard.pageSubtitle')}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {(() => {
              const totalDue = filteredGroups.reduce((sum, g) =>
                sum + g.cards.filter(c => !c.mastered && (c.times_seen === 0 || (c.next_review && new Date(c.next_review) <= new Date()))).length, 0
              );
              return (
                <button
                  onClick={() => navigate('/flashcard/review')}
                  className="btn-ghost border border-accent-purple/40 text-accent-purple text-xs"
                >
                  <Brain size={14} />
                  {totalDue > 0 ? t('flashcard.reviewCount', { count: totalDue }) : t('flashcard.reviewSrs')}
                </button>
              );
            })()}
            <button onClick={() => setIsAIModalOpen(true)} className="btn-primary text-xs">
              <Zap size={14} /> {t('flashcard.generateAi')}
            </button>
            <button onClick={() => setIsManualModalOpen(true)} className="btn-ghost border border-border text-xs">
              <Plus size={14} /> {t('flashcard.manual')}
            </button>
            {allFlashcards.length > 0 && (
              <button onClick={handleClearAll} className="btn-ghost text-danger border border-danger/20 text-xs">
                {t('flashcard.deleteAll')}
              </button>
            )}
          </div>
        </div>

        {/* Filter Mata Kuliah */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter('flashcard', e.target.value)}
              className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">{t('flashcard.filterAllSubjects')}</option>
              {[...subjects].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })).map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
            <span className="text-xs text-text-muted">
              {t('flashcard.showingCount', { shown: filteredGroups.length, total: groups.length })}
            </span>
          </div>
        </div>

        {/* Group Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-10 text-text-muted">{t('flashcard.loading')}</div>
          ) : groups.length === 0 ? (
            <div className="col-span-full card-base p-10 text-center">
              <CreditCard size={48} className="mx-auto mb-4 text-text-muted opacity-50" />
<p className="text-text-muted mb-4">{t('flashcard.emptyState')}</p>
              <button onClick={() => setIsAIModalOpen(true)} className="btn-primary text-sm">
                <Zap size={14} /> {t('flashcard.generateAi')}
              </button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="col-span-full card-base p-10 text-center">
              <p className="text-text-muted">{t('flashcard.noDeckForSubject')}</p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <BatchFlashcardCard
                key={group.batch_id}
                group={group}
                onStart={() => setActiveBatchId(group.batch_id)}
                onReview={() => navigate(`/flashcard/review?subject_id=${group.subject.id}`)}
                onHistory={() => setHistoryBatchId(group.batch_id)}
                onDeleteAll={() => {
                  if (confirm(t('flashcard.confirmDeleteDeck', { count: group.cards.length }))) {
                    const ids = group.cards.map(c => c.id);
                    flashcardAPI.batchDelete(ids)
                      .then(() => queryClient.invalidateQueries(['flashcards']));
                  }
                }}
              />
            ))
          )}
        </div>

      </div>

      <AnimatePresence>
        {isAIModalOpen && (
          <GenerateAIModal
            subjects={subjects}
            onClose={() => setIsAIModalOpen(false)}
            onSuccess={(batchId) => {
              setIsAIModalOpen(false);
              queryClient.invalidateQueries(['flashcards']);
              // langsung masuk session deck yang baru di-generate
              setTimeout(() => setActiveBatchId(batchId), 400);
            }}
          />
        )}
        {isManualModalOpen && (
          <CreateFlashcardModal
            subjects={subjects}
            onClose={() => setIsManualModalOpen(false)}
            onSuccess={() => {
              setIsManualModalOpen(false);
              queryClient.invalidateQueries(['flashcards']);
            }}
          />
        )}
        {historyBatchId !== null && (
          <ReviewHistoryModal
            group={groups.find(g => g.batch_id === historyBatchId)}
            onClose={() => setHistoryBatchId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card component for each batch (deck) — setiap generate = satu card
// ─────────────────────────────────────────────────────────────────────────────
function BatchFlashcardCard({ group, onStart, onReview, onHistory, onDeleteAll }) {
  const { t } = useTranslation();
  const { subject, cards } = group;
  // Ambil created_at terbaru dari kartu dalam deck
  const latestCard = cards.reduce((a, b) =>
    new Date(b.created_at || 0) > new Date(a.created_at || 0) ? b : a, cards[0]);
  const createdAt = latestCard?.created_at;

  // Kumpulkan nama materi unik dari semua kartu di deck
  const allMaterialNames = [...new Set(
    cards.flatMap(c => c.material_names || []).filter(Boolean)
  )];

  // ─── Statistik SRS dari data kartu ───
  const masteredCount = cards.filter(c => c.mastered).length;
  const newCount = cards.filter(c => !c.times_seen).length;
  const dueCount = cards.filter(c => !c.mastered && (c.times_seen === 0 || (c.next_review && new Date(c.next_review) <= new Date()))).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-base p-5 flex flex-col"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          {/* Label "Mata Kuliah" */}
          <div className="text-[10px] font-semibold text-accent-teal uppercase tracking-wider mb-1">
            {t('flashcard.subjectLabel')}
          </div>
          <h3 className="font-semibold text-text text-sm truncate">{subject.name}</h3>
        </div>
        <button
          onClick={onDeleteAll}
          className="p-1 text-text-muted hover:text-danger transition-colors shrink-0 ml-2"
          title={t('flashcard.deleteAllCardsTitle')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-2 text-xs text-text-secondary flex-wrap">
        <span className="flex items-center gap-1">
          <CreditCard size={12} />
          {t('flashcard.cardCount', { count: cards.length })}
        </span>
        <span className="flex items-center gap-1">
          <Book size={12} />
          {t('flashcard.flipRecall')}
        </span>
        {masteredCount > 0 && (
          <span className="flex items-center gap-1 text-success">
            <Trophy size={11} />
            {t('flashcard.masteredCount', { count: masteredCount })}
          </span>
        )}
        {newCount > 0 && (
          <span className="flex items-center gap-1 text-accent-blue">
            <Sparkles size={11} />
            {t('flashcard.newCount', { count: newCount })}
          </span>
        )}
      </div>

      {dueCount > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="badge badge-warning text-[10px]">
            {t('flashcard.dueCount', { count: dueCount })}
          </span>
        </div>
      )}

      {/* Nama materi yang digunakan */}
      {allMaterialNames.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {allMaterialNames.slice(0, 3).map((name, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[220px]">
              <FileText size={8} className="shrink-0" />{name}
            </span>
          ))}
          {allMaterialNames.length > 3 && (
            <span className="text-[10px] text-text-muted self-center">{t('flashcard.moreMaterials', { count: allMaterialNames.length - 3 })}</span>
          )}
        </div>
      )}

      {/* Tanggal + waktu dibuat */}
      {createdAt && (
        <div className="flex items-center gap-3 mb-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <Calendar size={9} />
            {formatDate(createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {formatTimeOnly(createdAt)}
          </span>
        </div>
      )}

      {/* Mini preview of first card */}
      {cards[0] && (
        <div className="bg-background rounded-lg p-3 mb-4 border border-border text-xs text-text-secondary line-clamp-2">
          <MathMarkdown>{cards[0].question}</MathMarkdown>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        {dueCount > 0 && (
          <button
            onClick={onReview}
            className="flex-1 justify-center text-xs px-3 py-2 rounded-lg border border-accent-purple/40 text-accent-purple font-semibold hover:bg-accent-purple/10 transition-colors flex items-center gap-1.5"
          >
            <Brain size={12} /> {t('flashcard.review')}
          </button>
        )}
        <button
          onClick={onStart}
          className={`${dueCount > 0 ? 'flex-[2]' : 'flex-1'} btn-primary justify-center text-xs px-3 py-2`}
        >
          <Play size={12} /> {t('flashcard.startLearning')}
        </button>
      </div>

      {/* Riwayat review per kartu */}
      <button
        onClick={onHistory}
        className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-text-muted hover:text-accent-teal transition-colors py-1"
      >
        <Clock size={11} /> {t('flashcard.reviewHistory')}
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session view — study mode
// ─────────────────────────────────────────────────────────────────────────────
function FlashcardSession({ cards, subjectName, onClose }) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [isFinished, setIsFinished] = useState(false);
  const [feedback, setFeedback] = useState(null); // { known, srs }
  const [autoAdvanceProgress, setAutoAdvanceProgress] = useState(0); // 0-100 untuk animasi bar
  const [rerunQueue, setRerunQueue] = useState([]);
  const rerunCountRef = useRef({});
  const autoAdvanceTimerRef = useRef(null);
  const autoAdvanceIntervalRef = useRef(null);
  const MAX_RERUN = 3;
  const AUTO_ADVANCE_MS = 1500;

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => flashcardAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['flashcards']),
    onError: (err) => console.error('Failed to delete flashcard:', err),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, rating }) => flashcardAPI.review(id, rating),
    onError: (err) => console.error('Failed to review flashcard:', err),
  });

  const total = cards.length + rerunQueue.length;
  const currentCard = currentIndex < cards.length ? cards[currentIndex] : rerunQueue[currentIndex - cards.length];

  // Bersihkan timer auto-advance saat unmount
  useEffect(() => {
    return () => {
      clearTimeout(autoAdvanceTimerRef.current);
      clearInterval(autoAdvanceIntervalRef.current);
    };
  }, []);

  const goNext = useCallback(() => {
    setFeedback(null);
    setAutoAdvanceProgress(0);
    setIsFlipped(false);
    setTimeout(() => {
      const nextIdx = currentIndex + 1;
      if (nextIdx < cards.length + rerunQueue.length) {
        setCurrentIndex(nextIdx);
      } else {
        setIsFinished(true);
      }
    }, 150);
  }, [currentIndex, cards.length, rerunQueue.length]);

  const goPrev = useCallback(() => {
    clearTimeout(autoAdvanceTimerRef.current);
    clearInterval(autoAdvanceIntervalRef.current);
    setFeedback(null);
    setAutoAdvanceProgress(0);
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(i => i - 1), 150);
    }
  }, [currentIndex]);

  // Mulai auto-advance: animasi progress bar lalu goNext otomatis
  const startAutoAdvance = useCallback((nextFn) => {
    setAutoAdvanceProgress(0);
    const startTime = Date.now();
    clearInterval(autoAdvanceIntervalRef.current);
    autoAdvanceIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / AUTO_ADVANCE_MS) * 100);
      setAutoAdvanceProgress(pct);
      if (pct >= 100) clearInterval(autoAdvanceIntervalRef.current);
    }, 30);
    clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      clearInterval(autoAdvanceIntervalRef.current);
      nextFn();
    }, AUTO_ADVANCE_MS);
  }, []);

  const handleKnow = () => {
    setKnown(prev => new Set([...prev, currentCard.id]));
    setFeedback({ known: true });
    setIsFlipped(true);
    reviewMutation.mutate({ id: currentCard.id, rating: 3 });
    startAutoAdvance(goNext);
  };

  const handleDontKnow = () => {
    setFeedback({ known: false });
    setIsFlipped(true);
    reviewMutation.mutate({ id: currentCard.id, rating: 0 }, {
      onSuccess: (data) => {
        if (data?.rerun) {
          const count = (rerunCountRef.current[currentCard.id] || 0) + 1;
          rerunCountRef.current[currentCard.id] = count;
          if (count <= MAX_RERUN) {
            setRerunQueue(q => [...q, { ...currentCard, _rerunCount: count }]);
          }
        }
      },
    });
    startAutoAdvance(goNext);
  };

  const handleSkipAutoAdvance = () => {
    clearTimeout(autoAdvanceTimerRef.current);
    clearInterval(autoAdvanceIntervalRef.current);
    goNext();
  };

  const handleRestart = () => {
    clearTimeout(autoAdvanceTimerRef.current);
    clearInterval(autoAdvanceIntervalRef.current);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnown(new Set());
    setIsFinished(false);
    setFeedback(null);
    setAutoAdvanceProgress(0);
    setRerunQueue([]);
    rerunCountRef.current = {};
  };

  const handleDeleteCard = () => {
    if (confirm(t('flashcard.confirmDeleteCard'))) {
      clearTimeout(autoAdvanceTimerRef.current);
      clearInterval(autoAdvanceIntervalRef.current);
      deleteMutation.mutate(currentCard.id);
      setFeedback(null);
      setAutoAdvanceProgress(0);
      if (currentIndex >= total - 1) {
        if (total === 1) { onClose(); } else { setCurrentIndex(total - 2); }
      }
      setIsFlipped(false);
    }
  };

  // Finished screen
  if (isFinished) {
    const knownCount = known.size;
    const pct = Math.round((knownCount / total) * 100);
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="card-base text-center max-w-sm w-full p-8"
        >
          <Trophy size={48} className="mx-auto text-warning mb-4" />
          <h2 className="text-xl font-bold text-text mb-1">{t('flashcard.sessionComplete')}</h2>
          <p className="text-text-secondary text-sm mb-6">{subjectName}</p>
          <div className="text-5xl font-bold text-primary mb-2">{pct}%</div>
          <p className="text-sm text-text-secondary mb-6">
            {t('flashcard.sessionResult', { knownCount, total })}
          </p>
          <div className="flex gap-2">
            <button onClick={handleRestart} className="btn-primary flex-1 justify-center text-sm">
              <RotateCcw size={14} /> {t('flashcard.retry')}
            </button>
            <button onClick={onClose} className="btn-ghost flex-1 justify-center text-sm border border-border">
              {t('flashcard.done')}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-text-muted">
          <p className="mb-4">{t('flashcard.noCards')}</p>
          <button onClick={onClose} className="btn-ghost border border-border">{t('common.back')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-6 md:p-10">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <button onClick={onClose} className="btn-ghost text-sm text-text-muted">
          <ChevronLeft size={16} /> {t('common.back')}
        </button>
        <div className="text-sm text-text-secondary font-medium">{subjectName}</div>
        <span className="px-3 py-1 bg-card rounded-full text-sm font-medium text-text-secondary border border-border">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-border rounded-full mb-8 shrink-0">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div
          className="perspective-1000 w-full max-w-xl cursor-pointer"
          style={{ height: '280px' }}
          onClick={() => setIsFlipped(f => !f)}
        >
          <motion.div
            className="w-full h-full relative preserve-3d"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.55, type: 'spring', stiffness: 280, damping: 22 }}
          >
            {/* Front */}
            <div className="absolute inset-0 backface-hidden card-base flex flex-col items-center justify-center p-8 text-center border-t-4 border-t-primary shadow-xl">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">{t('flashcard.question')}</span>
              <MathMarkdown className="text-xl font-bold text-text leading-snug text-center">{currentCard.question}</MathMarkdown>
              <p className="absolute bottom-4 text-[11px] text-text-muted">{t('flashcard.clickToSeeAnswer')}</p>
            </div>
            {/* Back */}
            <div
              className="absolute inset-0 backface-hidden card-base flex flex-col items-center justify-center p-8 text-center border-t-4 border-t-success shadow-xl"
              style={{ transform: 'rotateY(180deg)' }}
            >
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">{t('flashcard.answer')}</span>
              <MathMarkdown className="text-lg text-text leading-relaxed text-center">{currentCard.answer}</MathMarkdown>
            </div>
          </motion.div>
        </div>

        {/* Action buttons / feedback — after flip */}
        <AnimatePresence>
          {feedback ? (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-6 w-full max-w-xl"
            >
              {/* Feedback mini strip */}
              <div className={`flex items-center justify-between rounded-xl px-4 py-2.5 mb-3 ${
                feedback.known
                  ? 'bg-success/10 border border-success/30'
                  : 'bg-danger/10 border border-danger/30'
              }`}>
                <span className={`text-sm font-semibold ${feedback.known ? 'text-success' : 'text-danger'}`}>
                  {feedback.known ? t('flashcard.known') : t('flashcard.unknown')}
                </span>
                <button
                  onClick={handleSkipAutoAdvance}
                  className="text-xs text-text-muted hover:text-text transition-colors ml-4 shrink-0"
                >
                  {t('flashcard.skipAdvance')}
                </button>
              </div>
              {/* Auto-advance progress bar */}
              <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${feedback.known ? 'bg-success' : 'bg-danger'}`}
                  style={{ width: `${autoAdvanceProgress}%` }}
                  transition={{ ease: 'linear' }}
                />
              </div>
            </motion.div>
          ) : isFlipped && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex gap-3 mt-8"
            >
              <button
                onClick={handleDontKnow}
                className="px-6 py-2.5 rounded-xl border border-danger/40 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
              >
                {t('flashcard.dontKnow')}
              </button>
              <button
                onClick={handleKnow}
                className="px-6 py-2.5 rounded-xl border border-success/40 text-success text-sm font-medium hover:bg-success/10 transition-colors"
              >
                {t('flashcard.known')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between mt-8 shrink-0">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed text-sm"
        >
          <ChevronLeft size={16} /> {t('flashcard.prev')}
        </button>
        <button
          onClick={handleDeleteCard}
          className="p-2 text-text-muted hover:text-danger transition-colors"
          title={t('flashcard.deleteCardTitle')}
        >
          <Trash2 size={15} />
        </button>
        <button
          onClick={goNext}
          className="btn-ghost text-sm"
        >
          {t('flashcard.skip')} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate AI Modal
// ─────────────────────────────────────────────────────────────────────────────
function GenerateAIModal({ subjects, onClose, onSuccess }) {
  const [subjectId, setSubjectId] = useState('');
  const [count, setCount] = useState(10);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const flashcardOp = usePendingOperation('flashcard');

  const PRESETS = [5, 10, 15, 20];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return setError(t('flashcard.selectSubjectFirst'));
    if (selectedMaterialIds.length === 0) return setError(t('flashcard.selectMaterialFirst'));
    setError('');
    setIsGenerating(true);
    flashcardOp.start();
    try {
      const result = await flashcardAPI.generate({
        subject_id: Number(subjectId),
        count: Math.max(5, Math.min(20, Number(count) || 10)),
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds.join(',') : '',
      });
      if (result.detail) throw new Error(result.detail);
      // Kirim batch_id dari response agar langsung masuk deck baru
      const batchId = result?.batch_id;
      onSuccess(batchId);
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsGenerating(false);
    } finally {
      flashcardOp.finish();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm card-base shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-primary" />
            <h3 className="font-semibold text-text">{t('flashcard.generateAiModalTitle')}</h3>
          </div>
          <button onClick={onClose} disabled={isGenerating} className="text-text-muted hover:text-text disabled:opacity-40">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('flashcard.materialSourceLabel')}</label>
            <select
              required
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); setSelectedMaterialIds([]); }}
              disabled={isGenerating}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
            >
              <option value="">{t('flashcard.selectSubjectPlaceholder')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-text-muted mt-1">
              {t('flashcard.materialReadyHint')}
            </p>
          </div>
          <MaterialPicker
            subjectId={subjectId}
            selectedMaterialIds={selectedMaterialIds}
            onSelectionChange={setSelectedMaterialIds}
          />
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('flashcard.countLabel')}</label>
            <div className="flex gap-2">
              {PRESETS.map(p => (
                <button
                  key={p}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setCount(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
                    count === p
                      ? 'bg-primary text-white border-primary'
                      : 'bg-background text-text-secondary border-border hover:border-primary/50 hover:text-text'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-muted mt-1">{t('flashcard.generatePerDeckHint')}</p>
          </div>
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-primary py-1">
              <Loader2 size={16} className="animate-spin" />
              <span>{t('flashcard.aiAnalyzing')}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
<button type="button" onClick={onClose} disabled={isGenerating} className="btn-ghost disabled:opacity-40">
               {t('common.cancel')}
             </button>
             <button type="submit" disabled={isGenerating || !subjectId || selectedMaterialIds.length === 0} className="btn-primary disabled:opacity-40">
               {isGenerating ? t('flashcard.generating') : t('flashcard.generate')}
             </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Create Modal
// ─────────────────────────────────────────────────────────────────────────────
function CreateFlashcardModal({ subjects, onClose, onSuccess }) {
  const [formData, setFormData] = useState({ question: '', answer: '', subject_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
if (!formData.question || !formData.answer || !formData.subject_id) {
       return setError(t('flashcard.fillAllFields'));
     }
    setIsSubmitting(true);
    const data = new URLSearchParams();
    data.append('question', formData.question);
    data.append('answer', formData.answer);
    data.append('subject_id', formData.subject_id);
    try {
      const res = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: data.toString(),
      });
      if (!res.ok) throw new Error('Gagal menyimpan flashcard.');
      onSuccess();
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg card-base shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <h3 className="font-semibold text-text">{t('flashcard.manualModalTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>
          )}
          <div>
<label className="block text-xs font-medium text-text-secondary mb-1">{t('flashcard.subjectLabel')}</label>
             <select
               required
               value={formData.subject_id}
               onChange={(e) => setFormData(p => ({ ...p, subject_id: e.target.value }))}
               className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
             >
               <option value="">{t('flashcard.selectSubjectPlaceholder')}</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('flashcard.questionFrontLabel')}</label>
            <textarea
              required
              rows={2}
              value={formData.question}
              onChange={(e) => setFormData(p => ({ ...p, question: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">{t('flashcard.answerBackLabel')}</label>
            <textarea
              required
              rows={3}
              value={formData.answer}
              onChange={(e) => setFormData(p => ({ ...p, answer: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
<button type="button" onClick={onClose} className="btn-ghost">{t('common.cancel')}</button>
             <button type="submit" disabled={isSubmitting || !formData.question} className="btn-primary disabled:opacity-40">
               {isSubmitting ? t('flashcard.saving') : t('common.save')}
             </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Riwayat Review per kartu (log Lupa/Ingat/Hafal + jadwal next_review)
// ─────────────────────────────────────────────────────────────────────────────
function ReviewHistoryModal({ group, onClose }) {
  const { t } = useTranslation();
  const { subject, cards } = group || {};
  const cardIds = (cards || []).map(c => c.id);
  const RATING_META = {
    0: { label: t('flashcard.ratingLupa'),  cls: 'text-danger border-danger/30 bg-danger/5' },
    1: { label: t('flashcard.ratingLupa'),  cls: 'text-danger border-danger/30 bg-danger/5' },
    2: { label: t('flashcard.ratingIngat'), cls: 'text-accent-blue border-accent-blue/30 bg-accent-blue/5' },
    3: { label: t('flashcard.ratingHafal'), cls: 'text-success border-success/30 bg-success/5' },
    4: { label: t('flashcard.ratingHafal'), cls: 'text-success border-success/30 bg-success/5' },
  };
  const cardIds = (cards || []).map(c => c.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ['flashcard-reviews', cardIds.join(',')],
    queryFn: () => flashcardAPI.getReviews(cardIds),
    enabled: cardIds.length > 0,
  });

  const reviewsMap = data?.reviews || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl card-base shadow-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-accent-purple" />
            <h3 className="font-semibold text-text">{t('flashcard.reviewHistoryTitle', { subjectName: subject?.name || t('flashcard.defaultName') })}</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && <p className="text-center text-text-muted py-8">{t('common.loading')}</p>}
          {error && <p className="text-center text-danger py-8">{t('flashcard.loadHistoryError', { message: error?.message })}</p>}
          {!isLoading && !error && (cards || []).length === 0 && (
            <p className="text-center text-text-muted py-8">{t('flashcard.noCardsInDeck')}</p>
          )}
          {(cards || []).map(card => {
            const history = reviewsMap[card.id] || [];
            return (
              <div key={card.id} className="border border-border rounded-xl p-3 bg-background">
                <div className="flex items-start justify-between gap-3">
                  <MathMarkdown className="text-sm font-medium text-text">{card.question}</MathMarkdown>
                  <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${card.mastered ? 'text-success border-success/30 bg-success/5' : 'text-text-muted border-border'}`}>
                    {card.mastered ? t('flashcard.mastered') : t('flashcard.processing')}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-text-muted">
                  <span>Direview: <b className="text-text">{card.times_seen || 0}×</b></span>
                  {card.last_reviewed && <span>Terakhir: {formatDateTime(card.last_reviewed)}</span>}
                </div>
                {history.length === 0 ? (
                  <p className="mt-2 text-xs text-text-muted">{t('flashcard.neverReviewed')}</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {history.map(r => {
                      const meta = RATING_META[r.rating] || RATING_META[0];
                      return (
                        <li key={r.id} className={`flex items-center justify-between text-xs rounded-lg border px-2 py-1 ${meta.cls}`}>
                          <span className="font-medium">{meta.label}</span>
                          <span className="flex items-center gap-3 text-text-muted">
                            <span className="capitalize">{formatDate(r.reviewed_at)} · {formatTimeOnly(r.reviewed_at)}</span>
                            {r.next_review && <span>Next: {formatDate(r.next_review)}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-border shrink-0 flex justify-end">
          <button onClick={onClose} className="btn-ghost border border-border text-sm">{t('common.close')}</button>
        </div>
      </motion.div>
    </div>
  );
}
