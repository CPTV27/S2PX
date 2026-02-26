import { useState, useRef } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { uploadFile } from '@/services/api';
import { cn } from '@/lib/utils';

interface FileUploadProps {
    upid: string;
    fieldName: string;
    value?: string | string[];
    onChange: (url: string | string[]) => void;
    multiple?: boolean;
    accept?: string;
    label?: string;
}

export function FileUpload({ upid, fieldName, value, onChange, multiple = false, accept, label }: FileUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const urls = multiple
        ? (Array.isArray(value) ? value : value ? [value] : [])
        : (typeof value === 'string' && value ? [value] : []);

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        if (!upid) {
            setError('Save the form first to enable uploads');
            return;
        }

        setError(null);
        setUploading(true);

        try {
            const results = await Promise.all(
                Array.from(files).map(f => uploadFile(f, upid, fieldName))
            );
            const newUrls = results.map(r => r.url);

            if (multiple) {
                onChange([...urls, ...newUrls]);
            } else {
                onChange(newUrls[0]);
            }
        } catch (err: any) {
            setError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const removeUrl = (url: string) => {
        if (multiple) {
            onChange(urls.filter(u => u !== url));
        } else {
            onChange('');
        }
    };

    const getFilename = (url: string) => {
        const parts = url.split('/');
        return parts[parts.length - 1] || url;
    };

    return (
        <div className="space-y-2">
            {/* Uploaded files */}
            {urls.length > 0 && (
                <div className="space-y-1.5">
                    {urls.map((url) => (
                        <div key={url} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                            <FileText size={14} className="text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-600 truncate flex-1">{getFilename(url)}</span>
                            <button
                                type="button"
                                onClick={() => removeUrl(url)}
                                className="text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload button */}
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading || (!multiple && urls.length > 0)}
                className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed text-sm transition-colors w-full justify-center',
                    uploading
                        ? 'border-blue-300 bg-blue-50 text-blue-500 cursor-wait'
                        : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-500 hover:text-blue-600',
                    (!multiple && urls.length > 0) && 'hidden'
                )}
            >
                {uploading ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <Upload size={16} />
                        {label || (multiple ? 'Upload files' : 'Upload file')}
                    </>
                )}
            </button>

            <input
                ref={inputRef}
                type="file"
                multiple={multiple}
                accept={accept}
                onChange={e => handleFiles(e.target.files)}
                className="hidden"
            />

            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}
