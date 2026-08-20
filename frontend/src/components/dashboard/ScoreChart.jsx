import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils';

export default function ScoreChart({ history }) {
  const { t } = useTranslation();
  const [hoverIdx, setHoverIdx] = useState(null);
  const data = (history || []).filter(d => d && d.score != null).slice(-10);

  if (data.length < 2) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        {data.length === 1
          ? t('subjectDashboard.chartOneScore')
          : t('subjectDashboard.chartNoScores')}
      </div>
    );
  }

  const W = 560, H = 200, PAD_X = 36, PAD_Y = 24;
  const scores = data.map(d => d.score);
  const minScore = Math.max(0, Math.floor((Math.min(...scores) - 10) / 10) * 10);
  const maxScore = Math.min(100, Math.ceil((Math.max(...scores) + 10) / 10) * 10);

  const x = (i) => PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, data.length - 1);
  const y = (s) => H - PAD_Y - ((s - minScore) / Math.max(1, maxScore - minScore)) * (H - PAD_Y * 2);

  const chartPoints = data.map((d, i) => `${x(i).toFixed(1)},${y(d.score).toFixed(1)}`).join(' ');
  const lastX = x(data.length - 1).toFixed(1);
  const bottomY = H - PAD_Y;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {[0, 1, 2, 3].map(g => {
          const val = minScore + ((maxScore - minScore) * g) / 3;
          const yy = y(val);
          return (
            <g key={g}>
              <line x1={PAD_X} y1={yy} x2={W - PAD_X} y2={yy} className="stroke-border" strokeWidth="1" strokeDasharray="4 4" />
              <text x={4} y={yy + 3} fontSize="9" className="fill-text-muted">{Math.round(val)}</text>
            </g>
          );
        })}
        <polygon
          points={`${PAD_X},${bottomY} ${chartPoints} ${lastX},${bottomY}`}
          className="fill-primary" opacity="0.08"
        />
        <polyline points={chartPoints} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => {
          const isHovered = hoverIdx === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={x(i)} cy={y(d.score)} r="12" fill="transparent" />
              <circle
                cx={x(i)} cy={y(d.score)}
                r={isHovered ? 6 : 4}
                className={cn('stroke-card', d.score >= 70 ? 'fill-success' : d.score >= 50 ? 'fill-warning' : 'fill-danger')}
                strokeWidth="1.5"
              />
              <text x={x(i)} y={y(d.score) - 10} fontSize="10" fontWeight="700" className="fill-text" textAnchor="middle">
                {d.score}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize="9" className="fill-text-muted" textAnchor="middle">
            {new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </text>
        ))}
      </svg>
      {hoverIdx != null && data[hoverIdx] && (
        <div
          className="absolute pointer-events-none z-10 bg-slate-800/95 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 shadow-lg text-xs"
          style={{
            left: `${(x(hoverIdx) / W) * 100}%`,
            top: `${(y(data[hoverIdx].score) / H) * 100 - 12}%`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <p className="font-bold text-text">{data[hoverIdx].score}</p>
          <p className="text-text-muted">{data[hoverIdx].label}</p>
          <p className="text-text-muted">
            {new Date(data[hoverIdx].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {hoverIdx > 0 && (
            <p className={data[hoverIdx].score >= data[hoverIdx - 1].score ? 'text-success' : 'text-danger'}>
              {data[hoverIdx].score >= data[hoverIdx - 1].score ? '+' : ''}
              {data[hoverIdx].score - data[hoverIdx - 1].score} dari sebelumnya
            </p>
          )}
        </div>
      )}
    </div>
  );
}
