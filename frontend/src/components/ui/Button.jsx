import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/utils';
import { Spinner } from './Spinner';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium select-none whitespace-nowrap transition-all duration-200 cursor-pointer ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background ' +
    'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.97]',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-primary text-white shadow-btn-primary hover:brightness-110 hover:shadow-glow-sm',
        secondary:
          'bg-card text-text border border-border hover:bg-card-hover hover:border-primary/30',
        ghost: 'text-text-secondary hover:bg-card hover:text-text',
        danger: 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20',
        outline: 'border border-border text-text hover:bg-card hover:border-primary/30',
        link: 'text-primary-light underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-btn', // 12px — chip-keep small
        md: 'h-10 px-4 text-[15px] rounded-btn', // Gemini Button 15/500 (was text-sm 14)
        lg: 'h-11 px-5 text-[15px] rounded-btn',
        icon: 'h-10 w-10 rounded-btn',
        'icon-sm': 'h-8 w-8 rounded-btn',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export const Button = forwardRef(
  (
    { className, variant, size, asChild = false, loading = false, disabled, type, children, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : isDisabled}
        aria-busy={loading || undefined}
        type={asChild ? undefined : type || 'button'}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Spinner size={16} className="shrink-0" />}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';