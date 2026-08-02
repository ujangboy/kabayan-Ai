import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Play, X, Zap, Trophy, Trash2, CheckCircle, XCircle, Loader2, Clock, Calendar, FileText, PenLine } from 'lucide-react';
import { quizAPI, subjectAPI } from '@/services/api';
import MathMarkdown from '@/components/MathMarkdown';
import MaterialPicker from '@/components/MaterialPicker';
import QuizTimer from '@/components/quiz/QuizTimer';
import QuizProgressBar from '@/components/quiz/QuizProgressBar';
import { formatDate, formatTimeOnly } from '@/utils';

const QTYPE_LABEL = { mcq: 'Pilihan Ganda', essay: 'Essay', mixed: 'Campuran' };
const DIFFICULTY_BADGE = {
  mudah:  { label: 'Mudah',  cls: 'bg-success/15 text-success border-success/30' },
  sedang: { label: 'Sedang', cls: 'bg-warning/15 text-warning border-warning/30' },
  sulit:  { label: 'Sulit',  cls: 'bg-danger/15 text-danger border-danger/30' },
};

function formatDuration(seconds) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m} mnt ${String(s).padStart(2, '0')} dtk`;
}

export default function QuizPage() {
  const queryClient = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);

  const { data: quizData, isLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => quizAPI.getAll().then(r => r.data)
  });

  const { data: subjectData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectAPI.getAll().then(r => r.data)
  });

  const allQuizzes = quizData?.quizzes || [];
  const subjects = subjectData?.subjects || [];

  const quizzes = selectedSubject 
    ? allQuizzes.filter(q => q.subject?.id === Number(selectedSubject)) 
    : allQuizzes;

  const deleteMutation = useMutation({
    mutationFn: (id) => quizAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes']);
    },
    onError: (err) => {
      console.error('Failed to delete quiz:', err);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => quizAPI.clear(),
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes']);
    },
    onError: (err) => {
      console.error('Failed to clear quizzes:', err);
    },
  });

  const handleDelete = (id) => {
    if (confirm('Hapus quiz ini?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleClearAll = () => {
    if (confirm('Hapus SEMUA quiz?')) {
      clearMutation.mutate();
    }
  };

  const handleStartQuiz = (quizId) => {
    setActiveQuizId(quizId);
    setSessionKey(k => k + 1);
  };

  const closeSession = useCallback(() => {
    setActiveQuizId(null);
    queryClient.invalidateQueries(['quizzes']);
  }, [queryClient]);

  // Jika ada quiz aktif, tampilkan QuizSession
  if (activeQuizId) {
    return <QuizSession key={sessionKey} quizId={activeQuizId} onClose={closeSession} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">Quiz Interaktif</h1>
            <p className="text-text-secondary text-sm mt-1">Buat quiz AI dari materi dan uji pemahaman Anda.</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
            >
              <option value="">Semua Mata Kuliah</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button onClick={() => setIsGeneratorOpen(true)} className="btn-primary text-xs">
              <Zap size={14} /> Buat Quiz AI
            </button>
            {allQuizzes.length > 0 && (
              <button onClick={handleClearAll} className="btn-ghost text-danger border border-danger/20 text-xs">
                Hapus Semua
              </button>
            )}
          </div>
        </div>

        {/* Quiz List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-10 text-text-muted">Memuat quiz...</div>
          ) : quizzes.length === 0 ? (
            <div className="col-span-full card-base p-10 text-center">
              <HelpCircle size={48} className="mx-auto mb-4 text-text-muted opacity-50" />
              <p className="text-text-muted mb-4">Belum ada quiz{selectedSubject ? ' untuk mata kuliah ini' : ''}.</p>
              <button onClick={() => setIsGeneratorOpen(true)} className="btn-primary text-sm">
                <Zap size={14} /> Buat Quiz Pertama
              </button>
            </div>
          ) : (
            quizzes.map((quiz) => (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-base p-5 flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    {/* Nama materi / mata kuliah */}
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] font-semibold text-accent-blue uppercase tracking-wider truncate">
                        {quiz.subject?.name || 'Umum'}
                      </span>
                      {quiz.question_type && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-card border border-border text-text-secondary shrink-0">
                          {QTYPE_LABEL[quiz.question_type] || quiz.question_type}
                        </span>
                      )}
                      {quiz.difficulty && DIFFICULTY_BADGE[quiz.difficulty] && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 font-medium ${DIFFICULTY_BADGE[quiz.difficulty].cls}`}>
                          {DIFFICULTY_BADGE[quiz.difficulty].label}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-text text-sm line-clamp-2">
                      {quiz.title || `Quiz #${quiz.id}`}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleDelete(quiz.id)}
                    className="p-1 text-text-muted hover:text-danger transition-colors shrink-0 ml-2"
                    title="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-2 text-xs text-text-secondary flex-wrap">
                  <span className="flex items-center gap-1">
                    <HelpCircle size={12} />
                    {quiz.question_count || 0} soal
                  </span>
                  {quiz.score !== null && quiz.score !== undefined && (
                    <span className="flex items-center gap-1 text-warning">
                      <Trophy size={12} />
                      {quiz.score}
                    </span>
                  )}
                  {(quiz.attempt_count || 0) > 0 && (
                    <span className="text-[10px] text-text-muted">dimainkan {quiz.attempt_count}x</span>
                  )}
                  {quiz.time_taken != null && (
                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                      <Clock size={9} />
                      {formatDuration(quiz.time_taken)}
                    </span>
                  )}
                </div>

                {/* Nama materi yang digunakan */}
                {(quiz.material_names || []).length > 0 && (
                  <div className="flex gap-1 flex-wrap mb-2">
                    {(quiz.material_names || []).slice(0, 3).map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[220px]">
                        <FileText size={8} className="shrink-0" />{name}
                      </span>
                    ))}
                    {(quiz.material_names || []).length > 3 && (
                      <span className="text-[10px] text-text-muted">+{quiz.material_names.length - 3} lagi</span>
                    )}
                  </div>
                )}

                {/* Tanggal + waktu dibuat */}
                {quiz.created_at && (
                  <div className="flex items-center gap-3 mb-3 text-[10px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar size={9} />
                      {formatDate(quiz.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={9} />
                      {formatTimeOnly(quiz.created_at)}
                    </span>
                  </div>
                )}

                <button
                  onClick={() => handleStartQuiz(quiz.id)}
                  className="bg-warning text-black font-bold w-full justify-center text-xs mt-auto px-4 py-2 rounded-lg hover:bg-warning/80 transition-colors flex items-center gap-1.5"
                >
                  <Play size={12} /> {quiz.score !== null ? 'Main Lagi' : 'Mulai'}
                </button>
              </motion.div>
            ))
          )}
        </div>

      </div>

      <AnimatePresence>
        {isGeneratorOpen && (
          <GenerateQuizModal
            onClose={() => setIsGeneratorOpen(false)}
            subjects={subjects}
            onSuccess={(quizId) => {
              setIsGeneratorOpen(false);
              queryClient.invalidateQueries(['quizzes']);
              // Langsung mulai quiz yang baru dibuat
              setActiveQuizId(quizId);
              setSessionKey(k => k + 1);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GenerateQuizModal({ onClose, subjects, onSuccess }) {
  const [subjectId, setSubjectId] = useState('');
  const [mcqCount, setMcqCount] = useState(5);
  const [essayCount, setEssayCount] = useState(0);
  const [difficulty, setDifficulty] = useState('sedang');
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const DIFFICULTIES = [
    { value: 'mudah',  label: 'Mudah',  desc: 'Faktual & ingatan dasar' },
    { value: 'sedang', label: 'Sedang', desc: 'Pemahaman & penerapan' },
    { value: 'sulit',  label: 'Sulit',  desc: 'HOTS & analisis kritis' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return setError('Pilih mata kuliah terlebih dahulu');
    if (selectedMaterialIds.length === 0) return setError('Harap pilih materi terlebih dahulu.');
    if (!mcqCount && !essayCount) return setError('Minimal 1 soal.');
    setError('');
    setIsGenerating(true);
    try {
      const result = await quizAPI.generate({
        subject_id: subjectId,
        mcq_count: Number(mcqCount) || 0,
        essay_count: Number(essayCount) || 0,
        difficulty,
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds.join(',') : '',
      });
      if (result.detail) throw new Error(result.detail);
      if (!result.id) throw new Error('Quiz ID tidak ditemukan di response.');
      onSuccess(result.id);
    } catch (err) {
      setError(err.message || 'Gagal membuat quiz. Coba lagi.');
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
            <h3 className="font-semibold text-text">Generate AI Quiz</h3>
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
            <label className="block text-xs font-medium text-text-secondary mb-1">Sumber (Mata Kuliah) *</label>
            <select
              required
              value={subjectId}
              onChange={(e) => { setSubjectId(e.target.value); setSelectedMaterialIds([]); }}
              disabled={isGenerating}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
            >
              <option value="">-- Pilih --</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <MaterialPicker
            subjectId={subjectId}
            selectedMaterialIds={selectedMaterialIds}
            onSelectionChange={setSelectedMaterialIds}
          />
          {/* Tingkat Kesulitan */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">Tingkat Kesulitan</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.value}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setDifficulty(d.value)}
                  title={d.desc}
                  className={`flex-1 py-2 px-1 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                    difficulty === d.value
                      ? d.value === 'mudah'
                        ? 'bg-success/20 text-success border-success/50'
                        : d.value === 'sedang'
                          ? 'bg-warning/20 text-warning border-warning/50'
                          : 'bg-danger/20 text-danger border-danger/50'
                      : 'bg-background text-text-secondary border-border hover:border-primary/40 hover:text-text'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-muted mt-1">{DIFFICULTIES.find(d => d.value === difficulty)?.desc}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Soal Pilihan Ganda</label>
              <input
                type="number"
                min="0"
                max="15"
                value={mcqCount}
                onChange={(e) => setMcqCount(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Soal Essay</label>
              <input
                type="number"
                min="0"
                max="5"
                value={essayCount}
                onChange={(e) => setEssayCount(e.target.value)}
                disabled={isGenerating}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors disabled:opacity-60"
              />
            </div>
          </div>
          {Number(essayCount) > 0 && (
            <p className="text-[10px] text-text-muted">
              Soal essay tidak dinilai otomatis — tujuannya untuk latihan menulis jawaban.
            </p>
          )}
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-primary py-1">
              <Loader2 size={16} className="animate-spin" />
              <span>Menganalisis materi...</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={isGenerating} className="btn-ghost disabled:opacity-40">
              Batal
            </button>
            <button type="submit" disabled={isGenerating || !subjectId || selectedMaterialIds.length === 0} className="btn-primary disabled:opacity-40">
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function QuizSession({ quizId, onClose }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isFinished, setIsFinished] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [score, setScore] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);
  const startTimeRef = useRef(Date.now());

  const { data: quizData, isLoading, error } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => quizAPI.getQuestions(quizId).then(r => r.data),
    enabled: !!quizId,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quizData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-danger mb-4">Gagal memuat quiz: {error?.message || 'Unknown error'}</p>
        <button onClick={onClose} className="btn-ghost border border-border">Kembali</button>
      </div>
    );
  }

  const questions = [
    ...(quizData.mcq || []).map(q => ({ ...q, qtype: 'mcq' })),
    ...((quizData.essay || []).map(q => ({ ...q, qtype: 'essay' }))),
  ];
  const total = questions.length;
  const mcqTotal = questions.filter(q => q.qtype === 'mcq').length;

  if (total === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-text-muted mb-4">Quiz kosong atau soal belum tersedia.</p>
        <button onClick={onClose} className="btn-ghost border border-border">Kembali</button>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const timerSeconds = Math.min(45 * 60, total * 60);

  const handleSelectOption = (opt) => {
    setAnswers(p => ({ ...p, [currentIdx]: opt }));
  };

  const handleEssayChange = (text) => {
    setAnswers(p => ({ ...p, [currentIdx]: text }));
  };

  const computeScore = () => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (q.qtype === 'mcq' && answers[idx] === q.answer) correct++;
    });
    const finalScore = mcqTotal > 0 ? Math.round((correct / mcqTotal) * 100) : 0;
    return { correct, wrong: mcqTotal - correct, finalScore };
  };

  const finishQuiz = async () => {
    if (isFinished) return;
    const { correct, wrong, finalScore } = computeScore();
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    setScore(finalScore);
    setTimeTaken(elapsed);
    setIsFinished(true);

    // Simpan score + tracking ke DB
    try {
      await quizAPI.saveScoreDetailed(quizId, finalScore, { correct, wrong, timeTaken: elapsed, totalQuestions: total });
    } catch {
      // Fallback: simpan tanpa detail tracking
      try { await quizAPI.saveScore(quizId, finalScore); } catch {}
    }
  };

  const handleTimeUp = () => {
    finishQuiz();
  };

  const handleNext = () => {
    if (currentIdx < total - 1) {
      setCurrentIdx(c => c + 1);
    } else {
      finishQuiz();
    }
  };

  // Review View
  if (showReview) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text">Review Jawaban</h2>
            <button onClick={onClose} className="btn-ghost text-sm">Tutup</button>
          </div>

          {questions.map((q, idx) => {
            const isEssay = q.qtype === 'essay';
            const userAnswer = answers[idx];
            const isCorrect = !isEssay && userAnswer === q.answer;
            return (
              <div key={idx} className="card-base p-5 border-l-4" style={{ borderColor: isEssay ? 'var(--color-warning)' : isCorrect ? 'var(--color-success)' : 'var(--color-danger)' }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: isEssay ? 'var(--color-warning)' : isCorrect ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {isEssay ? <PenLine size={14} className="text-white" /> : isCorrect ? <CheckCircle size={16} className="text-white" /> : <XCircle size={16} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-text-secondary">Soal {idx + 1}</p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-card border border-border text-text-secondary">
                        {isEssay ? 'Essay (tidak dinilai otomatis)' : 'Pilihan Ganda'}
                      </span>
                    </div>
                    <MathMarkdown className="text-text font-medium mb-3">{q.question}</MathMarkdown>

                    <div className="space-y-2 text-sm">
                      {isEssay ? (
                        <div>
                          <span className="text-text-secondary">Jawaban Anda: </span>
                          <div className="mt-1 p-3 bg-background rounded-lg border border-border">
                            <MathMarkdown className="text-sm">{userAnswer || '(Tidak dijawab)'}</MathMarkdown>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span className="text-text-secondary">Jawaban Anda: </span>
                            <span className={isCorrect ? 'text-success font-medium' : 'text-danger font-medium'}>
                              {userAnswer ? <MathMarkdown className="inline">{userAnswer}</MathMarkdown> : '(Tidak dijawab)'}
                            </span>
                          </div>
                          {!isCorrect && (
                            <div>
                              <span className="text-text-secondary">Jawaban Benar: </span>
                              <span className="text-success font-medium"><MathMarkdown className="inline">{q.answer}</MathMarkdown></span>
                            </div>
                          )}
                        </>
                      )}
                      {q.explanation && (
                        <div className="mt-2 p-3 bg-background rounded-lg border border-border">
                          <p className="text-xs font-semibold text-text-secondary mb-1">Penjelasan:</p>
                          <MathMarkdown className="text-sm">{q.explanation}</MathMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Result View
  if (isFinished) {
    const { correct, wrong } = computeScore();
    const recommendation =
      score >= 70
        ? { icon: '🎉', text: 'Bagus! Penguasaan materi sudah baik. Lanjut ke topik berikutnya atau coba soal yang lebih sulit.' }
        : score >= 50
          ? { icon: '📖', text: 'Cukup baik. Review jawaban yang salah untuk memperkuat pemahaman, lalu coba lagi.' }
          : { icon: '💪', text: 'Masih perlu banyak latihan. Pelajari kembali materi terkait, lalu ulangi quiz ini.' };
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-base text-center max-w-md w-full p-8">
          <Trophy size={48} className="mx-auto text-warning mb-4" />
          <h2 className="text-2xl font-bold text-text mb-2">Quiz Selesai!</h2>
          <div className="text-6xl font-bold text-primary my-4">{score}</div>
          <p className="text-xs text-text-muted mb-4">
            {mcqTotal > 0 ? `Nilai dari ${mcqTotal} soal pilihan ganda` : 'Semua soal essay (tidak dinilai otomatis)'}
            {timeTaken > 0 && ` • waktu ${formatDuration(timeTaken)}`}
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-success/10 rounded-xl border border-success/20">
              <div className="text-2xl font-bold text-success">{correct}</div>
              <div className="text-xs text-text-secondary">Benar</div>
            </div>
            <div className="p-3 bg-danger/10 rounded-xl border border-danger/20">
              <div className="text-2xl font-bold text-danger">{wrong}</div>
              <div className="text-xs text-text-secondary">Salah</div>
            </div>
          </div>
          <div className="p-3 bg-background rounded-xl border border-border mb-6 text-sm text-text-secondary">
            <span className="mr-1">{recommendation.icon}</span>
            {recommendation.text}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowReview(true)} className="btn-primary flex-1 justify-center text-sm">
              Review Jawaban
            </button>
            <button onClick={onClose} className="btn-ghost flex-1 justify-center text-sm border border-border">
              Kembali
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Quiz Session View
  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full p-6 md:p-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="text-lg font-semibold text-text truncate">{quizData.title || 'Quiz'}</h2>
        <QuizTimer totalSeconds={timerSeconds} onTimeUp={handleTimeUp} isActive={!isFinished} />
      </div>

      <QuizProgressBar current={currentIdx + 1} total={total} />

      <div className="flex-1 mt-6">
        <div className="flex items-center gap-2 mb-2">
          {currentQ.qtype === 'essay' && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
              <PenLine size={10} /> Essay
            </span>
          )}
        </div>
        <h3 className="text-xl font-medium text-text mb-6 leading-relaxed">
          <MathMarkdown>{currentQ.question}</MathMarkdown>
        </h3>
        {currentQ.qtype === 'essay' ? (
          <textarea
            value={answers[currentIdx] || ''}
            onChange={(e) => handleEssayChange(e.target.value)}
            rows={7}
            placeholder="Tulis jawaban Anda di sini..."
            className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-text focus:outline-none focus:border-primary transition-colors resize-y"
          />
        ) : (
          <div className="space-y-3">
            {(currentQ.options || []).map((opt, i) => {
              const isSelected = answers[currentIdx] === opt;
              return (
                <button
                  key={i}
                  onClick={() => handleSelectOption(opt)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-card border-border text-text hover:border-primary/50'
                  }`}
                >
                  <MathMarkdown>{opt}</MathMarkdown>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-10">
        <button onClick={onClose} className="btn-ghost text-danger">Keluar</button>
        <button
          onClick={handleNext}
          disabled={!answers[currentIdx] && currentQ.qtype === 'mcq'}
          className="btn-primary disabled:opacity-40"
        >
          {currentIdx === total - 1 ? 'Selesai' : 'Lanjut'}
        </button>
      </div>
    </div>
  );
}
