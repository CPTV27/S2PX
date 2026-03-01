// ── Scantech API Context ──
// Abstraction layer that lets ChecklistTab and UploadTab work through
// both authenticated (Firebase) and public (token-based) API paths.
// ScantechLayout provides the authenticated provider; ScantechPublicLayout
// provides the public provider. Tab components consume useScantechApi().

import { createContext, useContext, type ReactNode } from 'react';
import type {
    ChecklistTemplate,
    ChecklistSubmission,
    ChecklistResponse,
    FieldUploadRecord,
    FieldNote,
    FileCategory,
    CaptureMethod,
} from '@/services/api';

// ── API function shapes ──

export interface ScantechApiFunctions {
    fetchChecklists: () => Promise<ChecklistTemplate[]>;
    submitChecklist: (data: {
        checklistId: number;
        responses: ChecklistResponse[];
        status: 'in_progress' | 'complete' | 'flagged';
    }) => Promise<ChecklistSubmission>;
    getUploadSignedUrl: (data: {
        filename: string;
        contentType: string;
        sizeBytes: number;
        fileCategory: FileCategory;
        captureMethod: CaptureMethod;
    }) => Promise<{ signedUrl: string; gcsPath: string; bucket: string }>;
    confirmUpload: (data: {
        filename: string;
        gcsPath: string;
        bucket: string;
        sizeBytes: number;
        contentType: string;
        fileCategory: FileCategory;
        captureMethod: CaptureMethod;
        notes?: string;
        metadata?: Record<string, unknown>;
    }) => Promise<FieldUploadRecord>;
    saveNotes: (notes: FieldNote[]) => Promise<{ ok?: boolean; success?: boolean; noteCount?: number }>;
}

const ScantechApiCtx = createContext<ScantechApiFunctions | null>(null);

export function useScantechApi(): ScantechApiFunctions {
    const ctx = useContext(ScantechApiCtx);
    if (!ctx) throw new Error('useScantechApi must be used within a ScantechApiProvider');
    return ctx;
}

// ── Authenticated Provider (wraps existing request() functions) ──

import {
    fetchScantechChecklists,
    submitChecklistResponse,
    getFieldUploadSignedUrl,
    confirmFieldUpload,
    saveFieldNotes,
} from '@/services/api';

export function AuthenticatedScantechApiProvider({
    projectId,
    children,
}: {
    projectId: number;
    children: ReactNode;
}) {
    const api: ScantechApiFunctions = {
        fetchChecklists: fetchScantechChecklists,
        submitChecklist: (data) => submitChecklistResponse(projectId, data),
        getUploadSignedUrl: (data) => getFieldUploadSignedUrl(projectId, data),
        confirmUpload: (data) => confirmFieldUpload(projectId, data),
        saveNotes: (notes) => saveFieldNotes(projectId, notes) as any,
    };

    return <ScantechApiCtx.Provider value={api}>{children}</ScantechApiCtx.Provider>;
}

// ── Public Provider (wraps publicFetch() functions) ──

import {
    fetchPublicScantechChecklists,
    submitPublicChecklistResponse,
    getPublicUploadSignedUrl,
    confirmPublicUpload,
    savePublicFieldNotes,
} from '@/services/api';

export function PublicScantechApiProvider({
    token,
    children,
}: {
    token: string;
    children: ReactNode;
}) {
    const api: ScantechApiFunctions = {
        fetchChecklists: () => fetchPublicScantechChecklists(token),
        submitChecklist: (data) => submitPublicChecklistResponse(token, data),
        getUploadSignedUrl: (data) => getPublicUploadSignedUrl(token, data),
        confirmUpload: (data) => confirmPublicUpload(token, data),
        saveNotes: (notes) => savePublicFieldNotes(token, notes),
    };

    return <ScantechApiCtx.Provider value={api}>{children}</ScantechApiCtx.Provider>;
}
