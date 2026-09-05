import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'blue'
    | 'emerald'
    | 'purple'
    | 'amber'
    | 'rose'
    | 'cyan';
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  ...props
}) => {
  const base = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tracking-wide transition-colors';

  const variants = {
    default: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    secondary: 'bg-slate-800 text-slate-300 border border-slate-700',
    outline: 'text-slate-300 border border-slate-700',
    blue: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    emerald: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    purple: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  };

  return (
    <div className={cn(base, variants[variant], className)} {...props} />
  );
};
