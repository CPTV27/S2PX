// ── Pricing Variables Settings Page ──
// Sub-page of Settings for CEO/Admin to edit pricing config.
// Pattern matches ProposalTemplateSettings.tsx

import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, DollarSign, Loader2 } from 'lucide-react';

const PricingVariables = lazy(() =>
    import('@/components/settings/PricingVariables').then(m => ({ default: m.PricingVariables }))
);

export function PricingVariablesSettings() {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/dashboard/settings')}
                    className="p-2 rounded-lg hover:bg-s2p-secondary transition-colors"
                >
                    <ArrowLeft size={20} className="text-s2p-muted" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-green-50 text-green-600">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-s2p-fg">Pricing Variables</h2>
                        <p className="text-s2p-muted text-sm mt-0.5">
                            Adjust base rates, margins, travel costs, risk premiums, and other pricing constants.
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-s2p-border rounded-2xl p-8"
            >
                <Suspense
                    fallback={
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-s2p-muted" />
                        </div>
                    }
                >
                    <PricingVariables />
                </Suspense>
            </motion.div>
        </div>
    );
}
