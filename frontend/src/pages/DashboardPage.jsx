import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@/store';
import { formatDate, formatBytes } from '@/utils';
import { getMaterialStatusLabel } from '@/utils/status';
import { EmptyState, Skeleton, HelpTip, Icon, Button, getCardTone } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import FileTypeIcon from '@/components/FileTypeIcon';
import StudyInsights from '@/components/study/StudyInsights';
import { KabayanMark } from '@/components/brand/KabayanLogo';
import api from '@/services/api';

const QUICK_ACTIONS = (t) => [
  { icon: ICONS.communication.chat, label: t('dashboard.quickChat'),       desc: t('dashboard.quickChatDesc'),     to: '/chat',             tone: 'green' },
  { icon: ICONS.files.document,      label: t('dashboard.quickUpload'),     desc: t('dashboard.quickUploadDesc'),    to: '/materi?upload=1',  tone: 'neutral' },
  { icon: ICONS.nav.flashcard,       label: t('dashboard.quickFlashcard'),  desc: t('dashboard.quickFlashcardDesc'), to: '/flashcard',        tone: 'neutral' },
  { icon: ICONS.ui.help,             label: t('dashboard.quickQuiz'),       desc: t('dashboard.quickQuizDesc'),      to: '/quiz',             tone: 'neutral' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
};

function StatCard({ icon, label, value, loading }) {
  return (
    <motion.div variants={item} className="card-base card-hoverable relative flex items-center gap-3.5 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-subtle text-text-secondary">
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <div className="font-display text-2xl font-bold leading-tight tracking-[-0.035em] text-text">
          {loading ? <Skeleton className="inline-block h-7 w-10 rounded-lg" /> : (value ?? 0)}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-secondary">{label}</p>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
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
  const locale = i18n.language === 'en' ? 'en-GB' : i18n.language === 'su' ? 'id-ID' : 'id-ID';
  const todayLabel = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

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
      <div className="mx-auto w-full max-w-[1240px] space-y-8 p-5 md:p-8 lg:p-10">

        {/* Greeting — flat tipografis di kanvas, tanpa kartu dekorasi. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative pt-2 md:pt-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-2xs font-bold uppercase tracking-[0.16em] text-primary-light">
            <KabayanMark size={22} />
            <span>{t('nav.groupToday')}</span>
            <span className="text-text-muted/60">·</span>
            <span className="font-medium normal-case tracking-normal text-text-muted">{todayLabel}</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-[-0.04em] text-text md:text-4xl">
            {greeting}!
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            {t('dashboard.tagline')}
            {stats.subjects > 0 && ` ${t('dashboard.activeSubjects', { count: stats.subjects })}`}
            <HelpTip label={t('help.dashboard')} className="ml-1.5 -mt-0.5 align-middle" />
          </p>
        </motion.div>

        {/* Quick Actions — satu CTA solid, sisanya netral. */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item} className="mb-4">
            <h2 className="font-display text-2xs font-bold uppercase tracking-[0.14em] text-text-muted">{t('dashboard.sectionQuickActions')}</h2>
          </motion.div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_ACTIONS(t).map(({ icon, label, desc, to, tone }) => {
              const isPrimary = tone === 'green';
              return (
                <motion.button
                  key={to}
                  variants={item}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => handleQuickAction(to)}
                  className={`card-base card-hoverable relative flex cursor-pointer items-center gap-3.5 p-4 text-left ${
                    isPrimary ? getCardTone('primary').card : ''
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isPrimary ? 'bg-white/15 text-white' : 'bg-subtle text-text-secondary'
                  }`}>
                    <Icon name={icon} size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-meta font-semibold leading-tight sm:truncate ${isPrimary ? 'text-white' : 'text-text'}`}>{label}</p>
                    <p className="mt-0.5 hidden truncate text-xs text-text-muted sm:block">{desc}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* Daily insights tampil sebelum angka perpustakaan: yang dibutuhkan
            saat membuka aplikasi adalah "apa yang harus dikerjakan hari ini". */}
        <StudyInsights />

        {/* Stats */}
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item} className="mb-4">
            <h2 className="font-display text-2xs font-bold uppercase tracking-[0.14em] text-text-muted">{t('dashboard.sectionStats')}</h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ICONS.files.document}   label={t('dashboard.statMaterials')}    value={stats.materials}  loading={isLoading} />
            <StatCard icon={ICONS.learning.bookmarks} label={t('dashboard.statNotes')}       value={stats.notes}      loading={isLoading} />
            <StatCard icon={ICONS.nav.flashcard} label={t('dashboard.statFlashcards')}  value={stats.flashcards} loading={isLoading} />
            <StatCard icon={ICONS.ui.help} label={t('dashboard.statQuizzes')}     value={stats.quizzes}    loading={isLoading} />
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
              <h2 className="font-display text-2xs font-bold uppercase tracking-[0.14em] text-text-muted">{t('dashboard.sectionRecentMaterials')}</h2>
              <button onClick={() => navigate('/materi')} className="text-xs text-primary-light hover:text-primary transition-colors">
                {t('dashboard.viewAll')}
              </button>
            </div>
            <div className="card-base p-0">
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
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">{t('common.file')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">{t('dashboard.colSubject')}</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">{t('common.status')}</th>
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
                            {getMaterialStatusLabel(t, m.status)}
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
              <h2 className="font-display text-2xs font-bold uppercase tracking-[0.14em] text-text-muted">{t('dashboard.sectionRecentQuizzes')}</h2>
              <button onClick={() => navigate('/quiz')} className="text-xs text-primary-light hover:text-primary transition-colors">
                {t('dashboard.viewAll')}
              </button>
            </div>
            <div className="card-base p-0">
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
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-text-muted">{t('dashboard.colQuizTitle')}</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-text-muted">{t('common.score')}</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-text-muted">{t('common.date')}</th>
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
                    <Button onClick={() => navigate('/materi?upload=1')} className="border border-border" variant="ghost">{t('dashboard.uploadMaterial')}</Button>
                  </div>
                }
              />
            </motion.div>
        )}

      </div>
    </div>
  );
}