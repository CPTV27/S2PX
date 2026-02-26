import { cn } from '@/lib/utils';

interface FormFieldProps {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: React.ReactNode;
    className?: string;
}

export function FormField({ label, required, error, hint, children, className }: FormFieldProps) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <label className="block text-sm font-medium text-slate-700">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {hint && !error && (
                <p className="text-xs text-slate-400">{hint}</p>
            )}
            {error && (
                <p className="text-xs text-red-500">{error}</p>
            )}
        </div>
    );
}

// Shared input styles
export const inputStyles = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500';
export const selectStyles = inputStyles;
export const textareaStyles = cn(inputStyles, 'min-h-[80px] resize-y');
