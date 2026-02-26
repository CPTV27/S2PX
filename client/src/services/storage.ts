// ── Cloud Storage Service ──
// File operations across multiple GCS buckets (s2p-active, s2p-cold, s2p-share)

import {
    ref,
    listAll,
    list,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    getMetadata,
    type StorageReference,
} from 'firebase/storage';
import { getStorageBucket } from './firebase';
import type { StorageFile } from '@/types';

// Bucket names — real GCS bucket names in s2p-migration project
export const BUCKETS = {
    active: 's2p-active-projects',
    incoming: 's2p-incoming-staging',
    quarantine: 's2p-quarantine',
} as const;

export type BucketKey = keyof typeof BUCKETS;

function getBucketRef(bucket: string, path: string): StorageReference {
    const storage = getStorageBucket(bucket);
    return ref(storage, path);
}

// ── List Files ──

export async function listFiles(
    bucket: string,
    path: string = ''
): Promise<StorageFile[]> {
    const storageRef = getBucketRef(bucket, path);
    const result = await listAll(storageRef);

    const folders: StorageFile[] = result.prefixes.map((prefix) => ({
        name: prefix.name,
        fullPath: prefix.fullPath,
        bucket,
        size: 0,
        contentType: 'folder',
        updated: '',
        isFolder: true,
    }));

    const files: StorageFile[] = await Promise.all(
        result.items.map(async (item) => {
            try {
                const meta = await getMetadata(item);
                return {
                    name: item.name,
                    fullPath: item.fullPath,
                    bucket,
                    size: meta.size,
                    contentType: meta.contentType ?? 'application/octet-stream',
                    updated: meta.updated,
                    isFolder: false,
                };
            } catch {
                return {
                    name: item.name,
                    fullPath: item.fullPath,
                    bucket,
                    size: 0,
                    contentType: 'unknown',
                    updated: '',
                    isFolder: false,
                };
            }
        })
    );

    return [...folders, ...files];
}

// ── Paginated List ──

export async function listFilesPaginated(
    bucket: string,
    path: string = '',
    maxResults: number = 50,
    pageToken?: string
) {
    const storageRef = getBucketRef(bucket, path);
    const result = await list(storageRef, {
        maxResults,
        pageToken,
    });

    const files: StorageFile[] = await Promise.all(
        result.items.map(async (item) => {
            try {
                const meta = await getMetadata(item);
                return {
                    name: item.name,
                    fullPath: item.fullPath,
                    bucket,
                    size: meta.size,
                    contentType: meta.contentType ?? 'application/octet-stream',
                    updated: meta.updated,
                    isFolder: false,
                };
            } catch {
                return {
                    name: item.name,
                    fullPath: item.fullPath,
                    bucket,
                    size: 0,
                    contentType: 'unknown',
                    updated: '',
                    isFolder: false,
                };
            }
        })
    );

    const folders: StorageFile[] = result.prefixes.map((prefix) => ({
        name: prefix.name,
        fullPath: prefix.fullPath,
        bucket,
        size: 0,
        contentType: 'folder',
        updated: '',
        isFolder: true,
    }));

    return {
        files: [...folders, ...files],
        nextPageToken: result.nextPageToken,
    };
}

// ── Upload ──

export async function uploadFile(
    bucket: string,
    path: string,
    file: File
): Promise<string> {
    const storageRef = getBucketRef(bucket, path);
    await uploadBytes(storageRef, file, {
        contentType: file.type,
    });
    return getDownloadURL(storageRef);
}

// ── Download URL ──

export async function getFileDownloadUrl(
    bucket: string,
    path: string
): Promise<string> {
    const storageRef = getBucketRef(bucket, path);
    return getDownloadURL(storageRef);
}

// ── Delete ──

export async function deleteFile(
    bucket: string,
    path: string
): Promise<void> {
    const storageRef = getBucketRef(bucket, path);
    await deleteObject(storageRef);
}

// ── Metadata ──

export async function getFileMetadata(
    bucket: string,
    path: string
): Promise<StorageFile> {
    const storageRef = getBucketRef(bucket, path);
    const meta = await getMetadata(storageRef);
    return {
        name: meta.name,
        fullPath: meta.fullPath,
        bucket,
        size: meta.size,
        contentType: meta.contentType ?? 'application/octet-stream',
        updated: meta.updated,
        isFolder: false,
    };
}

// ── Health Check ──

export async function checkStorageConnection(bucket: string): Promise<boolean> {
    try {
        const storageRef = getBucketRef(bucket, '');
        await list(storageRef, { maxResults: 1 });
        return true;
    } catch {
        return false;
    }
}
