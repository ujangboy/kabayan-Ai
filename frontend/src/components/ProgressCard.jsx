import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { cn } from '@/utils';
import { Icon } from '@/components/ui/Icon';
import { ICONS } from '@/lib/icons';

const DIRECTION_META = (t) => ({
  naik:   { cls: 'badge-success', icon: ICONS.learning.progress, label: t('studyProgress.trendUp') },
  turun:  { cls: 'badge-danger',  icon: ICONS.learning.regress,  label: t('studyProgress.trendDown') },
  stabil: { cls: 'badge-warning', icon: ICONS.ui.minus,          label: t('studyProgress.trendStable') },
});

export default function ProgressCard({ progress }) {
  const { t } = useTranslation();
  if (!progress) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon name={ICONS.learning.streak} size={16} className="text-warning" />
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyProgress.title')}</h2>
        </div>
        <div className="text-center py-6">
          <Icon name={ICONS.learning.streak} size={30} className="mx-auto mb-3 text-warning/40" />
          <p className="text-xs font-semibold text-text mb-1">{t('studyProgress.emptyTitle', 'Mulai bangun streak belajarmu')}</p>
          <p className="text-2xs text-text-muted max-w-[240px] mx-auto">
            {t('studyProgress.empty', 'Kerjakan quiz, flashcard, atau simulasi ujian untuk mengisi data konsistensi.')}
          </p>
        </div>
      </motion.div>
    );
  }

  const streak = progress.streak || {};
  const trend = progress.mastery_trend || {};
  const windowDays = streak.activity_last_14_days || [];
  const hasActivity = streak.total_active_days > 0;
  const series = trend.series || [];
  const dirMeta = DIRECTION_META(t)[trend.direction];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon name={ICONS.learning.streak} size={16} className="text-warning" />
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">{t('studyProgress.title')}</h2>
      </div>
      <p className="text-xs text-text-muted mb-4">{t('studyProgress.subtitle')}</p>

      {!hasActivity ? (
        <div className="text-center py-6 text-text-muted text-sm border border-dashed border-border rounded-xl">
          <Icon name={ICONS.learning.calendar} size={20} className="mx-auto mb-2 opacity-60" />
          {t('studyProgress.empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-warning flex items-center justify-center gap-1">
                <Icon name={ICONS.learning.streak} size={16} className="shrink-0" />{streak.current_streak_days ?? 0}
              </p>
              <p className="text-3xs text-text-secondary mt-0.5">{t('studyProgress.streakCurrent')}</p>
            </div>
            <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-text">{streak.longest_streak_days ?? 0}</p>
              <p className="text-3xs text-text-secondary mt-0.5">{t('studyProgress.streakLongest')}</p>
            </div>
            <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-text">{streak.total_active_days ?? 0}</p>
              <p className="text-3xs text-text-secondary mt-0.5">{t('studyProgress.activeDays')}</p>
            </div>
          </div>

          {/* 14-day activity bars */}
          <div>
            <p className="text-3xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{t('studyProgress.windowTitle')}</p>
            <div className="flex items-end gap-1 h-14">
              {windowDays.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.date}`}>
                  <div
                    className={`w-full rounded-sm transition-colors ${d.active ? 'bg-warning' : 'bg-border/60'}`}
                    style={{ height: d.active ? '100%' : '22%' }}
                  />
                </div>
              ))}
            </div>
            <p className="text-2xs text-text-muted mt-1">{t('studyProgress.windowHint')}</p>
          </div>

          {/* Mastery trend */}
          <div className="bg-black/25 border border-white/[0.06] rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-3xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1">
                <Icon name={ICONS.learning.trophy} size={11} /> {t('studyProgress.trendTitle')}
              </p>
              {trend.direction && dirMeta && (
                <span className={`badge text-2xs ${dirMeta.cls}`}>
                  <Icon name={dirMeta.icon} size={9} className="inline mr-0.5" />{dirMeta.label}
                </span>
              )}
            </div>
            {series.length < 2 ? (
              <p className="text-2xs text-text-muted">{t('studyProgress.trendNeedData')}</p>
            ) : (
              <TrendMiniChart series={series} />
            )}
            <div className="flex items-center justify-between mt-1.5 text-3xs text-text-muted">
              <span>{series.length > 0 ? `${series.length} ${t('studyProgress.sessions')}` : ''}</span>
              {trend.last_session_avg != null && (
                <span>{t('studyProgress.lastSession', { avg: trend.last_session_avg })}</span>
              )}
            </div>
          </div>

          {streak.last_active_date && (
            <p className="text-3xs text-text-muted">
              {t('studyProgress.lastActive', { date: streak.last_active_date })}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

function TrendMiniChart({ series }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(null);
  const W = 320, H = 64, PAD = 4;
  const vals = series.map(s => s.avg_accuracy);
  const minV = Math.max(0, Math.floor(Math.min(...vals) - 10));
  const maxV = Math.min(100, Math.ceil(Math.max(...vals) + 10));
  const range = Math.max(1, maxV - minV);
  const x = (i) => PAD + (i * (W - PAD * 2)) / Math.max(1, series.length - 1);
  const y = (v) => H - PAD - ((v - minV) / range) * (H - PAD * 2);

  const points = series.map((s, i) => `${x(i).toFixed(1)},${y(s.avg_accuracy).toFixed(1)}`).join(' ');

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <polygon points={`${PAD},${H - PAD} ${points} ${x(series.length - 1).toFixed(1)},${H - PAD}`} className="fill-primary" opacity="0.08" />
        <polyline points={points} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) => (
          <g key={i} className="cursor-pointer" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={x(i) - 8} y={0} width="16" height={H} fill="transparent" />
            <circle cx={x(i)} cy={y(s.avg_accuracy)} r={hover === i ? 4.5 : 3} className={cn('stroke-card', s.avg_accuracy >= 70 ? 'fill-success' : s.avg_accuracy >= 40 ? 'fill-warning' : 'fill-danger')} strokeWidth="1.5" />
          </g>
        ))}
      </svg>
      {hover != null && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur-sm border border-white/10 rounded-lg px-2 py-1 text-3xs text-text shadow-lg whitespace-nowrap">
          {t('studyProgress.trendTooltip', { session: series[hover].session, avg: series[hover].avg_accuracy, topics: series[hover].topics_measured })}
        </div>
      )}
    </div>
  );
}