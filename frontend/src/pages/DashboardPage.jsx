import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/store';
import { formatDate, formatBytes } from '@/utils';
import { EmptyState, Skeleton, HelpTip, Icon , Button} from '@/components/ui';
import { ICONS } from '@/lib/icons';
import FileTypeIcon from '@/components/FileTypeIcon';
import StudyInsights from '@/components/study/StudyInsights';
import api from '@/services/api';

const QUICK_ACTIONS = (t) => [
  { icon: ICONS.communication.chat, label: t('dashboard.quickChat'),       desc: t('dashboard.quickChatDesc'),     to: '/chat',      color: 'bg-primary text-white',       shadow: 'shadow-card' },
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
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
};

function StatCard({ icon, label, value, tone, loading }) {
  return (
    <motion.div variants={item} className="card-base card-hoverable relative overflow-hidden flex items-center gap-4 p-5">
      {/* Colored top strip per tone */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${STAT_TONES[tone].split(' ')[0].replace('bg-', 'bg-').replace('/10', '/60')}`} />
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${STAT_TONES[tone]}`}>
        <Icon name={icon} size={20} />
      </div>
      <div>
        <div className="text-2xl font-bold text-text tracking-tight">
          {loading ? <Skeleton className="inline-block h-7 w-10 rounded-lg" /> : (value ?? 0)}
        </div>
        <p className="text-xs text-text-secondary mt-0.5">{label}</p>
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
      <div className="w-full p-6 md:p-10 space-y-6">

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center shadow-card">
              <Icon name={ICONS.learning.wavingHand} size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text tracking-headline">
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
                  <p className="text-sm font-semibold text-text">{label}</p>
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

        {/* Study Insights (R7: wire study cards) */}
        <StudyInsights />

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
                <div className="p-5 space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-4 w-full rounded-lg" />)}
                </div>
              ) : recentMaterials.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">{t('dashboard.noMaterials')}</div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">File</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">Mata Pelajaran</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMaterials.map((m) => (
                      <tr key={m.id} className="tr-divider last:border-0 hover:bg-card-hover/60 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <FileTypeIcon type={m.material_type} className="text-base text-text-muted shrink-0" />
                            <span className="text-text font-medium truncate max-w-[130px] text-xs">{m.filename}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary text-xs">{m.subject?.name || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`badge text-xs ${m.status === 'Ready' ? 'badge-success' : m.status === 'Failed' ? 'badge-danger' : 'badge-warning'}`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
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
                <div className="p-5 space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-4 w-full rounded-lg" />)}
                </div>
              ) : recentQuizzes.length === 0 ? (
                <div className="p-6 text-center text-xs text-text-muted">{t('dashboard.noQuizzes')}</div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">Judul Quiz</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-text-muted">Skor</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-text-muted">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentQuizzes.map((q) => (
                      <tr key={q.id} className="tr-divider last:border-0 hover:bg-card-hover/60 transition-colors">
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
                        <td className="px-4 py-2.5 text-text-muted text-3xs text-right">{formatDate(q.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
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
                    <Button onClick={() => navigate('/subjects')} className="" variant="primary">{t('dashboard.createSubject')}</Button>
                    <Button onClick={() => navigate('/materi')} className="border border-border" variant="ghost">{t('dashboard.uploadMaterial')}</Button>
                  </div>
                }
              />
            </motion.div>
        )}

      </div>
    </div>
  );
}