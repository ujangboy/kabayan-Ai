import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Book, FileText, CreditCard, HelpCircle, Pencil, Trash2, X,
  TrendingUp, Trophy, Target, CalendarCheck, Clock, BookOpen, Zap
} from 'lucide-react';
import { subjectAPI } from '@/services/api';
import { formatDate, fileIcon } from '@/utils';

const TOPIC_STATUS_META = {
  dikuasai:      { label: 'Dikuasai',     cls: 'badge-success' },
  berjalan:      { label: 'Sedang Berjalan', cls: 'badge-warning' },
  perlu_latihan: { label: 'Perlu Latihan',   cls: 'badge-danger' },
};

function ScoreChart({ history }) {
  const data = (history || []).filter(d => d && d.score != null).slice(-10);

  if (data.length < 2) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        {data.length === 1
          ? 'Satu skor tercatat — mainkan quiz atau ujian lagi untuk melihat grafik.'
          : 'Belum ada skor. Selesaikan quiz atau ujian simulasi untuk melihat perkembangan.'}
      </div>
    );
  }

  const W = 560, H = 200, PAD_X = 36, PAD_Y = 24;
  const scores = data.map(d => d.score);
  const minScore = Math.max(0, Math.floor((Math.min(...scores) - 10) / 10) * 10);
  const maxScore = Math.min(100, Math.ceil((Math.max(...scores) + 10) / 10) * 10);

  const x = (i) => PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, data.length - 1);
  const y = (s) => H - PAD_Y - ((s - minScore) / Math.max(1, maxScore - minScore)) * (H - PAD_Y * 2);

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.score).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0, 1, 2, 3].map(g => {
        const val = minScore + ((maxScore - minScore) * g) / 3;
        const yy = y(val);
        return (
          <g key={g}>
            <line x1={PAD_X} y1={yy} x2={W - PAD_X} y2={yy} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={4} y={yy + 3} fontSize="9" fill="var(--text-muted)">{Math.round(val)}</text>
          </g>
        );
      })}
      {/* Area fill */}
      <polygon
        points={`${PAD_X},${H - PAD_Y} ${path.replace(/M/g, 'L').replace(/^L/, 'M')} ${x(data.length - 1).toFixed(1)},${H - PAD_Y}`}
        fill="var(--primary)" opacity="0.08"
      />
      <polyline points={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.score)} r="4" fill={d.score >= 70 ? 'var(--success)' : d.score >= 50 ? 'var(--warning)' : 'var(--danger)'} stroke="var(--card)" strokeWidth="1.5" />
          <text x={x(i)} y={y(d.score) - 10} fontSize="10" fontWeight="700" fill="var(--text)" textAnchor="middle">{d.score}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={H - 8} fontSize="9" fill="var(--text-muted)" textAnchor="middle">
          {new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
        </text>
      ))}
    </svg>
  );
}

function EditSubjectModal({ subject, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: subject?.name || '',
    semester: subject?.semester || '',
    lecturer: subject?.lecturer || '',
    description: subject?.description || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    try {
      await subjectAPI.update(subject.id, formData);
      onSuccess();
    } catch (err) {
      alert(err.message || 'Gagal menyimpan');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md card-base shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Book size={18} className="text-primary" />
            <h3 className="font-semibold text-text">Edit Mata Kuliah</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nama Mata Kuliah *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Semester</label>
              <input
                type="text"
                value={formData.semester}
                onChange={(e) => setFormData(p => ({ ...p, semester: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Dosen Pengampu</label>
              <input
                type="text"
                value={formData.lecturer}
                onChange={(e) => setFormData(p => ({ ...p, lecturer: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Catatan Tambahan</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Batal</button>
            <button type="submit" disabled={isSubmitting || !formData.name} className="btn-primary">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, suffix }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="card-base flex items-center gap-4 p-4">
      <div className={`w-10 h-10 rounded-xl bg-card flex items-center justify-center shrink-0 border border-border ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-text">{value ?? 0}{suffix && <span className="text-sm text-text-muted font-normal"> {suffix}</span>}</p>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    </motion.div>
  );
}

const ACTIVITY_META = {
  quiz:      { icon: HelpCircle, label: 'Quiz',         cls: 'bg-accent-teal/10 text-accent-teal' },
  ujian:     { icon: Trophy,     label: 'Ujian Simulasi', cls: 'bg-primary/10 text-primary' },
  flashcard: { icon: CreditCard, label: 'Flashcard',    cls: 'bg-accent-purple/10 text-accent-purple' },
  materi:    { icon: FileText,   label: 'Materi',       cls: 'bg-accent-blue/10 text-accent-blue' },
};

export default function SubjectDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const subjectId = Number(id);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['subject-dashboard', subjectId],
    queryFn: () => subjectAPI.getDashboard(subjectId).then((res) => res.data),
    enabled: !!subjectId,
  });

  const deleteMutation = useMutation({
    mutationFn: () => subjectAPI.delete(subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries(['subjects']);
      navigate('/subjects');
    },
  });

  const subject = data?.subject;
  const topicProgress = data?.topic_progress || [];
  const scoreHistory = data?.score_history || [];
  const recentActivity = data?.recent_activity || [];
  const activePlan = data?.active_study_plan;

  const handleDelete = () => {
    if (confirm('Hapus mata kuliah ini? PERHATIAN: Ini juga akan MENGHAPUS SEMUA materi, catatan, flashcard, dan quiz yang terkait!')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-5xl mx-auto card-base p-8 space-y-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-5 bg-border rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="max-w-5xl mx-auto card-base p-8 text-center text-text-muted">Mata kuliah tidak ditemukan.</div>
      </div>
    );
  }

  const masteryPct = subject.best_score != null ? Math.min(100, Math.round((subject.best_score / 75) * 100)) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ─── Header ─── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/subjects')} className="btn-ghost px-3 py-2 rounded-xl text-sm">
            <ArrowLeft size={16} /> Kembali
          </button>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-bold text-text">{subject.name}</h1>
            <p className="text-text-secondary text-sm mt-0.5">
              {[subject.semester, subject.lecturer && `Dosen: ${subject.lecturer}`].filter(Boolean).join(' • ') || 'Mata Kuliah'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsEditOpen(true)} className="btn-ghost px-3 py-2 rounded-xl text-sm border border-border">
              <Pencil size={14} /> Edit
            </button>
            <button onClick={handleDelete} className="btn-ghost px-3 py-2 rounded-xl text-sm text-danger border border-border">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {subject.description && (
          <p className="text-sm text-text-secondary -mt-2 italic">"{subject.description}"</p>
        )}

        {/* ─── Quick Actions ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Zap,    label: 'Ujian Simulasi', to: '/exam-analyzer', color: 'bg-primary/10 text-primary' },
            { icon: HelpCircle, label: 'Quiz',        to: '/quiz',          color: 'bg-accent-teal/10 text-accent-teal' },
            { icon: CreditCard, label: 'Flashcard',   to: '/flashcard',     color: 'bg-accent-purple/10 text-accent-purple' },
            { icon: FileText, label: 'Upload Materi', to: '/materi',        color: 'bg-accent-blue/10 text-accent-blue' },
          ].map(({ icon: Icon, label, to, color }) => (
            <motion.button
              key={to}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(to)}
              className="card-base flex items-center gap-3 p-3 text-left hover:border-primary/30 transition-colors cursor-pointer"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={15} />
              </div>
              <span className="text-xs font-semibold text-text">{label}</span>
            </motion.button>
          ))}
        </div>

        {/* ─── Stats ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={FileText}   label="Materi"    value={subject.total_materials}  color="text-accent-blue" />
          <StatCard icon={HelpCircle} label="Quiz"      value={subject.total_quizzes}    color="text-accent-teal" />
          <StatCard icon={CreditCard} label="Flashcard" value={subject.total_flashcards} color="text-accent-purple" />
          <StatCard icon={TrendingUp} label="Rata-rata Skor" value={subject.avg_score}   color="text-success" suffix={subject.avg_score != null ? '/100' : ''} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Progress & Topic Breakdown (2/3) ─── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Score ring */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-5">
                <Target size={16} className="text-warning" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Target Penguasaan</h2>
              </div>
              <div className="flex items-center gap-6 flex-wrap">
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="52" fill="none"
                      stroke={masteryPct >= 70 ? 'var(--success)' : masteryPct >= 40 ? 'var(--warning)' : 'var(--danger)'}
                      strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${(masteryPct / 100) * 326.7} 326.7`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-text">{subject.best_score != null ? subject.best_score : '—'}</span>
                    <span className="text-[10px] text-text-muted">best / target 75</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-text-secondary">
                    {subject.best_score == null
                      ? 'Belum ada skor. Kerjakan quiz atau ujian simulasi pertama kamu.'
                      : masteryPct >= 70
                        ? 'Penguasaan materi sudah bagus — pertahankan dengan review rutin.'
                        : masteryPct >= 40
                          ? 'Sedang menuju target — fokus latihan pada topik yang masih lemah.'
                          : 'Masih jauh dari target — mulai dengan latihan soal dari topik paling lemah.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <CalendarCheck size={14} className="text-text-muted" />
                    <span className="text-xs text-text-muted">
                      {subject.last_activity_at ? `Aktivitas terakhir: ${formatDate(subject.last_activity_at)}` : 'Belum ada aktivitas'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Topic progress */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={16} className="text-success" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Progress per Topik</h2>
              </div>
              {topicProgress.length === 0 ? (
                <p className="text-center py-6 text-text-muted text-sm">
                  Belum ada data topik. Selesaikan ujian simulasi untuk melihat penguasaan per topik.
                </p>
              ) : (
                <div className="space-y-4">
                  {topicProgress.map((t) => {
                    const meta = TOPIC_STATUS_META[t.status] || TOPIC_STATUS_META.berjalan;
                    return (
                      <div key={t.topic}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-text truncate mr-2">{t.topic}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-text-secondary">{t.accuracy}%</span>
                            <span className={`badge text-[10px] ${meta.cls}`}>{meta.label}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-background rounded-full overflow-hidden border border-border/50">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${t.accuracy}%` }}
                            transition={{ duration: 0.6 }}
                            className={`h-full rounded-full ${t.accuracy >= 70 ? 'bg-success' : t.accuracy >= 40 ? 'bg-warning' : 'bg-danger'}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Score history chart */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Perkembangan Skor</h2>
              </div>
              <ScoreChart history={scoreHistory} />
            </motion.div>
          </div>

          {/* ─── Sidebar (1/3) ─── */}
          <div className="space-y-6">
            {/* Active study plan */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarCheck size={16} className="text-accent-blue" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Rencana Belajar</h2>
              </div>
              {activePlan ? (
                <div>
                  <p className="text-sm font-semibold text-text mb-1">{activePlan.title}</p>
                  <p className="text-xs text-text-muted mb-3">
                    Hari {activePlan.completed_days}/{activePlan.total_days} selesai
                    {activePlan.start_date ? ` • mulai ${formatDate(activePlan.start_date)}` : ''}
                  </p>
                  <div className="h-2 bg-background rounded-full overflow-hidden border border-border/50 mb-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${activePlan.progress}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                  <button
                    onClick={() => navigate('/exam-analyzer')}
                    className="w-full text-xs text-primary hover:text-primary/80 transition-colors text-left"
                  >
                    Lanjutkan belajar di Ujian Simulasi →
                  </button>
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  Belum ada rencana belajar. Setelah selesai ujian simulasi, rencana otomatis dibuat untuk topik yang masih lemah.
                </p>
              )}
            </motion.div>

            {/* Recent activity */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-text-secondary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Aktivitas Terbaru</h2>
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-text-muted">Belum ada aktivitas.</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((a, i) => {
                    const meta = ACTIVITY_META[a.type] || ACTIVITY_META.materi;
                    const Icon = meta.icon;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.cls}`}>
                          <Icon size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-text truncate" title={a.label}>{a.label}</p>
                          <p className="text-[10px] text-text-muted">
                            {meta.label} • {formatDate(a.date)}
                            {a.score != null && <span className="ml-1 font-semibold text-success">{a.score}</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* ─── Materials table ─── */}
        <div className="card-base overflow-x-auto p-0">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <FileText size={14} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Materi ({subject.total_materials})</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {subject.materials.length === 0 ? (
                <tr>
                  <td className="text-center py-10 text-text-muted">Belum ada materi untuk mata kuliah ini.</td>
                </tr>
              ) : (
                subject.materials.map((m, idx) => (
                  <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3 text-text-muted text-xs w-8">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{fileIcon(m.material_type)}</span>
                        <span className="text-text font-medium truncate max-w-[300px]" title={m.filename}>{m.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{m.material_type}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`badge text-[10px] ${m.status === 'Ready' ? 'badge-success' : m.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">{formatDate(m.upload_date)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isEditOpen && (
          <EditSubjectModal
            subject={subject}
            onClose={() => setIsEditOpen(false)}
            onSuccess={() => {
              setIsEditOpen(false);
              queryClient.invalidateQueries(['subject-dashboard', subjectId]);
              queryClient.invalidateQueries(['subjects']);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
