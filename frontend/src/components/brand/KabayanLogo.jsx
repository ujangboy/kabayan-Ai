import { useId } from 'react';
import { cn } from '@/utils';

/**
 * Identitas Kabayan AI.
 *
 * Mark: huruf K yang dibentuk dari dua sapuan kuas + satu bintang kunyit.
 * K = Kabayan, bintang = percikan AI, dan bentuknya tetap terbaca di 16px.
 * Wordmark memakai Plus Jakarta Sans agar terasa lokal, hangat, dan tegas.
 */
export function KabayanMark({ size = 36, className }) {
  const uid = useId().replace(/:/g, '');
  const gradientId = `kabayan-mark-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="2" x2="37" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#148A63" />
          <stop offset="1" stopColor="#084F3D" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#${gradientId})`} />
      <path
        d="M12.75 9.75v20.5M13.1 20.35l8.55-8.8M13.1 20.35l8.55 8.8"
        stroke="#F7FFFB"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28.4 7.5l1.35 3.55 3.55 1.35-3.55 1.35-1.35 3.55-1.35-3.55-3.55-1.35 3.55-1.35L28.4 7.5Z"
        fill="#F4B860"
      />
    </svg>
  );
}

export default function KabayanLogo({ collapsed = false, className, markSize = 36 }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)} aria-label="Kabayan AI">
      <KabayanMark size={markSize} />
      {!collapsed && (
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-display text-[19px] font-extrabold tracking-[-0.045em] text-text">
            kabayan
          </span>
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary-light">
            AI
          </span>
        </span>
      )}
    </span>
  );
}
