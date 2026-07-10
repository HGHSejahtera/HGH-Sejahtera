import { supabase } from '@/lib/supabase';

/**
 * Fetches pending AWB uploads from the server (iOS Shortcut uploads),
 * downloads the files, marks them as processed, and returns them as File objects.
 * 
 * @param {string} userId The Supabase auth user ID
 * @returns {Promise<File[]>} Array of File objects ready for parsing
 */
export async function fetchPendingServerUploads(userId) {
    if (!userId) return [];

    try {
        // 1. Get list of pending uploads from DB
        const { data: uploads, error: listError } = await supabase.rpc('get_pending_uploads', { p_user_id: userId });
        
        if (listError) {
            console.error('Failed to get pending uploads:', listError);
            return [];
        }

        if (!uploads || uploads.length === 0) {
            return [];
        }

        const downloadedFiles = [];

        // 2. Download and process each upload
        for (const upload of uploads) {
            try {
                // Download from storage
                const { data: blob, error: downloadError } = await supabase.storage
                    .from('pending-awb')
                    .download(upload.FilePath);

                if (downloadError) {
                    console.error(`Failed to download ${upload.FileName}:`, downloadError);
                    continue; // Skip and don't mark as processed
                }

                // Convert Blob to File object
                const file = new File([blob], upload.FileName, { type: 'application/pdf' });
                downloadedFiles.push(file);

                // Mark as processed in DB
                await supabase.rpc('mark_upload_processed', { p_upload_id: upload.id });

            } catch (err) {
                console.error(`Error processing pending upload ${upload.id}:`, err);
            }
        }

        return downloadedFiles;
    } catch (err) {
        console.error('Error in fetchPendingServerUploads:', err);
        return [];
    }
}
