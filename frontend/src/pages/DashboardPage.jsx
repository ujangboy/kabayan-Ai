import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/store';
import { formatDate } from '@/utils';
import { EmptyState, Skeleton, HelpTip, Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import FileTypeIcon from '@/components/FileTypeIcon';
import api from '@/services/api';

const formatBytes = (bytes) => {
  if (bytes == null) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const QUICK_ACTIONS = (t) => [
  { icon: ICONS.communication.chat, label: t('dashboard.quickChat'),       desc: t('dashboard.quickChatDesc'),     to: '/chat',      color: 'bg-gradient-primary text-white',       shadow: 'shadow-btn-primary' },
  { icon: ICONS.files.document,      label: t('dashboard.quickUpload'),     desc: t('dashboard.quickUploadDesc'),    to: '/materi',    color: 'bg-accent-blue/15 text-accent-blue',   shadow: '' },
  { icon: ICONS.nav.flashcard,    label: t('dashboard.quickFlashcard'),  desc: t('dashboard.quickFlashcardDesc'),  to: '/flashcard', color: 'bg-accent-purple/15 text-accent-purple', shadow: '' },
  { icon: ICONS.ui.help,    label: t('dashboard.quickQuiz'),       desc: t('dashboard.quickQuizDesc'),        to: '/quiz',      color: 'bg-accent-teal/15 text-accent-teal',   shadow: '' },
];

const STAT_TONES = {
  blue:   'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  green:  'bg-success/10 text-success border-success/20',
  purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
  teal:   'bg-accent-teal/10 text-accent-teal border-accent-teal/20',
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
};

function StatCard({ icon, label, value, tone, loading }) {
  return (
    <motion.div className="card-base card-hoverable relative overflow-hidden flex items-center gap-4 p-4">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-primary opacity-70" />
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${STAT_TONES[tone]}`}>
        <Icon name={icon} size={18} />
      </div>
      <div>
        <div className="text-2xl font-bold bg-gradient-to-r from-text to-text-secondary bg-clip-text text-transparent">
            {loading ? <Skeleton className="inline-block h-6 w-8" /> : (value ?? 0)}
        </div>
        <p className="text-xs text-text-secondary">{label}</p>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { createChat } = useChatStore();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 30000, // refresh setiap 30 detik
    staleTime: 15000,
  });

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? t('dashboard.greetingMorning') : hour < 15 ? t('dashboard.greetingAfternoon') : hour < 18 ? t('dashboard.greetingEvening') : t('dashboard.greetingNight');

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
      <div className="w-full px-6 md:px-10 py-6 md:py-8 space-y-10">

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-btn-primary">
              <Icon name={ICONS.learning.wavingHand} size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text bg-gradient-to-r from-primary-light to-accent-blue bg-clip-text text-transparent">
                {greeting}!
              </h1>
              <p className="text-text-secondary text-sm">
                {t('dashboard.tagline')}
                {stats.subjects > 0 && ` ${t('dashboard.activeSubjects', { count: stats.subjects })}`}
                <HelpTip label={t('help.dashboard')} className="ml-1.5 -mt-0.5 align-middle" />
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item} className="flex items-center gap-2 mb-4">
            <Icon name={ICONS.ui.bolt} size={16} className="text-warning" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('dashboard.sectionQuickActions')}</h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_ACTIONS(t).map(({ icon, label, desc, to, color, shadow }) => (
              <motion.button
                key={to}
                variants={item}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleQuickAction(to)}
                className="card-base card-hoverable flex flex-col items-start gap-3 p-4 text-left hover:border-primary/30 transition-all duration-300 cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} ${shadow}`}>
                  <Icon name={icon} size={17} />
                </div>
                <div>
                  <p className="text-base font-semibold text-text">{label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* Stats */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item} className="flex items-center gap-2 mb-4">
            <Icon name={ICONS.learning.progress} size={16} className="text-success" />
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('dashboard.sectionStats')}</h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ICONS.files.document}   label={t('dashboard.statMaterials')}    value={stats.materials}  tone="blue"   loading={isLoading} />
            <StatCard icon={ICONS.learning.bookmarks} label={t('dashboard.statNotes')}       value={stats.notes}      tone="green"  loading={isLoading} />
            <StatCard icon={ICONS.nav.flashcard} label={t('dashboard.statFlashcards')}  value={stats.flashcards} tone="purple" loading={isLoading} />
            <StatCard icon={ICONS.ui.help} label={t('dashboard.statQuizzes')}     value={stats.quizzes}    tone="teal"   loading={isLoading} />
          </div>
          {/* D6: badge observability storage */}
          {data?.storage && (
            <div className="mt-4 flex items-center gap-2 text-xs text-text-secondary px-1">
              <Icon name={ICONS.ui.database} size={14} className="text-accent-blue" />
              <span>{t('dashboard.storageLabel')}: <span className="text-text font-medium">{formatBytes(data.storage.total)}</span></span>
              <span className="opacity-50">·</span>
              <span>{t('dashboard.storageUploads', { size: formatBytes(data.storage.uploads) })}</span>
              <span className="opacity-50">·</span>
              <span>{t('dashboard.storageTrash', { size: formatBytes(data.storage.trash) })}</span>
            </div>
          )}
        </motion.section>

        {/* Recent Materials + Recent Quizzes side by side */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Materi Terbaru */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name={ICONS.learning.clock} size={14} className="text-text-secondary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('dashboard.sectionRecentMaterials')}</h2>
              </div>
              <button onClick={() => navigate('/materi')} className="text-xs text-primary-light hover:text-primary transition-colors">
                {t('dashboard.viewAll')}
              </button>
            </div>
            <div className="card-base overflow-hidden p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {[1,2,3].map(i => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                ) : recentMaterials.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">{t('dashboard.noMaterials')}</div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {recentMaterials.map((m) => (
                      <tr key={m.id} className="tr-divider last:border-0 hover:bg-card-hover/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                             <FileTypeIcon type={m.material_type} className="text-base text-text-muted" />
                            <span className="text-text font-medium truncate max-w-[130px] text-xs">{m.filename}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-text-muted text-xs">{m.subject?.name || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`badge text-3xs ${m.status === 'Ready' ? 'badge-success' : m.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>

          {/* Quiz Terbaru */}
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name={ICONS.learning.trophy} size={14} className="text-text-secondary" />
                <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('dashboard.sectionRecentQuizzes')}</h2>
              </div>
              <button onClick={() => navigate('/quiz')} className="text-xs text-primary-light hover:text-primary transition-colors">
                {t('dashboard.viewAll')}
              </button>
            </div>
            <div className="card-base overflow-hidden p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">
                    {[1,2,3].map(i => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                ) : recentQuizzes.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">{t('dashboard.noQuizzes')}</div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {recentQuizzes.map((q) => (
                      <tr key={q.id} className="tr-divider last:border-0 hover:bg-card-hover/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="text-text font-medium text-xs truncate max-w-[150px] block">{q.title}</span>
                          <span className="text-text-muted text-3xs">{q.subject?.name || '—'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {q.score !== null && q.score !== undefined ? (
                            <span className={`text-xs font-bold ${q.score >= 70 ? 'text-success' : q.score >= 50 ? 'text-warning' : 'text-danger'}`}>
                              {q.score}
                            </span>
                          ) : (
                            <span className="text-3xs text-text-muted">{t('dashboard.notPlayed')}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-text-muted text-3xs">{formatDate(q.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </motion.section>

        {/* Empty state */}
        {!isLoading && stats.materials === 0 && stats.subjects === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="card-base"
            >
              <EmptyState
                icon={ICONS.learning.school}
                title={t('dashboard.welcomeTitle')}
                description={t('dashboard.welcomeText')}
                action={
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => navigate('/subjects')} className="btn-primary">{t('dashboard.createSubject')}</button>
                    <button onClick={() => navigate('/materi')} className="btn-ghost border border-border">{t('dashboard.uploadMaterial')}</button>
                  </div>
                }
              />
            </motion.div>
        )}

      </div>
    </div>
  );
}