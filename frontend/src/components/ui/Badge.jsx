import { cn } from '@/utils';

const VARIANTS = {
  primary: 'bg-primary/15 text-primary-light',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  secondary: 'bg-card text-text-secondary border border-border',
};

export function Badge({ className, variant = 'secondary', size = 'md', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        VARIANTS[variant],
        size === 'sm' ? 'text-2xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5',
        className
      )}
      {...props}
    />
  );
}