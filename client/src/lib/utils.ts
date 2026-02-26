import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function getStatusColor(status: string): string {
    const map: Record<string, string> = {
        'lead': 'bg-blue-100 text-blue-700',
        'new': 'bg-blue-100 text-blue-700',
        'qualified': 'bg-purple-100 text-purple-700',
        'proposal': 'bg-orange-100 text-orange-700',
        'proposal_sent': 'bg-orange-100 text-orange-700',
        'negotiation': 'bg-amber-100 text-amber-700',
        'in_hand': 'bg-emerald-100 text-emerald-700',
        'urgent': 'bg-red-100 text-red-700',
        'won': 'bg-green-100 text-green-700',
        'lost': 'bg-red-100 text-red-700',
        'contacted': 'bg-yellow-100 text-yellow-700',
        'active': 'bg-green-100 text-green-700',
        'completed': 'bg-slate-100 text-slate-600',
        'on_hold': 'bg-yellow-100 text-yellow-700',
        // Production stages
        'scoping': 'bg-blue-100 text-blue-700',
        'field_capture': 'bg-cyan-100 text-cyan-700',
        'registration': 'bg-indigo-100 text-indigo-700',
        'bim_qc': 'bg-violet-100 text-violet-700',
        'pc_delivery': 'bg-amber-100 text-amber-700',
        'final_delivery': 'bg-green-100 text-green-700',
    };
    return map[status?.toLowerCase()] || 'bg-slate-100 text-slate-600';
}
