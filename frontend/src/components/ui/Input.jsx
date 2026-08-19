import { forwardRef } from 'react';
import { cn } from '@/utils';

const base =
  'input-base appearance-none';

export const Input = forwardRef(({ className, error = false, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      base,
      error && 'border-danger/60 focus:border-danger/60 focus:ring-danger/30',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = forwardRef(({ className, error = false, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      base,
      'resize-y',
      error && 'border-danger/60 focus:border-danger/60 focus:ring-danger/30',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef(({ className, error = false, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      base,
      'cursor-pointer',
      error && 'border-danger/60',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
