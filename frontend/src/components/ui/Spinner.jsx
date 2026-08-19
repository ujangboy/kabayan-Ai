import { cn } from '@/utils';
import { Loader2 } from '@/icons';

export function Spinner({ size = 16, className }) {
  return <Loader2 size={size} className={cn('animate-spin', className)} aria-hidden="true" />;
}
