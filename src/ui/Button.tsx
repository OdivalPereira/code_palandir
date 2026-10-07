import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50 select-none';
    
    const variants = {
      default: 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-sm',
      outline: 'border border-slate-700 bg-slate-900/50 text-slate-100 hover:bg-slate-800 hover:text-white',
      ghost: 'text-slate-200 hover:bg-slate-800 hover:text-white',
      secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
      destructive: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 shadow-sm',
    };

    const sizes = {
      sm: 'h-8 px-2.5 text-xs gap-1.5',
      md: 'h-9 px-3.5 text-sm gap-2',
      lg: 'h-10 px-5 text-base gap-2.5',
      icon: 'h-8 w-8 text-sm',
    };

    const isAriaDisabled = disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true';

    return (
      <button
        ref={ref}
        {...props}
        disabled={disabled}
        aria-disabled={isAriaDisabled ? true : undefined}
        className={cn(base, variants[variant], sizes[size], className)}
      />
    );
  }
);
Button.displayName = 'Button';
