import { forwardRef } from 'react';
import { cn } from '@/utils';

const base =
  'input-base appearance-none';

export const Input = forwardRef(({ className, error = false, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      base,
      // Fallback explicit color jika .input-base ter-override
      'text-text',
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
      'resize-y text-text',
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
    style={{ colorScheme: 'light dark' }}
    className={cn(
      base,
      // Override keras agar teks selalu terang di bg gelap — fix screenshot: text gelap di bg gelap
      'cursor-pointer pr-9 text-text placeholder:text-text-secondary',
      'bg-subtle border-strong',
      'focus:bg-subtle focus:border-primary/60',
      'disabled:opacity-60 disabled:cursor-not-allowed',
      error && 'border-danger/60',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';