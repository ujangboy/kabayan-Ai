import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, History, Zap, Search, X, ChevronRight, Trash2,
  RotateCcw, Clock, Calendar, Star, Award, BarChart2, FileText, Loader2,
  Trophy, HelpCircle, CreditCard,
} from 'lucide-react';
import { materiAPI, sessionsAPI, subjectAPI } from '@/services/api';
import { cn, formatDate, formatTimeOnly } from '@/utils';
import DetailModal from './DetailModal';
import { Chip, ProgressBar, STATUS_META, getBadge, getGradeColor, Q_TYPE_LABEL } from './shared';

// ─── Subject picker (shown when no subject selected) ──────────────────────────
function SubjectPicker({ subjects, onSelectSubject, onStartConfig, t }) {
   const navigate = useNavigate();
   const queryClient = useQueryClient();

   const deleteMutation = useMutation({
     mutationFn: (id) => subjectAPI.delete(id),
     onSuccess: () => queryClient.invalidateQueries(['subjects']),
   });

   const handleDelete = (id) => {
     if (confirm(t('exam.history.deleteSubjectConfirm'))) {
       deleteMutation.mutate(id);
     }
   };

   if (!subjects.length) {
     return (
       <div className="card-base p-16 text-center">
         <BookOpen size={48} className="mx-auto mb-4 text-primary opacity-40" />
         <h3 className="text-lg font-semibold text-text mb-2">{t('exam.history.noSubjects')}</h3>
         <p className="text-text-muted text-sm max-w-md mx-auto mb-5">
           {t('exam.history.noSubjectsDesc')}
         </p>
         <button onClick={() => navigate('/materi')} className="btn-primary text-sm">
           <BookOpen size={14} /> {t('exam.history.addSubject')}
         </button>
       </div>
     );
   }

   return (
     <div>
       <h2 className="text-lg font-semibold text-text mb-1">{t('exam.history.selectSubject')}</h2>
       <p className="text-text-muted text-sm mb-5">
         {t('exam.history.selectSubjectDesc')}
       </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map(s => (
          <SubjectCard
            key={s.id}
            subject={s}
            onSelectSubject={onSelectSubject}
            onStartConfig={onStartConfig}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

function SubjectCard({ subject, onSelectSubject, onStartConfig, onDelete, t }) {
   const { data: materialData, isLoading } = useQuery({
     queryKey: ['materials', subject.id],
     queryFn: () => materiAPI.getAll(subject.id).then(r => r.data),
     staleTime: 5 * 60 * 1000,
   });
   const subjectMaterials = materialData?.materials || [];

   if (isLoading) {
     return (
       <div className="card-base p-5 flex flex-col gap-3">
         <div className="flex items-start gap-3">
           <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
             <BookOpen size={18} />
           </div>
           <div className="flex-1 min-w-0">
             <h3 className="font-semibold text-text truncate">{subject.name}</h3>
             <p className="text-xs text-text-muted">{t('exam.history.loadingMaterials')}</p>
           </div>
         </div>
         <div className="flex gap-2 mt-auto">
           <button disabled className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-text text-xs font-medium opacity-50">
             <History size={12} className="inline mr-1 -mt-0.5" /> {t('exam.history.history')}
           </button>
           <button disabled className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium opacity-50">
             <Zap size={12} className="inline mr-1 -mt-0.5" /> {t('exam.history.simulation')}
           </button>
         </div>
       </div>
     );
   }

   const materialCount = subjectMaterials.length;

   return (
     <div className="card-base p-5 flex flex-col gap-3 hover:border-primary/40 transition-colors">
       <div className="flex items-start gap-3">
         <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
           <BookOpen size={18} />
         </div>
         <div className="flex-1 min-w-0">
           <h3 className="font-semibold text-text truncate">{subject.name}</h3>
           <p className="text-xs text-text-muted">{materialCount} materi</p>
         </div>
         {onDelete && (
           <button
             onClick={(e) => { e.stopPropagation(); onDelete(subject.id); }}
             className="p-1 text-text-muted hover:text-danger transition-colors shrink-0"
             title={t('exam.history.deleteSubject')}
           >
             <Trash2 size={14} />
           </button>
         )}
       </div>

      {/* Ringkasan stats */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg bg-background/60 py-1.5 px-1 text-center">
          <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><Trophy size={11} className="text-warning" />{subject.best_score ?? '—'}</p>
          <p className="text-[9px] text-text-muted uppercase tracking-wide">Skor</p>
        </div>
        <div className="rounded-lg bg-background/60 py-1.5 px-1 text-center">
          <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><HelpCircle size={11} className="text-accent-teal" />{subject.total_quizzes ?? 0}</p>
          <p className="text-[9px] text-text-muted uppercase tracking-wide">Quiz</p>
        </div>
        <div className="rounded-lg bg-background/60 py-1.5 px-1 text-center">
          <p className="text-sm font-bold text-text flex items-center justify-center gap-1"><CreditCard size={11} className="text-accent-purple" />{subject.total_flashcards ?? 0}</p>
          <p className="text-[9px] text-text-muted uppercase tracking-wide">Flashcard</p>
        </div>
      </div>

      {/* Daftar nama materi */}
      {subjectMaterials.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {subjectMaterials.slice(0, 3).map((m, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[200px]">
              <FileText size={8} className="shrink-0" />
              {m.filename || `Materi #${m.id}`}
            </span>
          ))}
          {subjectMaterials.length > 3 && (
            <span className="text-[10px] text-text-muted self-center">+{subjectMaterials.length - 3} lagi</span>
          )}
        </div>
      )}

      {/* Tanggal + waktu dibuat */}
      {subject.created_at && (
        <div className="flex items-center gap-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1"><Calendar size={9} />{formatDate(subject.created_at)}</span>
          <span className="flex items-center gap-1"><Clock size={9} />{formatTimeOnly(subject.created_at)}</span>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button onClick={() => onSelectSubject(subject.id)} className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-text text-xs font-medium hover:border-primary/40 transition-colors">
           <History size={12} className="inline mr-1 -mt-0.5" /> {t('exam.history.history')}
         </button>
         <button onClick={() => onStartConfig(subject.id)} className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 transition-opacity">
           <Zap size={12} className="inline mr-1 -mt-0.5" /> {t('exam.history.simulation')}
         </button>
      </div>
    </div>
  );
}

export default function HistoryView({ subjectId, subjects, onSelectSubject, onStartConfig, onResume, detailId, setDetailId, pendingPlanTab, setPendingPlanTab }) {
   const { t } = useTranslation();
   const queryClient   = useQueryClient();
  const [search,    setSearch]    = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy,    setSortBy]    = useState('newest');

  const { data, isLoading } = useQuery({
    queryKey: ['exam-sessions', subjectId],
    queryFn:  () => sessionsAPI.list(subjectId).then(r => r.data),
    enabled: !!subjectId,
  });

  const sessions = data?.sessions || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => sessionsAPI.delete(id),
    onSuccess:  () => queryClient.invalidateQueries(['exam-sessions']),
  });

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

  if (!subjectId) {
    return <SubjectPicker subjects={subjects} onSelectSubject={onSelectSubject} onStartConfig={onStartConfig} t={t} />;
  }

   const handleDelete = (id) => {
     if (!confirm(t('exam.history.deleteSessionConfirm'))) return;
     deleteMutation.mutate(id);
   };

  if (isLoading) {
    return <div className="card-base p-10 text-center"><Loader2 size={28} className="animate-spin text-primary mx-auto" /></div>;
  }

   if (sessions.length === 0) {
     return (
       <div className="card-base p-16 text-center">
         <BarChart2 size={48} className="mx-auto mb-4 text-text-muted opacity-40" />
         <p className="text-text-muted text-sm mb-2">
           {t('exam.history.noHistory')}
         </p>
         <p className="text-text-muted text-xs mb-6">
           {t('exam.history.noHistoryDesc')}
         </p>
         <button onClick={() => onStartConfig(subjectId)} className="btn-primary text-sm">
           <Zap size={14} /> {t('exam.history.createSimulation')}
         </button>
       </div>
     );
   }

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="card-base p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
               placeholder={t('exam.history.searchPlaceholder')}
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
          {['all','uts','uas','quiz','latihan_harian','custom'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                typeFilter === t ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
               {t === 'all' ? t('exam.history.all') : t.toUpperCase().replace('_',' ')}
            </button>
          ))}
          <div className="w-px bg-border mx-1" />
          {[['all',t('exam.history.all')],['mastered',t('exam.history.mastered')],['completed',t('exam.history.completed')],['sedang_belajar',t('exam.history.studying')]].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                statusFilter === v ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
              {l}
            </button>
          ))}
          <div className="w-px bg-border mx-1" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="px-3 py-1 bg-card border border-border rounded-lg text-xs text-text focus:outline-none focus:border-primary">
             <option value="newest">{t('exam.history.sortNewest')}</option>
             <option value="oldest">{t('exam.history.sortOldest')}</option>
             <option value="highest">{t('exam.history.sortHighest')}</option>
             <option value="lowest">{t('exam.history.sortLowest')}</option>
             <option value="name">{t('exam.history.sortName')}</option>
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
      {filtered.length === 0 ? (
        <div className="card-base p-20 text-center">
          <History size={56} className="mx-auto mb-4 text-text-muted opacity-30" />
           <h3 className="text-lg font-semibold text-text mb-2">
             {sessions.length === 0 ? t('exam.history.noHistoryTitle') : t('exam.history.notFound')}
           </h3>
           <p className="text-text-muted text-sm">
             {sessions.length === 0
               ? t('exam.history.noHistoryDetail')
               : t('exam.history.noHistoryFilterDesc')}
           </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map(s => (
               <HistoryCard key={s.id} session={s} t={t}
                 onDetail={() => setDetailId(s.id)}
                 onDelete={() => handleDelete(s.id)}
               />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {detailId && (
          <DetailModal historySessionId={detailId} onClose={() => setDetailId(null)} onResume={onResume} pendingPlanTab={pendingPlanTab} setPendingPlanTab={setPendingPlanTab} />
        )}
      </AnimatePresence>
    </div>
  );
}

function HistoryCard({ session: s, onDetail, onDelete, t }) {
  const meta    = STATUS_META[s.status] || STATUS_META.completed;
  const badge   = getBadge(s.best_score || 0);
  const gradeC  = getGradeColor(s.grade);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn('card-base p-5 flex flex-col border-l-4', meta.border, meta.bg)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
             <Chip label={s.exam_type?.toUpperCase().replace('_',' ') || t('exam.history.defaultExamType')} size="xs" color="blue" />
            {s.question_type && s.question_type !== 'mixed' && (
              <Chip label={Q_TYPE_LABEL[s.question_type] || s.question_type} size="xs" color="purple" />
            )}
             {s.question_type === 'mixed' && (
               <Chip label={t('exam.history.mixed')} size="xs" color="teal" />
             )}
            <Chip label={meta.label} size="xs" color={meta.color} />
            {s.status === 'mastered' && <Star size={11} className="text-warning fill-warning" />}
          </div>
          <h3 className="font-bold text-text text-sm leading-snug line-clamp-2">{s.title}</h3>
          <p className="text-xs text-text-muted mt-0.5">{s.subject_name}</p>
          {/* Nama materi yang digunakan */}
          {(s.material_names || []).length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1.5">
              {(s.material_names || []).slice(0, 2).map((name, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 truncate max-w-[120px]">
                  <FileText size={8} className="shrink-0" />{name}
                </span>
              ))}
              {(s.material_names || []).length > 2 && (
                <span className="text-[10px] text-text-muted">+{s.material_names.length - 2} {t('exam.history.moreMaterials')}</span>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className={cn('text-3xl font-black', gradeC)}>{s.best_score ?? '--'}</p>
          <p className={cn('text-sm font-bold', gradeC)}>Grade {s.grade || '?'}</p>
        </div>
      </div>

      <div className="mb-3">
        <Chip label={badge.label} size="xs" color={badge.color} />
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Progress</span>
          <span>{s.progress || 0}%</span>
        </div>
        <ProgressBar value={s.progress || 0}
          color={s.status === 'mastered' ? 'success' : s.progress >= 70 ? 'primary' : 'warning'} />
      </div>

      {(s.weak_topics || []).slice(0, 2).length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {(s.weak_topics || []).slice(0, 2).map((t, i) => (
            <Chip key={i} label={typeof t === 'string' ? t : t.topic || ''} size="xs" color="danger" />
          ))}
        </div>
      )}

      <div className="text-xs text-text-muted flex items-center gap-3 mb-4">
        <span className="flex items-center gap-1"><RotateCcw size={10} /> {s.attempt_count || 0} {t('exam.history.attempt')}</span>
        <span className="flex items-center gap-1"><Clock size={10} />
          {s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID') : '--'}
          {s.created_at && (
            <span className="text-text-muted/70">
              {' '}{new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </span>
        {s.has_study_plan && (
          <span className="flex items-center gap-1 text-primary">
            <Calendar size={10} /> {s.study_plan_progress || 0}% plan
          </span>
        )}
        {s.has_study_plan && s.study_plan_start_date && (() => {
          const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
          const start = new Date(s.study_plan_start_date);
          const end = new Date(s.study_plan_start_date);
          end.setDate(end.getDate() + 6);
          const fmt = (d) => `${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
          return (
            <span className="text-[10px] text-text-muted flex items-center gap-1">
              <Calendar size={9}/> {fmt(start)} – {fmt(end)}
            </span>
          );
        })()}
      </div>

      <div className="mt-auto flex gap-2">
        <button onClick={onDetail}
          className="btn-primary text-xs flex-1 justify-center">
           <ChevronRight size={12} /> {t('exam.history.detail')}
        </button>
        <button onClick={onDelete}
          className="p-2 rounded-lg border border-border bg-card text-text-muted hover:text-danger hover:border-danger/30 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  );
}
