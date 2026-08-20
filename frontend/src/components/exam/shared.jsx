import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { ICONS } from '@/lib/icons';
import { cn } from '@/utils';

// ─── View constants ─────────────────────────────────────────────────────────
export const VIEW = {
  DASHBOARD:   'dashboard',
  CONFIG:      'config',
  BLUEPRINT:   'blueprint',
  GENERATING:  'generating',
  QUIZ:        'quiz',
  RESULT:      'result',
  REVIEW:      'review',
  HISTORY:     'history',
};

// ─── Config options ──────────────────────────────────────────────────────────
export const EXAM_TYPES   = ['Latihan Harian','Quiz','UTS','UAS','Custom'];
export const COUNTS       = [5,10,15,20,30,40,50];
export const DIFFICULTIES = ['Pemula','Menengah','Sulit','Campuran'];
export const BLOOMS       = ['Remember','Understand','Apply','Analyze','Evaluate','Create','Mixed'];
export const Q_TYPES      = ['Pilihan Ganda','Benar / Salah','Isian Singkat','Essay','Studi Kasus','Analisis','Perhitungan','Campuran'];
export const FOCUSES      = ['Semua Materi','Bab Tertentu','Topik Tertentu','Materi Lemah','Materi Favorit'];
export const DURATIONS    = [
  { label:'10 Menit', value:10 },
  { label:'20 Menit', value:20 },
  { label:'30 Menit', value:30 },
  { label:'45 Menit', value:45 },
  { label:'60 Menit', value:60 },
  { label:'90 Menit', value:90 },
  { label:'Tanpa Batas', value:null },
];

export const Q_TYPE_MAP = {
  'Pilihan Ganda':'mcq','Benar / Salah':'truefalse','Isian Singkat':'short_answer',
  'Essay':'essay','Studi Kasus':'case_study','Analisis':'analysis',
  'Perhitungan':'calculation','Campuran':'mixed',
};

// Reverse map: kode → label yang readable
export const Q_TYPE_LABEL = {
  mcq:          'Pilihan Ganda',
  truefalse:    'Benar / Salah',
  short_answer: 'Isian Singkat',
  essay:        'Essay',
  case_study:   'Studi Kasus',
  analysis:     'Analisis',
  calculation:  'Perhitungan',
  mixed:        'Campuran',
};

// ─── Small shared components ─────────────────────────────────────────────────
export function StarRating({ stars = 3 }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Icon key={i} name={ICONS.ui.star} size={12}
          className={i <= stars ? 'text-warning fill-warning' : 'text-border'}
        />
      ))}
    </span>
  );
}

export function Chip({ label, color = 'primary', size = 'sm' }) {
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

export function SectionHeader({ icon, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name={icon} size={15} className="text-primary" />
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

// ─── Shared status helpers ────────────────────────────────────────────────────
export const STATUS_META = {
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

export function getBadge(score) {
  if (score >= 90) return BADGE_META[90];
  if (score >= 80) return BADGE_META[80];
  if (score >= 70) return BADGE_META[70];
  return BADGE_META[0];
}

export function getGradeColor(grade) {
  return grade === 'A' ? 'text-success' : grade === 'B' ? 'text-primary'
       : grade === 'C' ? 'text-warning'  : 'text-danger';
}

export function ProgressBar({ value = 0, color = 'primary' }) {
  const bg = color === 'success' ? 'bg-success' : color === 'warning' ? 'bg-warning'
           : color === 'danger'  ? 'bg-danger'  : 'bg-primary';
  return (
    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', bg)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, value)}%` }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      />
    </div>
  );
}

// Rekonstruksi blueprint_items dari questions_json sesi yang ada,
// supaya tombol "Latihan Lagi" bisa memicu modal blueprint tanpa endpoint baru.
export function deriveBlueprintItems(questions = []) {
  const map = new Map();
  questions.forEach((q) => {
    const topic = q.topic || 'Umum';
    if (!map.has(topic)) {
      map.set(topic, { topic, question_count: 0, question_types: new Set(), bloom_level: q.bloom_level || '', difficulty: q.difficulty || '', weight_percent: 0 });
    }
    const e = map.get(topic);
    e.question_count += 1;
    if (q.question_type) e.question_types.add(q.question_type);
  });
  const total = questions.length || 1;
  return [...map.values()].map((e) => ({
    topic: e.topic,
    question_count: e.question_count,
    question_types: [...e.question_types],
    bloom_level: e.bloom_level,
    difficulty: e.difficulty,
    weight_percent: Math.round((e.question_count / total) * 100),
  }));
}
