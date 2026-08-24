import { forwardRef } from 'react';
import { cn } from '@/utils';

export const Card = forwardRef(({ className, hoverable = false, as: Comp = 'div', ...props }, ref) => (
  <Comp
    ref={ref}
    className={cn(
      'bg-surface-2 border border-border rounded-lg shadow-card',
      hoverable && 'card-hoverable',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex items-center justify-between gap-3 p-5 pb-0', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('font-semibold text-text', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center gap-2 p-5 pt-0', className)} {...props} />;
}