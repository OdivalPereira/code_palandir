import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isInvalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, isInvalid, ...props }, ref) => {
    const hasError = isInvalid || props['aria-invalid'] === true || props['aria-invalid'] === 'true';

    return (
      <input
        type={type}
        ref={ref}
        {...props}
        aria-invalid={hasError ? 'true' : props['aria-invalid']}
        className={cn(
          'flex h-9 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          hasError && 'border-rose-500 focus-visible:ring-rose-500',
          className
        )}
      />
    );
  }
);
Input.displayName = 'Input';
