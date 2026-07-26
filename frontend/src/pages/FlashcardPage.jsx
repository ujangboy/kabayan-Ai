import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Plus, X, Book, Zap, Loader2, Play,
  Trash2, ChevronLeft, ChevronRight, RotateCcw, Trophy
} from 'lucide-react';
import { flashcardAPI, subjectAPI } from '@/services/api';
import { useToast } from '@/components/Toast';
import { extractErrorMessage } from '@/utils/errors';

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function FlashcardPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [activeSubjectId, setActiveSubjectId] = useState(null); // null = list view

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

  // Group flashcards by subject
  const subjectGroups = {};
  for (const f of allFlashcards) {
    const sid = f.subject?.id ?? 0;
    if (!subjectGroups[sid]) {
      subjectGroups[sid] = {
        subject: f.subject || { id: 0, name: 'Umum' },
        cards: [],
      };
    }
    subjectGroups[sid].cards.push(f);
  }
  const groups = Object.values(subjectGroups);

  const clearAllMutation = useMutation({
    mutationFn: () => flashcardAPI.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries(['flashcards']);
      toast.success('Semua flashcard berhasil dihapus.');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const handleClearAll = () => {
    if (confirm('Hapus SEMUA flashcard?')) clearAllMutation.mutate();
  };

  // If a subject is active, show session view
  if (activeSubjectId !== null) {
    const group = groups.find(g => g.subject.id === activeSubjectId);
    const cards = group?.cards || [];
    return (
      <FlashcardSession
        cards={cards}
        subjectName={group?.subject?.name || 'Flashcard'}
        onClose={() => {
          setActiveSubjectId(null);
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
            <h1 className="text-2xl font-bold text-text">Flashcard</h1>
            <p className="text-text-secondary text-sm mt-1">Hafalkan materi dengan teknik Active Recall.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setIsAIModalOpen(true)} className="btn-primary text-xs">
              <Zap size={14} /> Generate AI
            </button>
            <button onClick={() => setIsManualModalOpen(true)} className="btn-ghost border border-border text-xs">
              <Plus size={14} /> Manual
            </button>
            {allFlashcards.length > 0 && (
              <button onClick={handleClearAll} className="btn-ghost text-danger border border-danger/20 text-xs">
                Hapus Semua
              </button>
            )}
          </div>
        </div>

        {/* Group Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-10 text-text-muted">Memuat flashcard...</div>
          ) : groups.length === 0 ? (
            <div className="col-span-full card-base p-10 text-center">
              <CreditCard size={48} className="mx-auto mb-4 text-text-muted opacity-50" />
              <p className="text-text-muted mb-4">Belum ada flashcard. Generate dari materi kuliah Anda.</p>
              <button onClick={() => setIsAIModalOpen(true)} className="btn-primary text-sm">
                <Zap size={14} /> Generate AI
              </button>
            </div>
          ) : (
            groups.map((group) => (
              <SubjectFlashcardCard
                key={group.subject.id}
                group={group}
                onStart={() => setActiveSubjectId(group.subject.id)}
                onDeleteAll={() => {
                  if (confirm(`Hapus semua flashcard untuk ${group.subject.name}?`)) {
                    // delete each card in this group
                    Promise.all(group.cards.map(c => flashcardAPI.delete(c.id)))
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
            onSuccess={(subjectId) => {
              setIsAIModalOpen(false);
              queryClient.invalidateQueries(['flashcards']);
              // langsung masuk session untuk subject yang baru di-generate
              setTimeout(() => setActiveSubjectId(subjectId), 400);
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
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card component for each subject group
// ─────────────────────────────────────────────────────────────────────────────
function SubjectFlashcardCard({ group, onStart, onDeleteAll }) {
  const { subject, cards } = group;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-base p-5 flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Mata Kuliah</div>
          <h3 className="font-semibold text-text text-sm">{subject.name}</h3>
        </div>
        <button
          onClick={onDeleteAll}
          className="p-1 text-text-muted hover:text-danger transition-colors"
          title="Hapus semua flashcard ini"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <CreditCard size={12} />
          {cards.length} kartu
        </span>
        <span className="flex items-center gap-1">
          <Book size={12} />
          Flip &amp; Recall
        </span>
      </div>

      {/* Mini preview of first card */}
      {cards[0] && (
        <div className="bg-background rounded-lg p-3 mb-4 border border-border text-xs text-text-secondary line-clamp-2">
          {cards[0].question}
        </div>
      )}

      <button
        onClick={onStart}
        className="btn-primary w-full justify-center text-xs mt-auto"
      >
        <Play size={12} /> Mulai Belajar
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session view — study mode
// ─────────────────────────────────────────────────────────────────────────────
function FlashcardSession({ cards, subjectName, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [isFinished, setIsFinished] = useState(false);

  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => flashcardAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['flashcards']),
  });

  const total = cards.length;
  const currentCard = cards[currentIndex];

  const goNext = useCallback(() => {
    setIsFlipped(false);
    setTimeout(() => {
      if (currentIndex < total - 1) {
        setCurrentIndex(i => i + 1);
      } else {
        setIsFinished(true);
      }
    }, 150);
  }, [currentIndex, total]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(i => i - 1), 150);
    }
  }, [currentIndex]);

  const handleKnow = () => {
    setKnown(prev => new Set([...prev, currentCard.id]));
    goNext();
  };

  const handleDontKnow = () => {
    goNext();
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnown(new Set());
    setIsFinished(false);
  };

  const handleDeleteCard = () => {
    if (confirm('Hapus flashcard ini?')) {
      deleteMutation.mutate(currentCard.id);
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
          <h2 className="text-xl font-bold text-text mb-1">Sesi Selesai!</h2>
          <p className="text-text-secondary text-sm mb-6">{subjectName}</p>
          <div className="text-5xl font-bold text-primary mb-2">{pct}%</div>
          <p className="text-sm text-text-secondary mb-6">
            Hafal <span className="text-success font-semibold">{knownCount}</span> dari {total} kartu
          </p>
          <div className="flex gap-2">
            <button onClick={handleRestart} className="btn-primary flex-1 justify-center text-sm">
              <RotateCcw size={14} /> Ulangi
            </button>
            <button onClick={onClose} className="btn-ghost flex-1 justify-center text-sm border border-border">
              Selesai
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
          <p className="mb-4">Tidak ada kartu.</p>
          <button onClick={onClose} className="btn-ghost border border-border">Kembali</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-6 md:p-10">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <button onClick={onClose} className="btn-ghost text-sm text-text-muted">
          <ChevronLeft size={16} /> Kembali
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
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">Pertanyaan</span>
              <p className="text-xl font-bold text-text leading-snug">{currentCard.question}</p>
              <p className="absolute bottom-4 text-[11px] text-text-muted">Klik untuk lihat jawaban</p>
            </div>
            {/* Back */}
            <div
              className="absolute inset-0 backface-hidden card-base flex flex-col items-center justify-center p-8 text-center border-t-4 border-t-success shadow-xl"
              style={{ transform: 'rotateY(180deg)' }}
            >
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-widest mb-4">Jawaban</span>
              <p className="text-lg text-text leading-relaxed">{currentCard.answer}</p>
            </div>
          </motion.div>
        </div>

        {/* Action buttons — show after flip */}
        <AnimatePresence>
          {isFlipped && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex gap-3 mt-8"
            >
              <button
                onClick={handleDontKnow}
                className="px-6 py-2.5 rounded-xl border border-danger/40 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
              >
                Belum Hafal
              </button>
              <button
                onClick={handleKnow}
                className="px-6 py-2.5 rounded-xl border border-success/40 text-success text-sm font-medium hover:bg-success/10 transition-colors"
              >
                Sudah Hafal ✓
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
          <ChevronLeft size={16} /> Prev
        </button>
        <button
          onClick={handleDeleteCard}
          className="p-2 text-text-muted hover:text-danger transition-colors"
          title="Hapus kartu ini"
        >
          <Trash2 size={15} />
        </button>
        <button
          onClick={goNext}
          className="btn-ghost text-sm"
        >
          Skip <ChevronRight size={16} />
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return setError('Pilih mata kuliah terlebih dahulu.');
    setError('');
    setIsGenerating(true);
    try {
      const result = await flashcardAPI.generate({ subject_id: subjectId, count });
      if (result.detail) throw new Error(result.detail);
      onSuccess(Number(subjectId));
    } catch (err) {
      setError(extractErrorMessage(err));
      setIsGenerating(false);
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
            <h3 className="font-semibold text-text">Generate Flashcard AI</h3>
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
            <label className="block text-xs font-medium text-text-secondary mb-1">Sumber Materi (Mata Kuliah) *</label>
            <select
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
            >
              <option value="">-- Pilih Mata Kuliah --</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-text-muted mt-1">
              Pastikan materi sudah diupload dan status <span className="text-success">Ready</span>.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Jumlah Flashcard</label>
            <input
              type="number"
              min="5"
              max="50"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
            />
          </div>
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-primary py-1">
              <Loader2 size={16} className="animate-spin" />
              <span>AI sedang menganalisis materi...</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={isGenerating} className="btn-ghost disabled:opacity-40">
              Batal
            </button>
            <button type="submit" disabled={isGenerating || !subjectId} className="btn-primary disabled:opacity-40">
              {isGenerating ? 'Generating...' : 'Generate'}
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
      return setError('Lengkapi semua data terlebih dahulu.');
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
            <h3 className="font-semibold text-text">Flashcard Manual</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Mata Kuliah *</label>
            <select
              required
              value={formData.subject_id}
              onChange={(e) => setFormData(p => ({ ...p, subject_id: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">-- Pilih Mata Kuliah --</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Pertanyaan (Depan) *</label>
            <textarea
              required
              rows={2}
              value={formData.question}
              onChange={(e) => setFormData(p => ({ ...p, question: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Jawaban (Belakang) *</label>
            <textarea
              required
              rows={3}
              value={formData.answer}
              onChange={(e) => setFormData(p => ({ ...p, answer: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Batal</button>
            <button type="submit" disabled={isSubmitting || !formData.question} className="btn-primary disabled:opacity-40">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
