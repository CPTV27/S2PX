import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { TourProvider } from './hooks/useTour';
import { RequireAuth } from './components/RequireAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardLayout } from './components/DashboardLayout';
import { PageLoader } from './components/PageLoader';

// ── Route-level code splitting ──
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Pipeline = lazy(() => import('./pages/Pipeline').then(m => ({ default: m.Pipeline })));
const Projects = lazy(() => import('./pages/Projects').then(m => ({ default: m.Projects })));
const Revenue = lazy(() => import('./pages/Revenue').then(m => ({ default: m.Revenue })));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase').then(m => ({ default: m.KnowledgeBase })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const StorageBrowser = lazy(() => import('./pages/StorageBrowser').then(m => ({ default: m.StorageBrowser })));
const ScopingList = lazy(() => import('./pages/ScopingList').then(m => ({ default: m.ScopingList })));
const ScopingForm = lazy(() => import('./pages/ScopingForm').then(m => ({ default: m.ScopingForm })));
const DealWorkspace = lazy(() => import('./pages/DealWorkspace').then(m => ({ default: m.DealWorkspace })));
const ProposalBuilder = lazy(() => import('./pages/ProposalBuilder').then(m => ({ default: m.ProposalBuilder })));
const ProductionPipeline = lazy(() => import('./pages/ProductionPipeline').then(m => ({ default: m.ProductionPipeline })));
const ProductionDetail = lazy(() => import('./pages/ProductionDetail').then(m => ({ default: m.ProductionDetail })));
const FieldCapture = lazy(() => import('./pages/FieldCapture').then(m => ({ default: m.FieldCapture })));
const Scorecard = lazy(() => import('./pages/Scorecard').then(m => ({ default: m.Scorecard })));
const ProposalTemplateSettings = lazy(() => import('./pages/ProposalTemplateSettings').then(m => ({ default: m.ProposalTemplateSettings })));
const UploadPortal = lazy(() => import('./pages/UploadPortal').then(m => ({ default: m.UploadPortal })));
const ScantechList = lazy(() => import('./pages/scantech/ScantechList').then(m => ({ default: m.ScantechList })));
const ScantechProject = lazy(() => import('./pages/scantech/ScantechProject').then(m => ({ default: m.ScantechProject })));
const OverviewTab = lazy(() => import('./components/scantech/OverviewTab').then(m => ({ default: m.OverviewTab })));
const ChecklistTab = lazy(() => import('./components/scantech/ChecklistTab').then(m => ({ default: m.ChecklistTab })));
const UploadTab = lazy(() => import('./components/scantech/UploadTab').then(m => ({ default: m.UploadTab })));
const ScopingTab = lazy(() => import('./components/scantech/ScopingTab').then(m => ({ default: m.ScopingTab })));
const NotesTab = lazy(() => import('./components/scantech/NotesTab').then(m => ({ default: m.NotesTab })));

export default function App() {
    return (
        <Router>
            <AuthProvider>
                <ErrorBoundary>
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            {/* Upload Portal — public, no auth required (token-validated) */}
                            <Route path="/upload/:token" element={<UploadPortal />} />
                            <Route
                                path="/dashboard"
                                element={
                                    <RequireAuth>
                                        <TourProvider>
                                            <DashboardLayout />
                                        </TourProvider>
                                    </RequireAuth>
                                }
                            >
                                <Route index element={<Dashboard />} />
                                <Route path="pipeline" element={<Pipeline />} />
                                <Route path="projects" element={<Projects />} />
                                <Route path="revenue" element={<Revenue />} />
                                <Route path="scorecard" element={<Scorecard />} />
                                <Route path="knowledge" element={<KnowledgeBase />} />
                                <Route path="settings" element={<Settings />} />
                                <Route path="settings/proposal-template" element={<ProposalTemplateSettings />} />
                                <Route path="storage" element={<StorageBrowser />} />
                                <Route path="scoping" element={<ScopingList />} />
                                <Route path="scoping/new" element={<ScopingForm />} />
                                <Route path="scoping/:id" element={<ScopingForm />} />
                                <Route path="deals/:id" element={<DealWorkspace />} />
                                <Route path="proposals/:id" element={<ProposalBuilder />} />
                                <Route path="production" element={<ProductionPipeline />} />
                                <Route path="production/:id" element={<ProductionDetail />} />
                            </Route>
                            {/* Scantech — mobile field operations hub (no sidebar) */}
                            <Route
                                path="/scantech"
                                element={
                                    <RequireAuth>
                                        <ScantechList />
                                    </RequireAuth>
                                }
                            />
                            <Route
                                path="/scantech/:projectId"
                                element={
                                    <RequireAuth>
                                        <ScantechProject />
                                    </RequireAuth>
                                }
                            >
                                <Route index element={<Navigate to="overview" replace />} />
                                <Route path="overview" element={<OverviewTab />} />
                                <Route path="checklist" element={<ChecklistTab />} />
                                <Route path="upload" element={<UploadTab />} />
                                <Route path="scoping" element={<ScopingTab />} />
                                <Route path="notes" element={<NotesTab />} />
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
                    </Suspense>
                </ErrorBoundary>
            </AuthProvider>
        </Router>
    );
}
