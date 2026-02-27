import { Loader2 } from 'lucide-react';

export function PageLoader() {
    return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-s2p-primary" size={32} />
        </div>
    );
}
