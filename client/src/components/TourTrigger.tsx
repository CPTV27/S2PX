import { HelpCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useTour } from '@/hooks/useTour';

export function TourTrigger() {
    const { start, isActive, hasCompleted } = useTour();

    if (isActive) return null;

    // If user hasn't completed the tour yet, show a prominent pulsing CTA
    if (!hasCompleted) {
        return (
            <motion.button
                onClick={start}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.4 }}
                className="relative flex items-center justify-center lg:justify-start w-full px-3 py-2.5 text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors group"
                title="Take a guided tour"
            >
                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-lg animate-ping bg-blue-500/30 pointer-events-none" />
                <Sparkles size={18} className="min-w-[18px] relative z-10" />
                <span className="hidden lg:block ml-3 text-xs font-semibold uppercase tracking-wider relative z-10">
                    Start Tour
                </span>
            </motion.button>
        );
    }

    // After completion, show a subtle restart option
    return (
        <motion.button
            onClick={start}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center lg:justify-start w-full px-3 py-2.5 text-slate-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800/50"
            title="Take a guided tour"
        >
            <HelpCircle size={18} />
            <span className="hidden lg:block ml-3 text-xs font-mono uppercase tracking-wider">
                Tour
            </span>
        </motion.button>
    );
}
