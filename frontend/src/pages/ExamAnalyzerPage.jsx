import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, BookOpen, Target, Map, AlertTriangle, ChevronRight,
  ChevronDown, Star, Loader2, RefreshCw, Zap, ClipboardList,
  Play, Pause, RotateCcw, CheckCircle, XCircle, Trophy,
  Calendar, ArrowRight, Clock, BarChart2, FileText,
  BookMarked, X, ChevronLeft, Info, TrendingUp, Award,
  Lightbulb, AlertCircle, Check, Search, Filter, Trash2, History
} from 'lucide-react';
import { examAPI, subjectAPI, materiAPI } from '@/services/api';
import { sessionsAPI } from '@/services/api';
import { cn } from '@/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import MathMarkdown from '@/components/MathMarkdown';
import MaterialPicker from '@/components/MaterialPicker';

// ─── View constants ─────────────────────────────────────────────────────────
const VIEW = {
  DASHBOARD:   'dashboard',
  CONFIG:      'config',
  BLUEPRINT:   'blueprint',
  GENERATING:  'generating',
  QUIZ:        'quiz',
  RESULT:      'result',
  REVIEW:      'review',
  RECOMMEND:   'recommend',
  HISTORY:     'history',
};


// ─── Config options ──────────────────────────────────────────────────────────
const EXAM_TYPES   = ['Latihan Harian','Quiz','UTS','UAS','Custom'];
const COUNTS       = [5,10,15,20,30,40,50];
const DIFFICULTIES = ['Pemula','Menengah','Sulit','Campuran'];
const BLOOMS       = ['Remember','Understand','Apply','Analyze','Evaluate','Create','Mixed'];
const Q_TYPES      = ['Pilihan Ganda','Benar / Salah','Isian Singkat','Essay','Studi Kasus','Analisis','Perhitungan','Campuran'];
const FOCUSES      = ['Semua Materi','Bab Tertentu','Topik Tertentu','Materi Lemah','Materi Favorit'];
const DURATIONS    = [
  { label:'10 Menit', value:10 },
  { label:'20 Menit', value:20 },
  { label:'30 Menit', value:30 },
  { label:'45 Menit', value:45 },
  { label:'60 Menit', value:60 },
  { label:'90 Menit', value:90 },
  { label:'Tanpa Batas', value:null },
];

const Q_TYPE_MAP = {
  'Pilihan Ganda':'mcq','Benar / Salah':'truefalse','Isian Singkat':'short_answer',
  'Essay':'essay','Studi Kasus':'case_study','Analisis':'analysis',
  'Perhitungan':'calculation','Campuran':'mixed',
};


// ─── Small shared components ─────────────────────────────────────────────────
function StarRating({ stars = 3 }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={12}
          className={i <= stars ? 'text-warning fill-warning' : 'text-border'}
        />
      ))}
    </span>
  );
}

function Chip({ label, color = 'primary', size = 'sm' }) {
  const cls = {
    primary:'bg-primary/10 text-primary border-primary/20',
    success:'bg-success/10 text-success border-success/20',
    warning:'bg-warning/10 text-warning border-warning/20',
    danger:'bg-danger/10 text-danger border-danger/20',
    purple:'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
    blue:'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
    teal:'bg-accent-teal/10 text-accent-teal border-accent-teal/20',
  };
  return (
    <span className={cn('border rounded-full font-medium', cls[color],
      size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5')}>
      {label}
    </span>
  );
}

function SectionHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon size={15} className="text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-text text-sm">{title}</h2>
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}


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
        } catch (_) {}
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
  const handleRecommendDone = (data) => { setRecommend(data); go(VIEW.RECOMMEND); };

  const resetToConfig = () => { setBlueprint(null); setSessionData(null); setEvalData(null); setRecommend(null); go(VIEW.CONFIG); };
  const startConfigFor = (id) => { setSubjectId(id); setAnalysis(null); setBlueprint(null); setSessionData(null); setEvalData(null); setRecommend(null); go(VIEW.CONFIG); };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {view !== VIEW.DASHBOARD && (
              <button onClick={() => {
                if ([VIEW.QUIZ, VIEW.GENERATING].includes(view)) return;
                const back = {
                  [VIEW.CONFIG]:     VIEW.DASHBOARD,
                  [VIEW.BLUEPRINT]:  VIEW.CONFIG,
                  [VIEW.RESULT]:     VIEW.QUIZ,
                  [VIEW.REVIEW]:     VIEW.RESULT,
                  [VIEW.RECOMMEND]:  VIEW.RESULT,
                  [VIEW.HISTORY]:    VIEW.HISTORY,
                }[view] || VIEW.DASHBOARD;
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
            {view === VIEW.BLUEPRINT  && <BlueprintView blueprint={blueprint} subjectId={subjectId} onGenerate={handleSessionReady} onBack={() => go(VIEW.CONFIG)} />}
            {view === VIEW.GENERATING && <GeneratingView />}
            {view === VIEW.QUIZ       && <QuizView sessionData={sessionData} onDone={handleEvalDone} />}
            {view === VIEW.RESULT     && <ResultView evalData={evalData} sessionData={sessionData} onReview={() => go(VIEW.REVIEW)} onRecommend={(d) => handleRecommendDone(d)} onFinish={() => go(VIEW.HISTORY)} sessionId={sessionData?.session_id} subjects={subjects} selectedSubjectId={subjectId} />}
            {view === VIEW.REVIEW     && <ReviewView sessionData={sessionData} evalData={evalData} />}
            {view === VIEW.RECOMMEND  && <RecommendView recommend={recommend} />}
            {view === VIEW.HISTORY    && <HistoryView subjectId={subjectId} subjects={subjects} onSelectSubject={(id) => { setSubjectId(id); go(VIEW.HISTORY); }} onStartConfig={startConfigFor} onResume={(sd) => { setSessionData(sd); go(VIEW.QUIZ); }} />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}


// ─── Dashboard View ──────────────────────────────────────────────────────────
function DashboardView({ subjectId, subjects, analysis, onAnalysisDone, onStartConfig }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [expandedNode, setExpandedNode] = useState(null);

  const runAnalysis = async () => {
    if (!subjectId) return setError('Pilih mata kuliah terlebih dahulu.');
    setError(''); setIsAnalyzing(true);
    try {
      const r = await examAPI.analyze(subjectId);
      if (r.data?.detail) throw new Error(r.data.detail);
      onAnalysisDone(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Analisis gagal.');
    } finally { setIsAnalyzing(false); }
  };

  if (!subjectId) {
    return (
      <div className="card-base p-16 text-center">
        <Brain size={56} className="mx-auto mb-4 text-primary opacity-40" />
        <h3 className="text-lg font-semibold text-text mb-2">Exam Analyzer</h3>
        <p className="text-text-muted text-sm max-w-md mx-auto">
          Pilih mata kuliah di atas untuk mulai menganalisis materi dan membuat simulasi ujian.
        </p>
      </div>
    );
  }

  if (!analysis) {
    const subjectName = subjects.find(s => String(s.id) === String(subjectId))?.name || '';
    return (
      <div className="card-base p-16 text-center">
        <Brain size={56} className="mx-auto mb-4 text-primary opacity-60" />
        <h3 className="text-lg font-semibold text-text mb-2">Analisis Materi — {subjectName}</h3>
        <p className="text-text-muted text-sm max-w-md mx-auto mb-6">
          AI akan membaca seluruh sumber belajar (PDF, catatan, flashcard, quiz) dan menyusun peta pengetahuan serta prioritas topik.
        </p>
        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        <button onClick={runAnalysis} disabled={isAnalyzing} className="btn-primary mx-auto">
          {isAnalyzing ? <><Loader2 size={15} className="animate-spin" /> Menganalisis...</> : <><Brain size={15} /> Mulai Analisis</>}
        </button>
      </div>
    );
  }

  const { overview = {}, stats = {}, topic_priority = [], knowledge_map = [], weakness_indicators = [] } = analysis;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Materi',     value: stats.material_count ?? 0,  icon: FileText,   color:'text-accent-blue' },
          { label:'Topik',      value: overview.total_topics ?? 0,  icon: Target,     color:'text-primary' },
          { label:'Catatan',    value: stats.note_count ?? 0,       icon: BookMarked, color:'text-success' },
          { label:'Est. Jam',   value: `${overview.estimated_study_hours ?? 0}j`, icon: Clock, color:'text-warning' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card-base p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={16} />
            </div>
            <div>
              <p className="text-xl font-bold text-text">{value}</p>
              <p className="text-xs text-text-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary + Complexity */}
      {overview.summary && (
        <div className="card-base p-4 flex items-start gap-3">
          <Info size={15} className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-text">{overview.summary}</p>
            <div className="mt-2">
              <Chip label={`Kompleksitas: ${overview.complexity_level || '-'}`}
                color={overview.complexity_level === 'Tinggi' ? 'danger' : overview.complexity_level === 'Menengah' ? 'warning' : 'success'} />
            </div>
          </div>
        </div>
      )}

      {/* Topic Priority */}
      <div className="card-base p-5">
        <SectionHeader icon={Target} title="Topic Priority" subtitle="Topik paling penting berdasarkan analisis AI" />
        <div className="space-y-3">
          {topic_priority.slice(0, 8).map((t, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background hover:bg-card/60 transition-colors">
              <span className="text-xs font-bold text-text-muted w-5 mt-0.5">{i+1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-text">{t.topic}</span>
                  <StarRating stars={t.stars} />
                </div>
                <p className="text-xs text-text-muted mt-0.5">{t.reason}</p>
                {t.subtopics?.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1.5">
                    {t.subtopics.map((st, j) => <Chip key={j} label={st} color="blue" size="xs" />)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Knowledge Map */}
      {knowledge_map.length > 0 && (
        <div className="card-base p-5">
          <SectionHeader icon={Map} title="Knowledge Relationship" subtitle="Klik node untuk melihat penjelasan hubungan konsep" />
          <div className="space-y-2">
            {knowledge_map.map((node, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedNode(expandedNode === i ? null : i)}
                  className="w-full flex items-center gap-2 p-3 rounded-xl bg-background hover:bg-card/60 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen size={13} className="text-primary" />
                  </div>
                  <span className="font-semibold text-sm text-text flex-1">{node.node}</span>
                  <ChevronDown size={14} className={cn('text-text-muted transition-transform', expandedNode === i && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {expandedNode === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-9 pl-4 border-l-2 border-primary/20 pb-2 mt-1 space-y-2">
                        <p className="text-xs text-text-secondary">{node.description}</p>
                        {node.children?.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {node.children.map((c, j) => (
                              <span key={j} className="flex items-center gap-1 text-xs text-text-secondary">
                                <ArrowRight size={10} className="text-primary" />{c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weakness Analysis */}
      {weakness_indicators.length > 0 && (
        <div className="card-base p-5">
          <SectionHeader icon={AlertTriangle} title="Weakness Analysis" subtitle="Topik yang perlu perhatian lebih" />
          <div className="space-y-3">
            {weakness_indicators.map((w, i) => (
              <div key={i} className="p-3 rounded-xl bg-danger/5 border border-danger/15">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle size={13} className="text-danger shrink-0" />
                  <span className="font-semibold text-sm text-text">{w.topic}</span>
                </div>
                <p className="text-xs text-text-secondary ml-5">{w.reason}</p>
                {w.suggestion && (
                  <p className="text-xs text-primary ml-5 mt-1 flex items-center gap-1">
                    <Lightbulb size={11} /> {w.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh + CTA */}
      <div className="flex gap-3">
        <button onClick={runAnalysis} disabled={isAnalyzing} className="btn-ghost text-xs border border-border">
          {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh Analisis
        </button>
        <button onClick={onStartConfig} className="btn-primary text-xs">
          <Zap size={13} /> Generate Simulasi
        </button>
      </div>
    </div>
  );
}


// ─── Config View ─────────────────────────────────────────────────────────────
function ConfigView({ subjectId, analysis, onDone }) {
  const [form, setForm] = useState({
    exam_type: 'UTS',
    total_questions: 20,
    custom_count: '',
    difficulty: 'Menengah',
    bloom_level: 'Mixed',
    question_type: 'Campuran',
    focus_material: 'Semua Materi',
    duration: DURATIONS[2],
  });
  const [selectedMaterialIds, setSelectedMaterialIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!subjectId) return setError('Pilih mata kuliah terlebih dahulu.');
    if (selectedMaterialIds.length === 0) return setError('Harap pilih materi terlebih dahulu.');
    setError(''); setIsLoading(true);
    try {
      const totalQ = form.total_questions === 'custom'
        ? parseInt(form.custom_count) || 10
        : form.total_questions;

      const payload = {
        subject_id: subjectId,
        exam_type: form.exam_type.toLowerCase().replace(' ', '_'),
        total_questions: totalQ,
        difficulty: form.difficulty.toLowerCase(),
        bloom_level: form.bloom_level.toLowerCase(),
        question_type: Q_TYPE_MAP[form.question_type] || 'mixed',
        focus_material: form.focus_material,
        duration_minutes: form.duration.value,
        analysis_json: analysis ? JSON.stringify(analysis) : undefined,
        material_ids: selectedMaterialIds.length > 0 ? selectedMaterialIds.join(',') : undefined,
      };
      const r = await examAPI.generateBlueprint(payload);
      if (r.data?.detail) throw new Error(r.data.detail);
      onDone(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Gagal membuat blueprint.');
    } finally { setIsLoading(false); }
  };

  const OptionGroup = ({ label, options, field, renderLabel }) => (
    <div>
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lbl = renderLabel ? renderLabel(opt) : String(opt);
          const active = form[field] === opt || form[field] === val;
          return (
            <button key={lbl} onClick={() => set(field, opt)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                active ? 'bg-primary text-white border-primary shadow-glow' : 'bg-card text-text border-border hover:border-primary/40')}>
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="card-base p-6 space-y-6">
      <SectionHeader icon={ClipboardList} title="Konfigurasi Simulasi"
        subtitle="Tentukan jenis, format, dan tingkat kesulitan ujian" />

      <OptionGroup label="Jenis Ujian" options={EXAM_TYPES} field="exam_type" />
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Jumlah Soal</p>
        <div className="flex flex-wrap gap-2">
          {[...COUNTS, 'custom'].map(c => (
            <button key={c} onClick={() => set('total_questions', c)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                form.total_questions === c ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
              {c === 'custom' ? 'Custom' : c}
            </button>
          ))}
        </div>
        {form.total_questions === 'custom' && (
          <input type="number" min="1" max="100" value={form.custom_count}
            onChange={e => set('custom_count', e.target.value)}
            placeholder="Jumlah soal..."
            className="mt-2 w-32 px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
        )}
      </div>
      <OptionGroup label="Tingkat Kesulitan" options={DIFFICULTIES} field="difficulty" />
      <OptionGroup label="Level Bloom Taxonomy" options={BLOOMS} field="bloom_level" />
      <OptionGroup label="Jenis Soal" options={Q_TYPES} field="question_type" />
      <OptionGroup label="Fokus Materi" options={FOCUSES} field="focus_material" />
      <OptionGroup label="Waktu Pengerjaan" options={DURATIONS} field="duration"
        renderLabel={d => d.label} />

      <MaterialPicker
        subjectId={subjectId}
        selectedMaterialIds={selectedMaterialIds}
        onSelectionChange={setSelectedMaterialIds}
      />

      {error && <p className="text-danger text-sm">{error}</p>}

      <div className="flex justify-end pt-2">
        <button onClick={handleSubmit} disabled={isLoading || selectedMaterialIds.length === 0} className="btn-primary">
          {isLoading
            ? <><Loader2 size={14} className="animate-spin" /> Membuat Blueprint...</>
            : <><Brain size={14} /> Generate Blueprint</>}
        </button>
      </div>
    </div>
  );
}


// ─── Blueprint View ───────────────────────────────────────────────────────────
function BlueprintView({ blueprint, subjectId, onGenerate, onBack }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const items = blueprint?.blueprint_items || [];
  const totalW = items.reduce((s, i) => s + (i.weight_percent || 0), 0);

  const handleGenerate = async () => {
    setError(''); setIsGenerating(true);
    try {
      const r = await examAPI.generateQuestions(blueprint.blueprint_id);
      if (r.data?.detail) throw new Error(r.data.detail);
      onGenerate(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Gagal membuat soal.');
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="card-base p-20 text-center">
        <Loader2 size={48} className="animate-spin text-primary mx-auto mb-6" />
        <h3 className="text-lg font-semibold text-text mb-2">Membuat Soal Ujian...</h3>
        <p className="text-text-muted text-sm max-w-sm mx-auto mb-4">
          AI sedang menyusun soal, jawaban, pembahasan, dan referensi materi untuk setiap topik.
          Proses ini membutuhkan <strong className="text-text">1–3 menit</strong> — mohon tunggu dan jangan tutup halaman.
        </p>
        <div className="flex justify-center gap-1.5 mt-4">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="card-base p-5">
        <SectionHeader icon={ClipboardList} title={blueprint?.title || 'Blueprint Ujian'}
          subtitle={`${items.length} topik · Total bobot: ${totalW}%`} />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted uppercase tracking-wider">
                <th className="text-left py-2 px-2 font-semibold">Topik</th>
                <th className="text-center py-2 px-2 font-semibold">Bobot</th>
                <th className="text-center py-2 px-2 font-semibold">Soal</th>
                <th className="text-center py-2 px-2 font-semibold">Jenis</th>
                <th className="text-center py-2 px-2 font-semibold">Bloom</th>
                <th className="text-center py-2 px-2 font-semibold">Kesulitan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-background/40">
                  <td className="py-3 px-2">
                    <p className="font-medium text-text">{item.topic}</p>
                    {item.key_concepts?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {item.key_concepts.slice(0, 3).map((c, j) => <Chip key={j} label={c} size="xs" color="blue" />)}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="inline-flex items-center gap-1">
                      <div className="w-10 h-1.5 rounded-full bg-border overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${item.weight_percent}%` }} />
                      </div>
                      <span className="text-xs text-text-secondary">{item.weight_percent}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-text font-semibold">{item.question_count}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Chip label={(item.question_types || []).join(', ')} size="xs" color="purple" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Chip label={item.bloom_level} size="xs" color="teal" />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <Chip label={item.difficulty}  size="xs"
                      color={item.difficulty === 'sulit' ? 'danger' : item.difficulty === 'menengah' ? 'warning' : 'success'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">{error}</div>
      )}

      <div className="flex gap-3 justify-between">
        <button onClick={onBack} className="btn-ghost text-sm border border-border">
          <ChevronLeft size={14} /> Ubah Konfigurasi
        </button>
        <button onClick={handleGenerate} className="btn-primary">
          <Play size={14} /> Generate Soal Ujian
        </button>
      </div>
    </div>
  );
}


// ─── Quiz View ────────────────────────────────────────────────────────────────
function QuizView({ sessionData, onDone }) {
  const questions = sessionData?.questions || [];
  const totalQ    = questions.length;
  const duration  = sessionData?.duration_minutes;

  const [idx, setIdx]         = useState(0);
  const [answers, setAnswers] = useState({});
  const [paused, setPaused]   = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration ? duration * 60 : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]     = useState('');

  // Timer
  useEffect(() => {
    if (timeLeft === null || paused) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, paused]);

  const formatTime = (s) => {
    if (s === null) return '∞';
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const q = questions[idx];
  const progress = Math.round(((idx + 1) / totalQ) * 100);

  const selectAnswer = (val) => setAnswers(p => ({ ...p, [String(q.id)]: val }));

  const handleSubmit = async () => {
    setError(''); setIsSubmitting(true);
    try {
      const r = await examAPI.submit(sessionData.session_id, answers);
      if (r.data?.detail) throw new Error(r.data.detail);
      const evalResult = r.data;

      onDone(evalResult, answers);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Gagal submit.');
      setIsSubmitting(false);
    }
  };

  if (!q) return null;

  const isObjectiveQ = ['mcq','truefalse'].includes(q.type);
  const userAnswer   = answers[String(q.id)] || '';
  const answered     = Object.keys(answers).length;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="card-base p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">Soal {idx+1} / {totalQ}</span>
            <span className="text-xs text-text-muted">{answered} dijawab</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {timeLeft !== null && (
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-bold border',
            timeLeft < 60 ? 'text-danger border-danger/30 bg-danger/10 animate-pulse' : 'text-text border-border bg-card')}>
            <Clock size={13} />{formatTime(timeLeft)}
          </div>
        )}

        <button onClick={() => setPaused(p => !p)}
          className="p-2 rounded-lg border border-border bg-card text-text-secondary hover:text-text transition-colors">
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>

      {/* Pause overlay */}
      {paused && (
        <div className="card-base p-16 text-center">
          <Pause size={48} className="mx-auto mb-4 text-text-muted opacity-40" />
          <h3 className="text-lg font-semibold text-text mb-2">Ujian Dijeda</h3>
          <button onClick={() => setPaused(false)} className="btn-primary mt-4">
            <Play size={14} /> Lanjutkan
          </button>
        </div>
      )}

      {/* Question card */}
      {!paused && (
        <div className="card-base p-6 space-y-5">
          <div className="flex items-start gap-3">
            <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
              {idx+1}
            </span>
            <div className="flex-1">
              <div className="flex gap-2 flex-wrap mb-3">
                <Chip label={q.type}        size="xs" color="blue" />
                <Chip label={q.bloom_level} size="xs" color="teal" />
                <Chip label={q.difficulty}  size="xs"
                  color={q.difficulty === 'sulit' ? 'danger' : q.difficulty === 'menengah' ? 'warning' : 'success'} />
              </div>
              <MathMarkdown className="font-medium">{q.question}</MathMarkdown>
            </div>
          </div>

          {/* Options — objective */}
          {isObjectiveQ && (
            <div className="space-y-2">
              {(q.options_list || Object.entries(q.options || {}).map(([k,v]) => `${k}. ${v}`)).map((opt, i) => {
                const key = Object.keys(q.options || {})[i] || opt;
                const sel = userAnswer === key || userAnswer === opt;
                return (
                  <button key={i} onClick={() => selectAnswer(key)}
                    className={cn('w-full text-left p-3.5 rounded-xl border text-sm transition-all',
                      sel ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-card border-border text-text hover:border-primary/40')}>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Text answer — subjective */}
          {!isObjectiveQ && (
            <textarea
              rows={5}
              value={userAnswer}
              onChange={e => selectAnswer(e.target.value)}
              placeholder={`Tulis jawaban ${q.type === 'calculation' ? 'perhitungan' : q.type === 'essay' ? 'esai' : 'kamu'} di sini...`}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-text focus:outline-none focus:border-primary resize-none"
            />
          )}
        </div>
      )}

      {error && <p className="text-danger text-sm">{error}</p>}

      {/* Navigation */}
      {!paused && (
        <div className="flex items-center justify-between">
          <button onClick={() => setIdx(p => Math.max(0, p-1))} disabled={idx === 0}
            className="btn-ghost text-sm border border-border disabled:opacity-30">
            <ChevronLeft size={14} /> Sebelumnya
          </button>

          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={cn('w-6 h-6 rounded-md text-[10px] font-medium transition-all',
                  i === idx ? 'bg-primary text-white' :
                  answers[String(questions[i].id)] ? 'bg-success/20 text-success border border-success/30' :
                  'bg-card text-text-muted border border-border hover:border-primary/40')}>
                {i+1}
              </button>
            ))}
          </div>

          {idx < totalQ - 1 ? (
            <button onClick={() => setIdx(p => p+1)} className="btn-primary text-sm">
              Berikutnya <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={isSubmitting} className="btn-primary text-sm">
              {isSubmitting ? <><Loader2 size={13} className="animate-spin" /> Mengevaluasi...</> : <><Check size={13} /> Submit</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Result View ──────────────────────────────────────────────────────────────
function ResultView({ evalData, sessionData, onReview, onRecommend, onFinish, sessionId, subjects, selectedSubjectId }) {
  const [loadingRec, setLoadingRec]     = useState(false);
  const [recError, setRecError]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [savedHistoryId, setSavedHistoryId] = useState(null);
  const [saveError, setSaveError]       = useState('');
  const navigate = typeof window !== 'undefined' ? null : null; // will use window.location

  if (!evalData) return null;

  const { score = 0, grade = '-', performance_level = '-', total_correct = 0, total_wrong = 0,
    total_unanswered = 0, estimated_exam_score = 0, strong_topics = [], weak_topics = [],
    overall_feedback = '' } = evalData;

  const scoreColor = score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-danger';

  const fetchRecommend = async () => {
    setRecError(''); setLoadingRec(true);
    try {
      const r = await examAPI.getRecommendation(sessionId);
      if (r.data?.detail) throw new Error(r.data.detail);
      onRecommend(r.data);
    } catch (e) {
      setRecError(e.response?.data?.detail || e.message || 'Gagal memuat rekomendasi.');
    } finally { setLoadingRec(false); }
  };

  const handleSelesai = async () => {
    if (saved) {
      onFinish && onFinish();
      return;
    }
    setSaveError(''); setSaving(true);
    try {
      let studyPlanData = null;
      try {
        const rr = await examAPI.getRecommendation(sessionId);
        if (rr.data && !rr.data.detail) studyPlanData = rr.data;
      } catch (_) {}

      if (studyPlanData) {
        await sessionsAPI.saveStudyPlan(sessionId, studyPlanData);
      }

      setSaved(true);
      setSavedHistoryId(sessionId);
      setTimeout(() => { onFinish && onFinish(); }, 1200);
    } catch (e) {
      setSaveError(e.response?.data?.detail || e.message || 'Gagal menyimpan hasil.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {/* Score hero */}
      <div className="card-base p-8 text-center">
        <Trophy size={48} className="mx-auto text-warning mb-4" />
        <h2 className="text-2xl font-bold text-text mb-1">Ujian Selesai!</h2>
        <div className={cn('text-7xl font-black my-4', scoreColor)}>{score}</div>
        <div className="flex justify-center gap-2 mb-3">
          <Chip label={`Grade: ${grade}`} color={score>=80?'success':score>=60?'warning':'danger'} />
          <Chip label={performance_level} color="purple" />
        </div>
        <p className="text-text-secondary text-sm">{overall_feedback}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:'Benar',      value: total_correct,        color:'text-success', bg:'bg-success/10 border-success/20' },
          { label:'Salah',      value: total_wrong,          color:'text-danger',  bg:'bg-danger/10 border-danger/20' },
          { label:'Kosong',     value: total_unanswered,     color:'text-text-muted', bg:'bg-card border-border' },
          { label:'Est. Nilai', value: estimated_exam_score, color:'text-primary', bg:'bg-primary/10 border-primary/20' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('p-4 rounded-xl border text-center', bg)}>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-text-secondary mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Topics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strong_topics.length > 0 && (
          <div className="card-base p-4">
            <p className="text-xs font-semibold text-success uppercase tracking-wider mb-3 flex items-center gap-1">
              <TrendingUp size={12} /> Topik Dikuasai
            </p>
            <div className="space-y-2">
              {strong_topics.map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-text">{t.topic}</span>
                  <Chip label={t.mastery} size="xs" color="success" />
                </div>
              ))}
            </div>
          </div>
        )}
        {weak_topics.length > 0 && (
          <div className="card-base p-4">
            <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-3 flex items-center gap-1">
              <AlertTriangle size={12} /> Topik Lemah
            </p>
            <div className="space-y-2">
              {weak_topics.map((t, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">{t.topic}</span>
                    <Chip label={`Prioritas ${t.priority}`} size="xs"
                      color={t.priority === 'Tinggi' ? 'danger' : t.priority === 'Menengah' ? 'warning' : 'teal'} />
                  </div>
                  {t.issue && <p className="text-xs text-text-muted pl-1">{t.issue}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {(recError || saveError) && (
        <p className="text-danger text-sm">{recError || saveError}</p>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm">
          <CheckCircle size={15} /> Hasil tersimpan! Menuju Exam History...
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={onReview} className="btn-ghost text-sm border border-border">
          <BookOpen size={13} /> Review Jawaban
        </button>
        <button onClick={fetchRecommend} disabled={loadingRec} className="btn-ghost text-sm border border-border">
          {loadingRec ? <><Loader2 size={13} className="animate-spin" /> Memuat...</> : <><Calendar size={13} /> Rencana Belajar</>}
        </button>
        <button onClick={handleSelesai} disabled={saving} className="btn-primary text-sm ml-auto">
          {saving
            ? <><Loader2 size={13} className="animate-spin" /> Menyimpan...</>
            : saved
              ? <><Check size={13} /> Menuju History...</>
              : <><Check size={13} /> Selesai &amp; Simpan</>
          }
        </button>
      </div>
    </div>
  );
}


// ─── Review View ──────────────────────────────────────────────────────────────
function ReviewView({ sessionData, evalData }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  // Map of question index → {loading, text, error}
  const [explanations, setExplanations] = useState({});

  const questions = sessionData?.questions || [];
  const answers   = sessionData?.answers   || {};
  const perQ      = evalData?.per_question_feedback || [];

  const getFb = (qid) => perQ.find(f => String(f.question_id) === String(qid));

  const fetchExplanation = async (q, i) => {
    if (explanations[i]?.text) return; // already loaded
    setExplanations(prev => ({ ...prev, [i]: { loading: true, text: '', error: '' } }));
    try {
      const r = await examAPI.getExplanation({
        bank_id:       q.bank_id || null,
        question:      q.question,
        correct_answer: q.answer || '',
        topic:         q.topic  || '',
      });
      const text = r.data?.explanation || 'Penjelasan tidak tersedia.';
      setExplanations(prev => ({ ...prev, [i]: { loading: false, text, error: '' } }));
    } catch (e) {
      setExplanations(prev => ({
        ...prev,
        [i]: { loading: false, text: '', error: 'Gagal memuat penjelasan.' },
      }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="card-base p-5">
        <SectionHeader icon={BookOpen} title="Review Jawaban"
          subtitle={`${questions.length} soal · Klik untuk melihat penjelasan`} />

        <div className="space-y-3">
          {questions.map((q, i) => {
            const fb         = getFb(q.id);
            const isCorrect  = fb?.is_correct;
            const userAns    = fb?.user_answer || answers[String(q.id)] || '(Tidak dijawab)';
            const correctAns = fb?.correct_answer || q.answer || '';
            const isOpen     = expandedIdx === i;
            const expl       = explanations[i];

            return (
              <div key={i} className={cn('rounded-xl border overflow-hidden transition-all',
                isCorrect === true  ? 'border-success/30' :
                isCorrect === false ? 'border-danger/30'  : 'border-border')}>

                <button onClick={() => setExpandedIdx(isOpen ? null : i)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-background/50 transition-colors">
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                    isCorrect === true  ? 'bg-success'  :
                    isCorrect === false ? 'bg-danger'   : 'bg-border')}>
                    {isCorrect === true  ? <CheckCircle size={14} className="text-white" /> :
                     isCorrect === false ? <XCircle     size={14} className="text-white" /> :
                                          <span className="text-[10px] font-bold text-text">?</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-muted mb-0.5">Soal {i+1} · {q.topic} · {q.type}</p>
                    <div className="text-sm text-text font-medium line-clamp-2">
                      <MathMarkdown>{q.question}</MathMarkdown>
                    </div>
                  </div>
                  <ChevronDown size={14} className={cn('text-text-muted shrink-0 transition-transform', isOpen && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height:0 }} animate={{ height:'auto' }} exit={{ height:0 }}
                      transition={{ duration:0.2 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="p-3 rounded-lg bg-background">
                            <p className="text-xs font-semibold text-text-muted mb-1">Jawaban Kamu</p>
                            <div className={cn('font-medium', isCorrect ? 'text-success' : 'text-danger')}>
                              <MathMarkdown>{userAns || '(Tidak dijawab)'}</MathMarkdown>
                            </div>
                          </div>
                          {!isCorrect && (
                            <div className="p-3 rounded-lg bg-success/5 border border-success/15">
                              <p className="text-xs font-semibold text-text-muted mb-1">Jawaban Benar</p>
                              <div className="font-medium text-success">
                                <MathMarkdown>{correctAns}</MathMarkdown>
                              </div>
                            </div>
                          )}
                        </div>

                        {fb?.feedback && (
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/15">
                            <p className="text-xs font-semibold text-primary mb-1">Feedback AI</p>
                            <MathMarkdown>{fb.feedback}</MathMarkdown>
                          </div>
                        )}

                        {/* Pre-stored explanation (from question bank) */}
                        {q.explanation && !expl?.text && (
                          <div className="p-3 rounded-lg bg-background border border-border">
                            <p className="text-xs font-semibold text-text-muted mb-1">Penjelasan</p>
                            <MathMarkdown>{q.explanation}</MathMarkdown>
                          </div>
                        )}

                        {/* Lazy AI explanation result */}
                        {expl?.text && (
                          <div className="p-3 rounded-lg bg-accent-teal/5 border border-accent-teal/20">
                            <p className="text-xs font-semibold text-accent-teal mb-1 flex items-center gap-1">
                              <Lightbulb size={11} /> Penjelasan AI
                            </p>
                            <MathMarkdown>{expl.text}</MathMarkdown>
                          </div>
                        )}
                        {expl?.error && (
                          <p className="text-xs text-danger">{expl.error}</p>
                        )}

                        <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted">
                          {q.material_reference && (
                            <span className="flex items-center gap-1">
                              <FileText size={11} /> {q.material_reference}
                            </span>
                          )}
                          {q.tips && (
                            <span className="flex items-center gap-1 text-primary">
                              <Lightbulb size={11} /> {q.tips}
                            </span>
                          )}
                          {/* Jelaskan button — only if no explanation already shown */}
                          {!q.explanation && !expl?.text && (
                            <button
                              onClick={() => fetchExplanation(q, i)}
                              disabled={expl?.loading}
                              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-teal/10 text-accent-teal border border-accent-teal/20 hover:bg-accent-teal/20 transition-colors disabled:opacity-50"
                            >
                              {expl?.loading
                                ? <><Loader2 size={11} className="animate-spin" /> Memuat...</>
                                : <><Lightbulb size={11} /> Jelaskan</>}
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
      </div>
    </div>
  );
}


// ─── Recommend View ───────────────────────────────────────────────────────────
function RecommendView({ recommend }) {
  if (!recommend) return null;

  const { study_plan = [], priority_actions = [], motivational_message = '' } = recommend;

  const typeColor = { review:'blue', practice:'purple', simulation:'warning', rest:'success' };

  return (
    <div className="space-y-5">
      {/* Motivational message */}
      {motivational_message && (
        <div className="card-base p-4 flex items-start gap-3 border-l-4 border-primary">
          <Award size={18} className="text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-text font-medium">{motivational_message}</p>
        </div>
      )}

      {/* Priority actions */}
      {priority_actions.length > 0 && (
        <div className="card-base p-5">
          <SectionHeader icon={Target} title="Aksi Prioritas" subtitle="Yang harus dilakukan segera" />
          <ul className="space-y-2">
            {priority_actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text">
                <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i+1}</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 7-day study plan */}
      <div className="card-base p-5">
        <SectionHeader icon={Calendar} title="Rencana Belajar 7 Hari"
          subtitle="Jadwal yang dipersonalisasi berdasarkan hasil ujianmu" />
        <div className="space-y-3">
          {study_plan.map((day, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background hover:bg-card/60 transition-colors">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold',
                day.type === 'rest' ? 'bg-success/10 text-success' :
                day.type === 'simulation' ? 'bg-warning/10 text-warning' :
                'bg-primary/10 text-primary')}>
                {day.label?.replace('Hari ','') || i+1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-sm font-semibold text-text">{day.topic}</span>
                  <Chip label={day.type} size="xs" color={typeColor[day.type] || 'blue'} />
                  {day.duration_minutes && (
                    <span className="text-xs text-text-muted flex items-center gap-0.5">
                      <Clock size={10} /> {day.duration_minutes}m
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary">{day.activity}</p>
                {day.resources && (
                  <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                    <Lightbulb size={10} /> {day.resources}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── History View ─────────────────────────────────────────────────────────────
// ─── Subject picker (shown when no subject selected) ──────────────────────────
function SubjectPicker({ subjects, materials, onSelectSubject, onStartConfig }) {
  const navigate = useNavigate();

  if (!subjects.length) {
    return (
      <div className="card-base p-16 text-center">
        <BookOpen size={48} className="mx-auto mb-4 text-primary opacity-40" />
        <h3 className="text-lg font-semibold text-text mb-2">Belum ada mata kuliah</h3>
        <p className="text-text-muted text-sm max-w-md mx-auto mb-5">
          Tambahkan mata kuliah dan materi terlebih dahulu untuk membuat simulasi ujian.
        </p>
        <button onClick={() => navigate('/materi')} className="btn-primary text-sm">
          <BookOpen size={14} /> Tambah Materi
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-1">Pilih Mata Kuliah</h2>
      <p className="text-text-muted text-sm mb-5">
        Pilih mata kuliah untuk melihat riwayat simulasi atau langsung buat simulasi baru.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map(s => {
          const materialCount = materials.filter(m => String(m.subject_id) === String(s.id)).length;
          return (
            <div key={s.id} className="card-base p-5 flex flex-col gap-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <BookOpen size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text truncate">{s.name}</h3>
                  <p className="text-xs text-text-muted">{materialCount} materi</p>
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <button onClick={() => onSelectSubject(s.id)} className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-text text-xs font-medium hover:border-primary/40 transition-colors">
                  <History size={12} className="inline mr-1 -mt-0.5" /> Riwayat
                </button>
                <button onClick={() => onStartConfig(s.id)} className="flex-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90 transition-opacity">
                  <Zap size={12} className="inline mr-1 -mt-0.5" /> Simulasi
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HistoryView({ subjectId, subjects, onSelectSubject, onStartConfig, onResume }) {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const [search,    setSearch]    = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy,    setSortBy]    = useState('newest');
  const [detailId,  setDetailId]  = useState(null);

  const { data: materialData } = useQuery({
    queryKey: ['materials'],
    queryFn:  () => materiAPI.getAll().then(r => r.data),
  });
  const materials = materialData?.materials || [];

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
    return <SubjectPicker subjects={subjects} materials={materials} onSelectSubject={onSelectSubject} onStartConfig={onStartConfig} />;
  }

  const handleDelete = (id) => {
    if (!confirm('Hapus riwayat ujian ini beserta semua data attempt-nya?')) return;
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
          Belum ada riwayat simulasi untuk mata kuliah ini.
        </p>
        <p className="text-text-muted text-xs mb-6">
          Buat simulasi pertama kamu dan mulai latihan ujian berbasis AI.
        </p>
        <button onClick={() => onStartConfig(subjectId)} className="btn-primary text-sm">
          <Zap size={14} /> Buat Simulasi
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
          {['all','uts','uas','quiz','latihan_harian','custom'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                typeFilter === t ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
              {t === 'all' ? 'Semua' : t.toUpperCase().replace('_',' ')}
            </button>
          ))}
          <div className="w-px bg-border mx-1" />
          {[['all','Semua'],['mastered','Mastered'],['completed','Selesai'],['sedang_belajar','Belajar']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium border transition-all',
                statusFilter === v ? 'bg-primary text-white border-primary' : 'bg-card text-text border-border hover:border-primary/40')}>
              {l}
            </button>
          ))}
          <div className="w-px bg-border mx-1" />
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
      {filtered.length === 0 ? (
        <div className="card-base p-20 text-center">
          <History size={56} className="mx-auto mb-4 text-text-muted opacity-30" />
          <h3 className="text-lg font-semibold text-text mb-2">
            {sessions.length === 0 ? 'Belum Ada Riwayat' : 'Tidak Ditemukan'}
          </h3>
          <p className="text-text-muted text-sm">
            {sessions.length === 0
              ? 'Selesaikan simulasi ujian pertama kamu untuk melihat riwayat di sini.'
              : 'Coba ubah filter atau kata kunci pencarian.'}
          </p>
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

      {/* Detail modal */}
      <AnimatePresence>
        {detailId && (
          <DetailModal historySessionId={detailId} onClose={() => setDetailId(null)} onResume={onResume} />
        )}
      </AnimatePresence>
    </div>
  );
}

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
        <span className="flex items-center gap-1"><RotateCcw size={10} /> {s.attempt_count || 0} attempt</span>
        <span className="flex items-center gap-1"><Clock size={10} />
          {s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID') : '--'}
        </span>
        {s.has_study_plan && (
          <span className="flex items-center gap-1 text-primary">
            <Calendar size={10} /> {s.study_plan_progress || 0}% plan
          </span>
        )}
      </div>

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
function DetailModal({ historySessionId, onClose, onResume }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['exam-history-detail', historySessionId],
    queryFn:  () => sessionsAPI.detail(historySessionId).then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (itemId) => sessionsAPI.togglePlanItem(itemId),
    onSuccess: () => { refetch(); queryClient.invalidateQueries(['exam-sessions']); },
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

      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'overview'  && <OverviewTab data={data} />}
        {tab === 'review'    && <ReviewTab attempt={latestAttempt} />}
        {tab === 'plan'      && <StudyPlanTab plan={data.study_plan} onToggle={(id) => toggleMutation.mutate(id)} />}
        {tab === 'attempts'  && <AttemptsTab attempts={data.attempts || []} />}
      </div>

      <div className="p-4 border-t border-border shrink-0 flex gap-2 flex-wrap">
        <RetryButton historySessionId={historySessionId} sessionData={data} onClose={onClose} onResume={onResume} />
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

function OverviewTab({ data }) {
  const attempts = data.attempts || [];
  const hasGrowth = attempts.length >= 2;

  return (
    <div className="space-y-4">
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
          <p className="text-xs text-success mt-2 flex items-center gap-1">
            <TrendingUp size={11} />
            Peningkatan: +{(attempts[attempts.length-1].score||0) - (attempts[0].score||0)} poin
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(data.strong_topics || []).length > 0 && (
          <div className="p-3 rounded-xl bg-success/5 border border-success/15">
            <p className="text-xs font-semibold text-success mb-2 flex items-center gap-1">
              <TrendingUp size={11} /> Topik Dikuasai
            </p>
            {(data.strong_topics || []).slice(0,5).map((t,i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-success/10 last:border-0">
                <span className="text-xs text-text">{typeof t === 'string' ? t : t.topic || ''}</span>
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
            {(data.weak_topics || []).slice(0,5).map((t,i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-danger/10 last:border-0">
                <span className="text-xs text-text">{typeof t === 'string' ? t : t.topic || ''}</span>
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

                    {r.ai_explanation && !expl?.text && (
                      <div className="p-2 rounded-lg bg-primary/5 border border-primary/15 text-xs text-text">
                        <p className="font-semibold text-primary mb-0.5">Penjelasan AI</p>
                        <MathMarkdown>{r.ai_explanation}</MathMarkdown>
                      </div>
                    )}

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

      <div className="flex justify-between text-xs text-text-muted mb-1">
        <span>Progress Rencana Belajar</span>
        <span>{plan.completed_days}/{plan.total_days} hari · {plan.progress}%</span>
      </div>
      <ProgressBar value={plan.progress} color={plan.progress >= 100 ? 'success' : 'primary'} />

      {(plan.priority_actions || []).length > 0 && (
        <div className="p-3 rounded-xl bg-card border border-border">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Aksi Prioritas</p>
          {(plan.priority_actions || []).map((a, i) => (
            <p key={i} className="text-xs text-text flex items-start gap-1.5 py-1">
              <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">{i+1}</span>
              {a}
            </p>
          ))}
        </div>
      )}

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

function RetryButton({ historySessionId, sessionData, onClose, onResume }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleRetry = async () => {
    setError(''); setLoading(true);
    try {
      const r = await sessionsAPI.retry(historySessionId);
      if (r.data?.detail) throw new Error(r.data.detail);
      if (!r.data?.session_id) throw new Error('Sesi latihan gagal dibuat.');
      onClose();
      onResume({ ...r.data, subject_id: sessionData.subject_id, subject_name: sessionData.subject_name });
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

// ─── Shared status helpers ────────────────────────────────────────────────────
const STATUS_META = {
  mastered:       { label: 'Mastered',        color: 'success', border: 'border-success/40',  bg: 'bg-success/5'  },
  completed:      { label: 'Selesai',          color: 'primary', border: 'border-primary/30',  bg: 'bg-primary/5'  },
  active:         { label: 'Sedang Belajar',   color: 'blue',    border: 'border-accent-blue/30', bg: 'bg-accent-blue/5' },
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
