import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { useTour } from '@/hooks/useTour';

interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

const PAD = 8;
const GAP = 12;
const TIP_W = 320;
const MAX_RETRIES = 20;

export function TourOverlay() {
    const { isActive, step, currentStep, totalSteps, next, prev, skip } = useTour();
    const [rect, setRect] = useState<TargetRect | null>(null);
    const [ready, setReady] = useState(false);
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const retryCount = useRef(0);

    // ── Measure target element ──
    const measureTarget = useCallback(() => {
        if (!step) return;

        const el = document.querySelector(step.target);
        if (!el) {
            retryCount.current++;
            if (retryCount.current < MAX_RETRIES) {
                retryRef.current = setTimeout(measureTarget, 100);
            } else {
                // Fallback: show tooltip centered without spotlight
                setRect(null);
                setReady(true);
            }
            return;
        }

        const r = el.getBoundingClientRect();
        setRect({
            top: r.top - PAD,
            left: r.left - PAD,
            width: r.width + PAD * 2,
            height: r.height + PAD * 2,
        });
        setReady(true);
    }, [step]);

    // Re-measure on step change
    useEffect(() => {
        setReady(false);
        setRect(null);
        retryCount.current = 0;
        if (!step) return;

        const delay = step.delay ?? 200;
        const timer = setTimeout(measureTarget, delay);
        return () => {
            clearTimeout(timer);
            if (retryRef.current) clearTimeout(retryRef.current);
        };
    }, [step, measureTarget]);

    // Re-measure on resize / scroll (debounced to avoid layout thrashing)
    useEffect(() => {
        if (!isActive) return;
        let rafId: number | null = null;
        const handler = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(measureTarget);
        };
        window.addEventListener('resize', handler);
        window.addEventListener('scroll', handler, true);
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.removeEventListener('resize', handler);
            window.removeEventListener('scroll', handler, true);
        };
    }, [isActive, measureTarget]);

    // Keyboard navigation
    useEffect(() => {
        if (!isActive) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') skip();
            if (e.key === 'ArrowRight' || e.key === 'Enter') next();
            if (e.key === 'ArrowLeft') prev();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isActive, next, prev, skip]);

    if (!isActive || !step) return null;

    // ── Tooltip position ──
    const getTooltipStyle = (): CSSProperties => {
        if (!rect) {
            // Center fallback
            return {
                width: TIP_W,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            };
        }

        const style: CSSProperties = { width: TIP_W };
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        switch (step.position) {
            case 'right':
                style.top = rect.top;
                style.left = rect.left + rect.width + GAP;
                break;
            case 'left':
                style.top = rect.top;
                style.left = rect.left - TIP_W - GAP;
                break;
            case 'bottom':
                style.top = rect.top + rect.height + GAP;
                style.left = rect.left;
                break;
            case 'top':
                style.top = rect.top - GAP;
                style.left = rect.left;
                style.transform = 'translateY(-100%)';
                break;
        }

        // Viewport clamping
        if (typeof style.left === 'number') {
            style.left = Math.max(16, Math.min(style.left, vw - TIP_W - 16));
        }
        if (typeof style.top === 'number') {
            style.top = Math.max(16, Math.min(style.top, vh - 260));
        }

        return style;
    };

    const progress = ((currentStep + 1) / totalSteps) * 100;

    return (
        <div className="fixed inset-0 z-[9998]" aria-live="polite">
            {/* Backdrop with spotlight cutout */}
            <AnimatePresence mode="wait">
                {ready && (
                    <motion.div
                        key={`bg-${step.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/60"
                        style={rect ? {
                            clipPath: `polygon(
                                0% 0%, 0% 100%,
                                ${rect.left}px 100%,
                                ${rect.left}px ${rect.top}px,
                                ${rect.left + rect.width}px ${rect.top}px,
                                ${rect.left + rect.width}px ${rect.top + rect.height}px,
                                ${rect.left}px ${rect.top + rect.height}px,
                                ${rect.left}px 100%,
                                100% 100%, 100% 0%
                            )`,
                        } : undefined}
                        onClick={skip}
                    />
                )}
            </AnimatePresence>

            {/* Spotlight ring */}
            {rect && ready && (
                <motion.div
                    key={`ring-${step.id}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="absolute rounded-xl border-2 border-blue-400/60 shadow-[0_0_0_4px_rgba(59,130,246,0.15)] pointer-events-none"
                    style={{
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                    }}
                />
            )}

            {/* Tooltip */}
            <AnimatePresence mode="wait">
                {ready && (
                    <motion.div
                        key={`tip-${step.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2, delay: 0.05 }}
                        className="absolute bg-white rounded-2xl shadow-2xl border border-slate-200 p-5"
                        style={getTooltipStyle()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5">
                                <Sparkles size={12} className="text-blue-500" />
                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                                    {currentStep + 1} / {totalSteps}
                                </span>
                            </div>
                            <button
                                onClick={skip}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Content */}
                        <h3 className="text-base font-semibold text-slate-800 mb-1.5">
                            {step.title}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed mb-4">
                            {step.description}
                        </p>

                        {/* Progress bar */}
                        <div className="w-full h-1 bg-slate-100 rounded-full mb-4 overflow-hidden">
                            <motion.div
                                className="h-full bg-blue-500 rounded-full"
                                initial={false}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                            />
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={skip}
                                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Skip tour
                            </button>
                            <div className="flex gap-2">
                                {currentStep > 0 && (
                                    <button
                                        onClick={prev}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                                    >
                                        <ChevronLeft size={14} />
                                        Back
                                    </button>
                                )}
                                <button
                                    onClick={next}
                                    className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
                                    {currentStep < totalSteps - 1 && <ChevronRight size={14} />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
