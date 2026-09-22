import type {ComponentProps} from 'react';
import {cn} from '@/lib/utils';

export function Stat({className,...props}:ComponentProps<'div'>){return <div data-slot="stat" className={cn('min-w-0 px-4 py-4',className)} {...props}/>;}
export function StatLabel({className,...props}:ComponentProps<'div'>){return <div data-slot="stat-label" className={cn('text-xs font-medium text-muted-foreground',className)} {...props}/>;}
export function StatValue({className,...props}:ComponentProps<'div'>){return <div data-slot="stat-value" className={cn('mt-1.5 font-mono text-[28px] leading-none font-semibold tabular-nums tracking-tight',className)} {...props}/>;}
export function StatIndicator({className,...props}:ComponentProps<'span'>){return <span data-slot="stat-indicator" className={cn('text-xs',className)} {...props}/>;}
export function StatTrend({className,...props}:ComponentProps<'span'>){return <span data-slot="stat-trend" className={cn('text-xs text-muted-foreground',className)} {...props}/>;}
