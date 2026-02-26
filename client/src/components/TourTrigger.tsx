import { HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useTour } from '@/hooks/useTour';

export function TourTrigger() {
    const { start, isActive } = useTour();

    if (isActive) return null;

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
