import { Icon } from '@/components/ui';
import { ICONS } from '@/lib/icons';
import { cn } from '@/utils';

export function Spinner({ size = 16, className }) {
  return <Icon name={ICONS.status.loading} size={size} className={cn('animate-spin', className)} aria-hidden="true" />;
}