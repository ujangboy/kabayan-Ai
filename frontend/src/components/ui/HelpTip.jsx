/**
 * HelpTip — ikon bantuan (?) dengan tooltip kontekstual.
 * Dipakai di header halaman/komponen untuk memberikan konteks singkat.
 *
 * Penggunaan:
 *   <HelpTip label={t('help.exam')} />
 */
import { HelpCircle } from '@/icons';
import { Tooltip } from './Tooltip';
import { cn } from '@/utils';

export function HelpTip({ label, className, size = 15, align = 'center' }) {
  return (
    <Tooltip label={label} side="top" align={align}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted',
          'transition-colors hover:bg-card hover:text-primary-light',
          className
        )}
      >
        <HelpCircle size={size} />
      </button>
    </Tooltip>
  );
}