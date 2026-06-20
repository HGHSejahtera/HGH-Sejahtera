import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

async function extractTextFromPDF(pdfPath) {
    try {
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdfDocument = await loadingTask.promise;
        const numPages = pdfDocument.numPages;
        console.log(`Total Pages: ${numPages}`);

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            const textItems = textContent.items.map(item => item.str);
            console.log(`\n--- Page ${pageNum} ---`);
            console.log(textItems.join(' | '));
        }
    } catch (error) {
        console.error('Error extracting text:', error);
    }
}

extractTextFromPDF('D:/Projects/Code/HGH/HGH/MemoryCore/Reference/TikTokSeller.pdf');
