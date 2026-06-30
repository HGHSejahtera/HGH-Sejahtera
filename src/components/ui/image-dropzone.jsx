import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { UploadCloud, X, Loader2, Maximize } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export function ImageDropzone({ value, onChange, className }) {
    const { t } = useTranslation();
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setIsUploading(true);
        setError('');

        try {
            // 1. Compress the image client-side
            const options = {
                maxSizeMB: 1, // Compress to ~1MB or less
                maxWidthOrHeight: 1080,
                useWebWorker: true,
                fileType: 'image/webp'
            };
            
            let compressedFile = file;
            try {
                compressedFile = await imageCompression(file, options);
            } catch (compressErr) {
                console.warn("Compression failed, using original file", compressErr);
            }

            const fileExt = 'webp'; // Since we convert to webp
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

            // 2. Get Pre-signed URL from our Vercel Backend API
            const res = await fetch('/api/generate-r2-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName, fileType: 'image/webp' })
            });

            if (!res.ok) {
                throw new Error(t('errors.uploadFailedPresigned'));
            }

            const { url: presignedUrl, publicUrl } = await res.json();

            // 3. Upload directly to Cloudflare R2
            const uploadRes = await fetch(presignedUrl, {
                method: 'PUT',
                body: compressedFile,
                headers: {
                    'Content-Type': 'image/webp'
                }
            });

            if (!uploadRes.ok) {
                throw new Error(t('errors.uploadFailedR2'));
            }

            // 4. Update UI with the final public URL
            onChange(publicUrl);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || t('errors.uploadFailedGeneric'));
        } finally {
            setIsUploading(false);
        }
    }, [onChange, t]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/jpeg': [],
            'image/png': [],
            'image/webp': []
        },
        maxFiles: 1,
        maxSize: 5 * 1024 * 1024 // 5MB
    });

    if (value) {
        return (
            <>
                <div className="relative inline-block group">
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                        <img 
                            src={value} 
                            alt="Product" 
                            className="max-h-32 w-auto object-contain cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]" 
                            onClick={() => setIsPreviewOpen(true)}
                        />
                        <div 
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none group-hover:pointer-events-auto cursor-pointer"
                            onClick={() => setIsPreviewOpen(true)}
                        >
                            <Maximize className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); onChange(''); }}
                        className="absolute -top-2 -right-2 p-1.5 bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 rounded-full shadow-sm hover:shadow-md transition-all z-10"
                        title="Remove Image"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                {isPreviewOpen && (
                    <div 
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 sm:p-8 animate-in fade-in duration-200 cursor-pointer"
                        onClick={() => setIsPreviewOpen(false)}
                    >
                        <img 
                            src={value} 
                            alt="Preview" 
                            className="max-w-full max-h-full object-contain rounded-md shadow-2xl cursor-default" 
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button 
                            type="button"
                            className="absolute top-4 right-4 md:top-8 md:right-8 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-colors"
                            onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(false); }}
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="space-y-2 h-full">
            <div
                {...getRootProps()}
                className={cn(
                    "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all h-full min-h-[120px]",
                    isDragActive ? "border-indigo-500 bg-indigo-50/50" : "border-gray-200 bg-gray-50/50 hover:bg-gray-100/50 hover:border-gray-300",
                    className
                )}
            >
                <input {...getInputProps()} />
                {isUploading ? (
                    <div className="flex flex-col items-center text-indigo-600">
                        <Loader2 className="h-5 w-5 animate-spin mb-2" />
                        <span className="text-xs font-semibold">Uploading...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-gray-500">
                        <div className={cn("p-2 rounded-full mb-1.5", isDragActive ? "bg-indigo-100" : "bg-gray-100")}>
                            <UploadCloud className={cn("h-4 w-4", isDragActive ? "text-indigo-600" : "text-gray-500")} />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 text-center mb-0.5">
                            {isDragActive ? "Drop image here" : "Upload Image"}
                        </span>
                        <span className="text-xs font-medium text-gray-500 mb-1">Drag & Drop</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">JPG, PNG up to 5MB</span>
                    </div>
                )}
            </div>
            {error && <p className="text-xs text-red-500 font-medium text-center">{error}</p>}
        </div>
    );
}
