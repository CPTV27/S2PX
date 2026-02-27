// ── Scantech Project Hub ──
// Wraps ScantechLayout which provides bottom nav + project context.
// Child tabs render via <Outlet> inside the layout.

import { ScantechLayout } from '@/components/scantech/ScantechLayout';

export function ScantechProject() {
    return <ScantechLayout />;
}
