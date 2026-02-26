// ── Firestore Service ──
// CRUD operations for wiki_pages and generic collections

import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { WikiPage } from '@/types';

// ── Wiki Pages ──

export async function fetchWikiPages(): Promise<WikiPage[]> {
    const q = query(collection(db, 'wiki_pages'), orderBy('title'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    })) as WikiPage[];
}

export async function fetchWikiPage(id: string): Promise<WikiPage | null> {
    const snap = await getDoc(doc(db, 'wiki_pages', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as WikiPage;
}

export async function saveWikiPage(id: string, data: Omit<WikiPage, 'id'>): Promise<void> {
    await setDoc(doc(db, 'wiki_pages', id), {
        ...data,
        updatedAt: new Date().toISOString(),
    });
}

export async function deleteWikiPage(id: string): Promise<void> {
    await deleteDoc(doc(db, 'wiki_pages', id));
}

export function subscribeToWikiPages(
    callback: (pages: WikiPage[]) => void
): Unsubscribe {
    const q = query(collection(db, 'wiki_pages'), orderBy('title'));
    return onSnapshot(q, (snapshot) => {
        const pages = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        })) as WikiPage[];
        callback(pages);
    });
}

// ── Generic Collection Reader ──

export async function fetchCollection<T = Record<string, unknown>>(
    name: string
): Promise<(T & { id: string })[]> {
    const snapshot = await getDocs(collection(db, name));
    return snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as T),
    }));
}

// ── Health Check ──

export async function checkFirestoreConnection(): Promise<boolean> {
    try {
        await getDocs(query(collection(db, 'wiki_pages')));
        return true;
    } catch {
        return false;
    }
}
