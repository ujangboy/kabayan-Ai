import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MessageSquare, FileText, CreditCard, HelpCircle,
  BookMarked, Zap, TrendingUp, Clock, BookOpen, Trophy, Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/store';
import { formatDate, fileIcon } from '@/utils';
import api from '@/services/api';

const formatBytes = (bytes) => {
  if (bytes == null) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const QUICK_ACTIONS = [
  { icon: MessageSquare, label: 'Chat AI',       desc: 'Tanyakan apa saja',     to: '/chat',      color: 'bg-primary/10 text-primary' },
  { icon: FileText,      label: 'Upload Materi', desc: 'PDF, DOCX, YouTube',    to: '/materi',    color: 'bg-accent-blue/10 text-accent-blue' },
  { icon: CreditCard,    label: 'Buat Flashcard',desc: 'Dari materi terpilih',  to: '/flashcard', color: 'bg-accent-purple/10 text-accent-purple' },
  { icon: HelpCircle,    label: 'Mulai Quiz',    desc: 'Latihan soal AI',        to: '/quiz',      color: 'bg-accent-teal/10 text-accent-teal' },
];

function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="card-base flex items-center gap-4 p-4">
      <div className={`w-10 h-10 rounded-xl bg-card flex items-center justify-center shrink-0 border border-border ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-text">
          {loading ? <span className="inline-block w-8 h-6 bg-border animate-pulse rounded" /> : (value ?? 0)}
        </p>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { createChat } = useChatStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 30000, // refresh setiap 30 detik
    staleTime: 15000,
  });

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';

  const stats = {
    materials:  data?.materials  ?? null,
    notes:      data?.notes      ?? null,
    flashcards: data?.flashcards ?? null,
    quizzes:    data?.quizzes    ?? null,
    subjects:   data?.subjects   ?? null,
  };

  const recentMaterials = data?.recent_materials || [];
  const recentQuizzes   = data?.recent_quizzes   || [];

  const handleQuickAction = (to) => {
    if (to === '/chat') {
      const id = createChat();
      navigate(`/chat?id=${id}`);
    } else {
      navigate(to);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">👋</span>
            <h1 className="text-3xl font-bold text-text">{greeting}!</h1>
          </div>
          <p className="text-text-secondary">
            Kabayan AI siap membantu belajar hari ini.
            {stats.subjects > 0 && ` Kamu punya ${stats.subjects} mata kuliah aktif.`}
          </p>
        </motion.div>

        {/* Quick Actions */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-warning" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Aksi Cepat</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(({ icon: Icon, label, desc, to, color }) => (
              <motion.button
                key={to}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleQuickAction(to)}
                className="card-base flex flex-col items-start gap-3 p-4 text-left hover:border-primary/30 transition-colors cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon size={17} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">{label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* Stats */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-success" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Statistik</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={FileText}   label="Materi"    value={stats.materials}  color="text-accent-blue"   loading={isLoading} />
            <StatCard icon={BookMarked} label="Catatan"   value={stats.notes}      color="text-success"       loading={isLoading} />
            <StatCard icon={CreditCard} label="Flashcard" value={stats.flashcards} color="text-accent-purple" loading={isLoading} />
            <StatCard icon={HelpCircle} label="Quiz"      value={stats.quizzes}    color="text-accent-teal"   loading={isLoading} />
          </div>
          {/* D6: badge observability storage */}
          {data?.storage && (
            <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
              <Database size={14} className="text-accent-blue" />
              <span>Penyimpanan: <span className="text-text font-medium">{formatBytes(data.storage.total)}</span></span>
              <span className="opacity-50">·</span>
              <span>Upload {formatBytes(data.storage.uploads)}</span>
              <span className="opacity-50">·</span>
              <span>Audio {formatBytes(data.storage.audio)}</span>
              <span className="opacity-50">·</span>
              <span>Trash {formatBytes(data.storage.trash)}</span>
            </div>
          )}
        </motion.section>

        {/* Recent Materials + Recent Quizzes side by side */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Materi Terbaru */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-text-secondary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Materi Terbaru</h2>
              </div>
              <button onClick={() => navigate('/materi')} className="text-xs text-primary hover:text-primary/80 transition-colors">
                Lihat semua →
              </button>
            </div>
            <div className="card-base overflow-hidden p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-4 bg-border rounded animate-pulse" />
                  ))}
                </div>
              ) : recentMaterials.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">Belum ada materi</div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {recentMaterials.map((m) => (
                      <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-background/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{fileIcon(m.material_type)}</span>
                            <span className="text-text font-medium truncate max-w-[130px] text-xs">{m.filename}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-text-muted text-xs">{m.subject?.name || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`badge text-[10px] ${m.status === 'Ready' ? 'badge-success' : m.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Quiz Terbaru */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Trophy size={14} className="text-text-secondary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Quiz Terbaru</h2>
              </div>
              <button onClick={() => navigate('/quiz')} className="text-xs text-primary hover:text-primary/80 transition-colors">
                Lihat semua →
              </button>
            </div>
            <div className="card-base overflow-hidden p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-4 bg-border rounded animate-pulse" />
                  ))}
                </div>
              ) : recentQuizzes.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">Belum ada quiz</div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {recentQuizzes.map((q) => (
                      <tr key={q.id} className="border-b border-border/50 last:border-0 hover:bg-background/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="text-text font-medium text-xs truncate max-w-[150px] block">{q.title}</span>
                          <span className="text-text-muted text-[10px]">{q.subject?.name || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {q.score !== null && q.score !== undefined ? (
                            <span className={`text-xs font-bold ${q.score >= 70 ? 'text-success' : q.score >= 50 ? 'text-warning' : 'text-danger'}`}>
                              {q.score}
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-muted">Belum dimainkan</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-text-muted text-[10px]">{formatDate(q.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.section>

        {/* Empty state */}
        {!isLoading && stats.materials === 0 && stats.subjects === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="card-base text-center py-16"
          >
            <div className="text-6xl mb-4">🎓</div>
            <h3 className="text-xl font-bold text-text mb-2">Selamat Datang di Kabayan AI!</h3>
            <p className="text-text-secondary mb-6 max-w-sm mx-auto">
              Mulai dengan membuat Mata Kuliah dan mengunggah materi pertama kamu.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/subjects')} className="btn-primary">Buat Mata Kuliah</button>
              <button onClick={() => navigate('/materi')} className="btn-ghost border border-border">Upload Materi</button>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
