import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { RequireAuth } from './components/RequireAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardLayout } from './components/DashboardLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Pipeline } from './pages/Pipeline';
import { QuoteBuilder } from './pages/QuoteBuilder';
import { Projects } from './pages/Projects';
import { Revenue } from './pages/Revenue';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { PricingRules } from './pages/PricingRules';
import { Settings } from './pages/Settings';
import { NotebookCPQ } from './pages/NotebookCPQ';
import { StorageBrowser } from './pages/StorageBrowser';
import { ScopingList } from './pages/ScopingList';
import { ScopingForm } from './pages/ScopingForm';
import { DealWorkspace } from './pages/DealWorkspace';
import { ProposalBuilder } from './pages/ProposalBuilder';
import { ProductionPipeline } from './pages/ProductionPipeline';
import { ProductionDetail } from './pages/ProductionDetail';
import { FieldCapture } from './pages/FieldCapture';
import { Scorecard } from './pages/Scorecard';

export default function App() {
    return (
        <Router>
            <AuthProvider>
                <ErrorBoundary>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/dashboard"
                            element={
                                <RequireAuth>
                                    <DashboardLayout />
                                </RequireAuth>
                            }
                        >
                            <Route index element={<Dashboard />} />
                            <Route path="pipeline" element={<Pipeline />} />
                            <Route path="quotes" element={<QuoteBuilder />} />
                            <Route path="projects" element={<Projects />} />
                            <Route path="revenue" element={<Revenue />} />
                            <Route path="scorecard" element={<Scorecard />} />
                            <Route path="knowledge" element={<KnowledgeBase />} />
                            <Route path="pricing-rules" element={<PricingRules />} />
                            <Route path="settings" element={<Settings />} />
                            <Route path="notebook-cpq" element={<NotebookCPQ />} />
                            <Route path="storage" element={<StorageBrowser />} />
                            <Route path="scoping" element={<ScopingList />} />
                            <Route path="scoping/new" element={<ScopingForm />} />
                            <Route path="scoping/:id" element={<ScopingForm />} />
                            <Route path="deals/:id" element={<DealWorkspace />} />
                            <Route path="proposals/:id" element={<ProposalBuilder />} />
                            <Route path="production" element={<ProductionPipeline />} />
                            <Route path="production/:id" element={<ProductionDetail />} />
                        </Route>
                        {/* Field App — full-width, no sidebar (mobile-first for scan techs) */}
                        <Route
                            path="/field/:projectId"
                            element={
                                <RequireAuth>
                                    <FieldCapture />
                                </RequireAuth>
                            }
                        />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </ErrorBoundary>
            </AuthProvider>
        </Router>
    );
}
