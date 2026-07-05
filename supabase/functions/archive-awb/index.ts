// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.370.0"
import { Upload } from "https://esm.sh/@aws-sdk/lib-storage@3.370.0"
import JSZip from "https://esm.sh/jszip@3.10.1"

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!
const R2_ACCESS_KEY = Deno.env.get("R2_ACCESS_KEY_ID")!
const R2_SECRET_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!
const R2_BUCKET = Deno.env.get("R2_BUCKET_NAME")!

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
    }
})

serve(async (req) => {
    try {
        const url = new URL(req.url)
        // Expected format: /archive-awb?period=2026-H1
        const period = url.searchParams.get("period") || "current"
        
        console.log(`Starting archive process for period: ${period}`)

        const zip = new JSZip()
        
        // Paginate through R2 bucket objects
        let isTruncated = true
        let continuationToken = undefined
        let fileCount = 0

        while (isTruncated) {
            const listCommand = new ListObjectsV2Command({
                Bucket: R2_BUCKET,
                Prefix: `Order Archive/`,
                ContinuationToken: continuationToken
            });
            
            const listResponse = await s3Client.send(listCommand);
            
            if (listResponse.Contents) {
                for (const object of listResponse.Contents) {
                    if (!object.Key?.endsWith('.pdf')) continue;
                    
                    // Filter based on period (e.g. 2026/01 to 2026/06)
                    // In a real implementation, add logic to check object.Key dates here
                    
                    const getCommand = new GetObjectCommand({
                        Bucket: R2_BUCKET,
                        Key: object.Key
                    })
                    const fileRes = await s3Client.send(getCommand)
                    
                    if (fileRes.Body) {
                        const chunks = []
                        for await (const chunk of fileRes.Body as any) {
                            chunks.push(chunk)
                        }
                        const u8 = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))
                        let offset = 0
                        for (const chunk of chunks) {
                            u8.set(chunk, offset)
                            offset += chunk.length
                        }
                        
                        // Add to zip (maintaining folder structure)
                        zip.file(object.Key, u8)
                        fileCount++
                    }
                }
            }
            
            isTruncated = listResponse.IsTruncated || false;
            continuationToken = listResponse.NextContinuationToken;
        }

        console.log(`Zipping ${fileCount} files...`)
        const zipStream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })

        const zipFileName = `Archives/AWB_Archive_${period}.zip`
        
        console.log(`Uploading zip to R2: ${zipFileName}`)
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: R2_BUCKET,
                Key: zipFileName,
                Body: zipStream
            }
        })
        
        await upload.done()

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Archive created: ${zipFileName} with ${fileCount} files.` 
        }), {
            headers: { "Content-Type": "application/json" },
        })

    } catch (error) {
        console.error("Archive failed:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
})
