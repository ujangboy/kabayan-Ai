import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ICONS } from '@/lib/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

import { flashcardAPI, subjectAPI } from '@/services/api';
import { useUiStore } from '@/store';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/utils/errors';
import { EmptyState, Select, Skeleton , Icon } from '@/components/ui';
import { usePageState } from '@/hooks/usePageState';
import { fadeSlide } from '@/utils';
import BatchFlashcardCard from '@/components/flashcard/BatchFlashcardCard';
import FlashcardSession from '@/components/flashcard/FlashcardSession';
import GenerateAIModal from '@/components/flashcard/GenerateAIModal';
import CreateFlashcardModal from '@/components/flashcard/CreateFlashcardModal';
import ReviewHistoryModal from '@/components/flashcard/ReviewHistoryModal';

const PAGE_KEY = 'flashcard';

export default function FlashcardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { restore, persist, clear } = usePageState(PAGE_KEY);
  const { toast } = useToast();
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [historyBatchId, setHistoryBatchId] = useState(null);
  const subjectFilter = useUiStore((s) => s.subjectFilterFlashcard);
  const setSubjectFilter = useUiStore((s) => s.setSubjectFilter);

  // Restore active session + read subject_id / deck_id from URL (re-run saat pindah param via sidebar)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sid = params.get('subject_id');
    if (sid) setSubjectFilter('flashcard', sid);
    const did = params.get('deck_id');
    if (did) {
      setActiveBatchId(did);
    } else {
      const saved = restore();
      if (saved?.activeBatchId) setActiveBatchId(saved.activeBatchId);
    }
    if (location.search) navigate('/flashcard', { replace: true });
  }, [location.search]);

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
    const bid = String(f.batch_id || `legacy-${f.subject?.id ?? 0}`);
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

  // Persist active batch id
  useEffect(() => {
    if (activeBatchId) persist({ activeBatchId });
  }, [activeBatchId]);

  const handleClearAll = () => {
    toast.confirm({
      title: t('flashcard.confirmClearAll'),
      message: t('flashcard.confirmClearAll'),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => clearAllMutation.mutate(),
    });
  };

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {activeBatchId !== null ? (() => {
          const group = groups.find(g => String(g.batch_id) === String(activeBatchId));
          const cards = group?.cards || [];
          return (
            <motion.div key="session" {...fadeSlide} className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <FlashcardSession
                cards={cards}
                subjectName={group?.subject?.name || t('flashcard.defaultName')}
                onClose={() => {
                  setActiveBatchId(null);
                  clear();
                  queryClient.invalidateQueries(['flashcards']);
                }}
              />
            </motion.div>
          );
        })() : (
          <motion.div key="list" {...fadeSlide} className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="w-full space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-card shrink-0">
              <Icon name={ICONS.nav.flashcard} size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text">{t('flashcard.pageTitle')}</h1>
              <p className="text-text-secondary text-sm mt-1">{t('flashcard.pageSubtitle')}</p>
            </div>
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
                  <Icon name={ICONS.learning.brain} size={14} />
                  {totalDue > 0 ? t('flashcard.reviewCount', { count: totalDue }) : t('flashcard.reviewSrs')}
                </button>
              );
            })()}
            <button onClick={() => setIsAIModalOpen(true)} className="btn-primary">
              {t('flashcard.generateAi')}
            </button>
            <button onClick={() => setIsManualModalOpen(true)} className="btn-ghost border border-border">
              {t('flashcard.manual')}
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
            <Select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter('flashcard', e.target.value)}
            >
              <option value="">{t('flashcard.filterAllSubjects')}</option>
              {[...subjects].sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })).map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </Select>
            <span className="text-xs text-text-secondary font-medium">
              {t('flashcard.showingCount', { shown: filteredGroups.length, total: groups.length })}
            </span>
          </div>
        </div>

        {/* Group Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="card-base p-4 space-y-3">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </>
          ) : groups.length === 0 ? (
            <div className="col-span-full card-base">
              <EmptyState
                icon={ICONS.nav.flashcard}
                title={t('flashcard.emptyState')}
                action={
                  <button onClick={() => setIsAIModalOpen(true)} className="btn-primary text-sm">
                    {t('flashcard.generateAi')}
                  </button>
                }
              />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="col-span-full card-base">
              <EmptyState title={t('flashcard.noDeckForSubject')} />
            </div>
          ) : (
            filteredGroups.map((group, idx) => (
              <BatchFlashcardCard
                key={group.batch_id}
                group={group}
                tone={idx}
                onStart={() => setActiveBatchId(group.batch_id)}
                onReview={() => navigate(`/flashcard/review?subject_id=${group.subject.id}`)}
                onHistory={() => setHistoryBatchId(group.batch_id)}
                onDeleteAll={() => {
                  toast.confirm({
                    title: t('flashcard.confirmDeleteDeck', { count: group.cards.length }),
                    message: t('flashcard.confirmDeleteDeck', { count: group.cards.length }),
                    danger: true,
                    confirmLabel: t('common.delete'),
                    onConfirm: () => {
                      const ids = group.cards.map(c => c.id);
                      flashcardAPI.batchDelete(ids)
                        .then(() => queryClient.invalidateQueries(['flashcards']))
                        .catch(err => toast.error(extractErrorMessage(err)));
                    },
                  });
                }}
              />
            ))
          )}
        </div>

        </div>

          </motion.div>
        )}
      </AnimatePresence>

      <GenerateAIModal
        open={isAIModalOpen}
        subjects={subjects}
        onClose={() => setIsAIModalOpen(false)}
        onSuccess={(batchId) => {
          setIsAIModalOpen(false);
          queryClient.invalidateQueries(['flashcards']);
          // langsung masuk session deck yang baru di-generate
          setTimeout(() => setActiveBatchId(batchId), 400);
        }}
      />
      <CreateFlashcardModal
        open={isManualModalOpen}
        subjects={subjects}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={() => {
          setIsManualModalOpen(false);
          queryClient.invalidateQueries(['flashcards']);
        }}
      />
      <ReviewHistoryModal
        open={historyBatchId !== null}
        group={groups.find(g => g.batch_id === historyBatchId)}
        onClose={() => setHistoryBatchId(null)}
      />
    </>
  );
}