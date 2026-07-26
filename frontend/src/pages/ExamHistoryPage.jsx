import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, Search, Filter, Trophy, TrendingUp, AlertTriangle,
  BookOpen, Calendar, RotateCcw, Trash2, ChevronRight, ChevronDown,
  CheckCircle, XCircle, Clock, Target, Award, Lightbulb,
  BarChart2, Brain, Star, Check, Loader2, ArrowLeft,
  FileText, BookMarked, X, ChevronLeft,
} from 'lucide-react';
import { examHistoryAPI, examAPI, subjectAPI } from '@/services/api';
import { cn } from '@/utils';
import { useNavigate } from 'react-router-dom';
import MathMarkdown from '@/components/MathMarkdown';

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_META = {
  mastered:       { label: 'Mastered',        color: 'success', border: 'border-success/40',  bg: 'bg-success/5'  },
  completed:      { label: 'Selesai',          color: 'primary', border: 'border-primary/30',  bg: 'bg-primary/5'  },
  sedang_belajar: { label: 'Sedang Belajar',   color: 'blue',    border: 'border-accent-blue/30', bg: 'bg-accent-blue/5' },
  draft:          { label: 'Draft',            color: 'warning', border: 'border-warning/30',  bg: 'bg-warning/5'  },
  archived:       { label: 'Arsip',            color: 'teal',    border: 'border-accent-teal/30', bg: 'bg-accent-teal/5' },
};

const BADGE_META = {
  90: { label: 'Excellent',         color: 'success' },
  80: { label: 'Very Good',         color: 'primary' },
  70: { label: 'Good',              color: 'blue'    },
  0:  { label: 'Need Improvement',  color: 'danger'  },
};

function getBadge(score) {
  if (score >= 90) return BADGE_META[90];
  if (score >= 80) return BADGE_META[80];
  if (score >= 70) return BADGE_META[70];
  return BADGE_META[0];
}

function getGradeColor(grade) {
  return grade === 'A' ? 'text-success' : grade === 'B' ? 'text-primary'
       : grade === 'C' ? 'text-warning'  : 'text-danger';
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function Chip({ label, color = 'primary', size = 'sm' }) {
  const cls = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger:  'bg-danger/10 text-danger border-danger/20',
    blue:    'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
    teal:    'bg-accent-teal/10 text-accent-teal border-accent-teal/20',
    purple:  'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
  };
  return (
    <span className={cn('border rounded-full font-medium', cls[color] || cls.primary,
      size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5')}>
      {label}
    </span>
  );
}

function ProgressBar({ value = 0, color = 'primary' }) {
  const bg = color === 'success' ? 'bg-success' : color === 'warning' ? 'bg-warning'
           : color === 'danger'  ? 'bg-danger'  : 'bg-primary';
  return (
    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', bg)}
        style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExamHistoryPage() {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const [search,    setSearch]    = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy,    setSortBy]    = useState('newest');
  const [detailId,  setDetailId]  = useState(null);   // open detail modal

  const { data, isLoading } = useQuery({
    queryKey: ['exam-history'],
    queryFn:  () => examHistoryAPI.list().then(r => r.data),
    refetchOnWindowFocus: true,
  });

  const sessions = data?.sessions || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => examHistoryAPI.delete(id),
    onSuccess:  () => queryClient.invalidateQueries(['exam-history']),
  });

  // ── Filter + sort ──
  const filtered = useMemo(() => {
    let list = [...sessions];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.subject_name?.toLowerCase().includes(q) ||
        s.exam_type?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all')   list = list.filter(s => s.exam_type === typeFilter);
    if (statusFilter !== 'all') list = list.filter(s => s.status === statusFilter);
    list.sort((a, b) => {
      if (sortBy === 'newest')   return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'oldest')   return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'highest')  return (b.best_score||0) - (a.best_score||0);
      if (sortBy === 'lowest')   return (a.best_score||0) - (b.best_score||0);
      return a.subject_name?.localeCompare(b.subject_name || '') || 0;
    });
    return list;
  }, [sessions, search, typeFilter, statusFilter, sortBy]);

  const handleDelete = (id) => {
    if (!confirm('Hapus riwayat ujian ini beserta semua data attempt-nya?')) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <History size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text">Exam History</h1>
              <p className="text-text-secondary text-sm">Riwayat simulasi &amp; perkembangan belajar</p>
            </div>
          </div>
          <button onClick={() => navigate('/exam-analyzer')} className="btn-primary text-xs">
            <Brain size={13} /> Buat Simulasi Baru
          </button>
        </div>

        {/* Search + Filters */}
        <div className="card-base p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari mata kuliah, jenis ujian, topik..."
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary"
              />
            </div>
            {search && (
              <button onClick={() => setSearch('')} className="p-2 rounded-lg border border-border bg-card text-text-muted hover:text-text">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Type */}
            {['all','uts','uas','quiz','latihan_harian','custom'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                  typeFilter === t ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
                {t === 'all' ? 'Semua' : t.toUpperCase().replace('_',' ')}
              </button>
            ))}
            <div className="w-px bg-border mx-1" />
            {/* Status */}
            {[['all','Semua'],['mastered','Mastered'],['completed','Selesai'],['sedang_belajar','Belajar']].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)}
                className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                  statusFilter === v ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
                {l}
              </button>
            ))}
            <div className="w-px bg-border mx-1" />
            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1 bg-card border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
              <option value="highest">Nilai Tertinggi</option>
              <option value="lowest">Nilai Terendah</option>
              <option value="name">Nama A-Z</option>
            </select>
          </div>
        </div>

        {/* Stats bar */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label:'Total Simulasi', value: sessions.length,                              icon: History,   color:'text-primary' },
              { label:'Mastered',       value: sessions.filter(s=>s.status==='mastered').length, icon: Award,  color:'text-success' },
              { label:'Rata-rata Nilai',value: Math.round(sessions.reduce((a,s)=>a+(s.best_score||0),0)/sessions.length)||0, icon: BarChart2, color:'text-warning' },
              { label:'Total Attempt',  value: sessions.reduce((a,s)=>a+(s.attempt_count||0),0), icon: RotateCcw, color:'text-accent-blue' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card-base p-4 flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0', color)}>
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-xl font-bold text-text">{value}</p>
                  <p className="text-xs text-text-muted">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Card grid */}
        {isLoading ? (
          <div className="text-center py-20"><Loader2 size={32} className="animate-spin text-primary mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="card-base p-20 text-center">
            <History size={56} className="mx-auto mb-4 text-text-muted opacity-30" />
            <h3 className="text-lg font-semibold text-text mb-2">
              {sessions.length === 0 ? 'Belum Ada Riwayat' : 'Tidak Ditemukan'}
            </h3>
            <p className="text-text-muted text-sm mb-6">
              {sessions.length === 0
                ? 'Selesaikan simulasi ujian pertama kamu untuk melihat riwayat di sini.'
                : 'Coba ubah filter atau kata kunci pencarian.'}
            </p>
            {sessions.length === 0 && (
              <button onClick={() => navigate('/exam-analyzer')} className="btn-primary mx-auto">
                <Brain size={14} /> Mulai Simulasi
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map(s => (
                <HistoryCard key={s.id} session={s}
                  onDetail={() => setDetailId(s.id)}
                  onDelete={() => handleDelete(s.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {detailId && (
          <DetailModal historySessionId={detailId} onClose={() => setDetailId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}


// ─── History Card ─────────────────────────────────────────────────────────────
function HistoryCard({ session: s, onDetail, onDelete }) {
  const meta    = STATUS_META[s.status] || STATUS_META.completed;
  const badge   = getBadge(s.best_score || 0);
  const gradeC  = getGradeColor(s.grade);
  const attempts= s.attempts || [];
  const hasGrowth = attempts.length >= 2;
  const growth  = hasGrowth
    ? (attempts[attempts.length-1].score || 0) - (attempts[0].score || 0)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn('card-base p-5 flex flex-col border-l-4', meta.border, meta.bg)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <Chip label={s.exam_type?.toUpperCase() || 'SIMULASI'} size="xs" color="blue" />
            <Chip label={meta.label} size="xs" color={meta.color} />
            {s.status === 'mastered' && <Star size={11} className="text-warning fill-warning" />}
          </div>
          <h3 className="font-bold text-text text-sm leading-snug line-clamp-2">{s.title}</h3>
          <p className="text-xs text-text-muted mt-0.5">{s.subject_name}</p>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className={cn('text-3xl font-black', gradeC)}>{s.best_score ?? '--'}</p>
          <p className={cn('text-sm font-bold', gradeC)}>Grade {s.grade || '?'}</p>
        </div>
      </div>

      {/* Badge */}
      <div className="mb-3">
        <Chip label={badge.label} size="xs" color={badge.color} />
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Progress</span>
          <span>{s.progress || 0}%</span>
        </div>
        <ProgressBar value={s.progress || 0}
          color={s.status === 'mastered' ? 'success' : s.progress >= 70 ? 'primary' : 'warning'} />
      </div>

      {/* Attempt timeline mini */}
      {attempts.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 flex-wrap">
          {attempts.slice(-5).map((a, i) => (
            <div key={a.id} className="flex items-center gap-1">
              <span className={cn('text-xs font-bold',
                (a.score||0) >= 80 ? 'text-success' : (a.score||0) >= 60 ? 'text-warning' : 'text-danger')}>
                {a.score ?? '--'}
              </span>
              {i < Math.min(attempts.length, 5) - 1 && <ChevronRight size={10} className="text-text-muted" />}
            </div>
          ))}
          {hasGrowth && growth > 0 && (
            <span className="text-xs text-success ml-1 flex items-center gap-0.5">
              <TrendingUp size={10} /> +{growth}
            </span>
          )}
        </div>
      )}

      {/* Weak topics peek */}
      {(s.weak_topics || []).slice(0, 2).length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {s.weak_topics.slice(0, 2).map((t, i) => (
            <Chip key={i} label={t.topic || t} size="xs" color="danger" />
          ))}
        </div>
      )}

      {/* Meta row */}
      <div className="text-xs text-text-muted flex items-center gap-3 mb-4">
        <span className="flex items-center gap-1"><RotateCcw size={10} /> {s.attempt_count} attempt</span>
        <span className="flex items-center gap-1"><Clock size={10} />
          {s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID') : '--'}
        </span>
        {s.has_study_plan && (
          <span className="flex items-center gap-1 text-primary">
            <Calendar size={10} /> {s.study_plan_progress}% plan
          </span>
        )}
      </div>

      {/* Buttons */}
      <div className="mt-auto flex gap-2">
        <button onClick={onDetail}
          className="btn-primary text-xs flex-1 justify-center">
          <ChevronRight size={12} /> Detail
        </button>
        <button onClick={onDelete}
          className="p-2 rounded-lg border border-border bg-card text-text-muted hover:text-danger hover:border-danger/30 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}


// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ historySessionId, onClose }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview'); // overview | review | plan | attempts

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['exam-history-detail', historySessionId],
    queryFn:  () => examHistoryAPI.detail(historySessionId).then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (itemId) => examHistoryAPI.togglePlanItem(itemId),
    onSuccess: () => { refetch(); queryClient.invalidateQueries(['exam-history']); },
  });

  if (isLoading) {
    return (
      <ModalShell onClose={onClose}>
        <div className="flex-1 flex items-center justify-center p-20">
          <Loader2 size={36} className="animate-spin text-primary" />
        </div>
      </ModalShell>
    );
  }
  if (!data) return null;

  const latestAttempt = data.attempts?.[data.attempts.length - 1];
  const meta  = STATUS_META[data.status] || STATUS_META.completed;
  const badge = getBadge(data.best_score || 0);

  return (
    <ModalShell onClose={onClose}>
      {/* Modal header */}
      <div className="p-5 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Chip label={data.exam_type?.toUpperCase() || 'SIMULASI'} size="xs" color="blue" />
              <Chip label={meta.label} size="xs" color={meta.color} />
              <Chip label={badge.label} size="xs" color={badge.color} />
            </div>
            <h2 className="text-lg font-bold text-text">{data.title}</h2>
            <p className="text-sm text-text-muted">{data.subject_name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className={cn('text-4xl font-black', getGradeColor(data.grade))}>{data.best_score ?? '--'}</p>
            <p className={cn('text-sm font-bold', getGradeColor(data.grade))}>Grade {data.grade || '?'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {[
            { id:'overview', label:'Ringkasan',  icon: BarChart2 },
            { id:'review',   label:'Review',     icon: BookOpen  },
            { id:'plan',     label:'Study Plan', icon: Calendar  },
            { id:'attempts', label:'Attempts',   icon: RotateCcw },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                tab === id ? 'bg-primary text-white' : 'bg-card text-text-secondary hover:text-text border border-border')}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Modal body */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'overview'  && <OverviewTab data={data} />}
        {tab === 'review'    && <ReviewTab attempt={latestAttempt} />}
        {tab === 'plan'      && <StudyPlanTab plan={data.study_plan} onToggle={(id) => toggleMutation.mutate(id)} />}
        {tab === 'attempts'  && <AttemptsTab attempts={data.attempts || []} />}
      </div>

      {/* Modal footer */}
      <div className="p-4 border-t border-border shrink-0 flex gap-2 flex-wrap">
        <RetryButton historySessionId={historySessionId} sessionData={data} onClose={onClose} />
        <button onClick={onClose} className="btn-ghost text-sm border border-border ml-auto">
          Tutup
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-3xl max-h-[90vh] flex flex-col card-base shadow-2xl overflow-hidden"
      >
        {children}
      </motion.div>
    </div>
  );
}


// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ data }) {
  const attempts = data.attempts || [];
  const hasGrowth = attempts.length >= 2;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="card-base p-4">
        <div className="flex justify-between mb-2">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Progress Keseluruhan</span>
          <span className="text-xs font-bold text-text">{data.progress || 0}%</span>
        </div>
        <ProgressBar value={data.progress || 0}
          color={data.status === 'mastered' ? 'success' : (data.progress||0) >= 70 ? 'primary' : 'warning'} />
        {data.overall_feedback && (
          <p className="text-xs text-text-secondary mt-2">{data.overall_feedback}</p>
        )}
      </div>

      {/* Score history chart (text-based) */}
      {hasGrowth && (
        <div className="card-base p-4">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Perkembangan Nilai</p>
          <div className="flex items-end gap-3 h-16">
            {attempts.map((a, i) => {
              const h = Math.max(8, ((a.score||0)/100)*64);
              return (
                <div key={a.id} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[10px] font-bold text-text">{a.score}</span>
                  <div className="w-full rounded-t-md bg-primary/20 relative overflow-hidden"
                    style={{ height: `${h}px` }}>
                    <div className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-md"
                      style={{ height: `${h}px` }} />
                  </div>
                  <span className="text-[9px] text-text-muted">#{i+1}</span>
                </div>
              );
            })}
          </div>
          {hasGrowth && (
            <p className="text-xs text-success mt-2 flex items-center gap-1">
              <TrendingUp size={11} />
              Peningkatan: +{(attempts[attempts.length-1].score||0) - (attempts[0].score||0)} poin
            </p>
          )}
        </div>
      )}

      {/* Topics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(data.strong_topics || []).length > 0 && (
          <div className="p-3 rounded-xl bg-success/5 border border-success/15">
            <p className="text-xs font-semibold text-success mb-2 flex items-center gap-1">
              <TrendingUp size={11} /> Topik Dikuasai
            </p>
            {data.strong_topics.slice(0,5).map((t,i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-success/10 last:border-0">
                <span className="text-xs text-text">{t.topic || t}</span>
                {t.mastery && <Chip label={t.mastery} size="xs" color="success" />}
              </div>
            ))}
          </div>
        )}
        {(data.weak_topics || []).length > 0 && (
          <div className="p-3 rounded-xl bg-danger/5 border border-danger/15">
            <p className="text-xs font-semibold text-danger mb-2 flex items-center gap-1">
              <AlertTriangle size={11} /> Topik Lemah
            </p>
            {data.weak_topics.slice(0,5).map((t,i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-danger/10 last:border-0">
                <span className="text-xs text-text">{t.topic || t}</span>
                {t.priority && <Chip label={t.priority} size="xs"
                  color={t.priority==='Tinggi'?'danger':t.priority==='Menengah'?'warning':'teal'} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Review Tab ───────────────────────────────────────────────────────────────
function ReviewTab({ attempt }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [explanations, setExplanations] = useState({});
  const reviews = attempt?.reviews || [];

  if (!attempt) return <p className="text-text-muted text-sm py-8 text-center">Belum ada data review.</p>;
  if (reviews.length === 0) return <p className="text-text-muted text-sm py-8 text-center">Data review tidak tersedia untuk attempt ini.</p>;

  const correct = reviews.filter(r => r.is_correct).length;
  const total   = reviews.length;

  const fetchExplanation = async (r, i) => {
    if (explanations[i]?.text) return;
    setExplanations(prev => ({ ...prev, [i]: { loading: true, text: '', error: '' } }));
    try {
      const res = await examAPI.getExplanation({
        question:      r.question_text,
        correct_answer: r.correct_answer || '',
        topic:         r.topic || '',
      });
      const text = res.data?.explanation || 'Penjelasan tidak tersedia.';
      setExplanations(prev => ({ ...prev, [i]: { loading: false, text, error: '' } }));
    } catch {
      setExplanations(prev => ({ ...prev, [i]: { loading: false, text: '', error: 'Gagal memuat penjelasan.' } }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border text-sm">
        <CheckCircle size={14} className="text-success" />
        <span className="text-text">{correct}/{total} benar</span>
        <span className="text-text-muted">·</span>
        <span className="text-text-muted">Attempt #{attempt.attempt_number}</span>
      </div>

      {reviews.map((r, i) => {
        const expl = explanations[i];
        return (
          <div key={r.id || i}
            className={cn('rounded-xl border overflow-hidden',
              r.is_correct ? 'border-success/25' : 'border-danger/25')}>
            <button onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-background/40 transition-colors">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                r.is_correct ? 'bg-success' : 'bg-danger')}>
                {r.is_correct ? <CheckCircle size={13} className="text-white" /> : <XCircle size={13} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-text-muted mb-0.5">{r.topic} · {r.question_type} · {r.difficulty}</p>
                <div className="text-sm text-text line-clamp-2">
                  <MathMarkdown>{r.question_text}</MathMarkdown>
                </div>
              </div>
              <ChevronDown size={13} className={cn('text-text-muted shrink-0 transition-transform', expandedIdx === i && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {expandedIdx === i && (
                <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
                  transition={{ duration:0.2 }} className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-2 border-t border-border/40 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="p-2 rounded-lg bg-background">
                        <p className="text-[10px] text-text-muted mb-0.5">Jawaban Kamu</p>
                        <div className={cn('font-medium text-sm', r.is_correct ? 'text-success' : 'text-danger')}>
                          <MathMarkdown>{r.user_answer || '(Tidak dijawab)'}</MathMarkdown>
                        </div>
                      </div>
                      {!r.is_correct && (
                        <div className="p-2 rounded-lg bg-success/5 border border-success/15">
                          <p className="text-[10px] text-text-muted mb-0.5">Jawaban Benar</p>
                          <div className="font-medium text-sm text-success">
                            <MathMarkdown>{r.correct_answer}</MathMarkdown>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stored explanation */}
                    {r.ai_explanation && !expl?.text && (
                      <div className="p-2 rounded-lg bg-primary/5 border border-primary/15 text-xs text-text">
                        <p className="font-semibold text-primary mb-0.5">Penjelasan AI</p>
                        <MathMarkdown>{r.ai_explanation}</MathMarkdown>
                      </div>
                    )}

                    {/* Lazy explanation result */}
                    {expl?.text && (
                      <div className="p-2 rounded-lg bg-accent-teal/5 border border-accent-teal/20 text-xs text-text">
                        <p className="font-semibold text-accent-teal mb-0.5 flex items-center gap-1">
                          <Lightbulb size={10} /> Penjelasan AI
                        </p>
                        <MathMarkdown>{expl.text}</MathMarkdown>
                      </div>
                    )}
                    {expl?.error && <p className="text-[10px] text-danger">{expl.error}</p>}

                    <div className="flex items-center gap-3 text-[10px] text-text-muted flex-wrap">
                      {r.material_ref && <span className="flex items-center gap-1"><FileText size={10}/>{r.material_ref}</span>}
                      {r.tips && <span className="flex items-center gap-1 text-primary"><Lightbulb size={10}/>{r.tips}</span>}
                      {!r.ai_explanation && !expl?.text && (
                        <button
                          onClick={() => fetchExplanation(r, i)}
                          disabled={expl?.loading}
                          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent-teal/10 text-accent-teal border border-accent-teal/20 hover:bg-accent-teal/20 transition-colors disabled:opacity-50"
                        >
                          {expl?.loading
                            ? <><Loader2 size={10} className="animate-spin" /> Memuat...</>
                            : <><Lightbulb size={10} /> Jelaskan</>}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}


// ─── Study Plan Tab ───────────────────────────────────────────────────────────
function StudyPlanTab({ plan, onToggle }) {
  if (!plan) return (
    <p className="text-text-muted text-sm py-8 text-center">
      Belum ada rencana belajar tersimpan untuk sesi ini.
    </p>
  );

  const typeColor = { review:'blue', practice:'purple', simulation:'warning', rest:'success' };

  return (
    <div className="space-y-4">
      {plan.motivational_message && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 flex items-start gap-2">
          <Award size={14} className="text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-text">{plan.motivational_message}</p>
        </div>
      )}

      {/* Plan progress */}
      <div className="flex justify-between text-xs text-text-muted mb-1">
        <span>Progress Rencana Belajar</span>
        <span>{plan.completed_days}/{plan.total_days} hari · {plan.progress}%</span>
      </div>
      <ProgressBar value={plan.progress} color={plan.progress >= 100 ? 'success' : 'primary'} />

      {/* Priority actions */}
      {(plan.priority_actions || []).length > 0 && (
        <div className="p-3 rounded-xl bg-card border border-border">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Aksi Prioritas</p>
          {plan.priority_actions.map((a, i) => (
            <p key={i} className="text-xs text-text flex items-start gap-1.5 py-1">
              <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i+1}</span>
              {a}
            </p>
          ))}
        </div>
      )}

      {/* Day items */}
      <div className="space-y-2">
        {(plan.items || []).map((item) => (
          <div key={item.id}
            className={cn('flex items-start gap-3 p-3 rounded-xl border transition-all',
              item.completed ? 'bg-success/5 border-success/20 opacity-80' : 'bg-card border-border')}>
            <button onClick={() => onToggle(item.id)}
              className={cn('w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                item.completed ? 'bg-success border-success text-white' : 'border-border hover:border-primary')}>
              {item.completed && <Check size={11} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-text-muted">{item.day_label}</span>
                <Chip label={item.activity_type || 'review'} size="xs"
                  color={typeColor[item.activity_type] || 'blue'} />
                {item.duration_minutes && (
                  <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                    <Clock size={9} />{item.duration_minutes}m
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-text">{item.topic}</p>
              {item.activity && <p className="text-xs text-text-secondary">{item.activity}</p>}
              {item.resources && (
                <p className="text-[10px] text-primary mt-0.5 flex items-center gap-0.5">
                  <Lightbulb size={9}/>{item.resources}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Attempts Tab ─────────────────────────────────────────────────────────────
function AttemptsTab({ attempts }) {
  if (!attempts.length) return <p className="text-text-muted text-sm py-8 text-center">Belum ada attempt.</p>;

  return (
    <div className="space-y-3">
      {attempts.map((a, i) => {
        const gradeC = getGradeColor(a.grade);
        const isLatest = i === attempts.length - 1;
        const prevScore = i > 0 ? (attempts[i-1].score || 0) : null;
        const delta = prevScore !== null ? (a.score || 0) - prevScore : null;
        return (
          <div key={a.id}
            className={cn('p-4 rounded-xl border flex items-center gap-4',
              isLatest ? 'border-primary/30 bg-primary/5' : 'border-border bg-card')}>
            <div className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
              #{a.attempt_number}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-2xl font-black', gradeC)}>{a.score ?? '--'}</span>
                <span className={cn('text-sm font-bold', gradeC)}>Grade {a.grade || '?'}</span>
                {isLatest && <Chip label="Terbaru" size="xs" color="primary" />}
                {delta !== null && (
                  <span className={cn('text-xs font-semibold flex items-center gap-0.5',
                    delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-text-muted')}>
                    {delta > 0 ? <TrendingUp size={10}/> : delta < 0 ? '↓' : '='}
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
              <div className="flex gap-3 text-xs text-text-muted">
                <span className="flex items-center gap-1"><CheckCircle size={10} className="text-success"/>{a.total_correct} benar</span>
                <span className="flex items-center gap-1"><XCircle size={10} className="text-danger"/>{a.total_wrong} salah</span>
                {a.duration_seconds && (
                  <span className="flex items-center gap-1"><Clock size={10}/>
                    {Math.floor(a.duration_seconds/60)}:{String(a.duration_seconds%60).padStart(2,'0')}
                  </span>
                )}
                <span>{a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID') : '--'}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ─── Retry Button ─────────────────────────────────────────────────────────────
function RetryButton({ historySessionId, sessionData, onClose }) {
  const navigate  = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleRetry = async () => {
    setError(''); setLoading(true);
    try {
      // Build a focused blueprint from weak topics
      const weakTopics = sessionData.weak_topics || [];
      const topicFocusStr = weakTopics.length
        ? weakTopics.map(t => t.topic || t).join(', ')
        : 'Semua Materi';

      // Generate a new blueprint using same settings
      const bpPayload = {
        subject_id:      sessionData.subject_id,
        exam_type:       sessionData.exam_type || 'latihan_harian',
        total_questions: Math.min(sessionData.total_questions || 10, 15),
        difficulty:      sessionData.difficulty || 'menengah',
        bloom_level:     sessionData.bloom_level || 'mixed',
        question_type:   sessionData.question_type || 'mixed',
        focus_material:  topicFocusStr,
        duration_minutes: 30,
      };
      const bpRes = await examAPI.generateBlueprint(bpPayload);
      if (bpRes.data?.detail) throw new Error(bpRes.data.detail);

      const blueprintId = bpRes.data?.blueprint_id;
      if (!blueprintId) throw new Error('Blueprint ID tidak ditemukan.');

      // Generate questions
      const qRes = await examAPI.generateQuestions(blueprintId);
      if (qRes.data?.detail) throw new Error(qRes.data.detail);

      // Store retry context in sessionStorage so ExamAnalyzerPage can pick it up
      sessionStorage.setItem('retry_history_session_id', String(historySessionId));
      sessionStorage.setItem('retry_session_data', JSON.stringify({
        ...qRes.data,
        subject_id: sessionData.subject_id,
        subject_name: sessionData.subject_name,
      }));

      onClose();
      navigate('/exam-analyzer?retry=1');
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Gagal memulai latihan ulang.');
    } finally { setLoading(false); }
  };

  return (
    <div>
      {error && <p className="text-danger text-xs mb-2">{error}</p>}
      <button onClick={handleRetry} disabled={loading} className="btn-primary text-sm">
        {loading
          ? <><Loader2 size={13} className="animate-spin"/> Menyiapkan...</>
          : <><RotateCcw size={13}/> Latihan Lagi</>}
      </button>
    </div>
  );
}
