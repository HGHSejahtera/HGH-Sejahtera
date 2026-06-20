import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

async function extractTextFromPDF(pdfPath) {
    try {
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDocument = await loadingTask.promise;
        const numPages = pdfDocument.numPages;

        for (let pageNum = 1; pageNum <= 1; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            console.log(`\n--- Page ${pageNum} Items ---`);
            textContent.items.forEach(item => {
                if (item.str.trim()) {
                    console.log(`Y: ${Math.round(item.transform[5])}, X: ${Math.round(item.transform[4])} | Text: ${item.str}`);
                }
            });
        }
    } catch (error) {
        console.error('Error extracting text:', error);
    }
}

extractTextFromPDF('D:/Projects/Code/HGH/HGH/MemoryCore/Reference/TikTokSeller.pdf');
