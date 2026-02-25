import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Pipeline } from './pages/Pipeline';
import { QuoteBuilder } from './pages/QuoteBuilder';
import { Projects } from './pages/Projects';
import { Revenue } from './pages/Revenue';
import { Knowledge } from './pages/Knowledge';
import { PricingRules } from './pages/PricingRules';
import { Settings } from './pages/Settings';
import { NotebookCPQ } from './pages/NotebookCPQ';
import { StorageBrowser } from './pages/StorageBrowser';

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<DashboardLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="pipeline" element={<Pipeline />} />
                    <Route path="quotes" element={<QuoteBuilder />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="revenue" element={<Revenue />} />
                    <Route path="knowledge" element={<Knowledge />} />
                    <Route path="pricing-rules" element={<PricingRules />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="notebook-cpq" element={<NotebookCPQ />} />
                    <Route path="storage" element={<StorageBrowser />} />
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Router>
    );
}
