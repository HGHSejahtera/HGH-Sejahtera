import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { UploadCloud, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ImageDropzone({ value, onChange, className }) {
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

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
                throw new Error('Gagal mendapatkan kebenaran upload (Pre-signed URL gagal)');
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
                throw new Error('Gagal upload gambar ke Cloudflare R2');
            }

            // 4. Update UI with the final public URL
            onChange(publicUrl);
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload image.');
        } finally {
            setIsUploading(false);
        }
    }, [onChange]);

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
            <div className={cn("relative rounded-xl overflow-hidden border border-gray-200 bg-white group aspect-square flex items-center justify-center", className)}>
                <img src={value} alt="Product" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChange(''); }}
                        className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md transform hover:scale-105 transition-transform"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
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
