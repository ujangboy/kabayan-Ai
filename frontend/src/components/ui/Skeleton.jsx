import { cn } from '@/utils';

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}
