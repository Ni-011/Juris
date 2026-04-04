import * as fs from 'fs';
import * as path from 'path';
import PDFParser from 'pdf2json';

async function extractText(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        // cast to any to bypass TS error
        const pdfParser = new (PDFParser as any)(null, 1);
        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", () => {
            resolve(pdfParser.getRawTextContent());
        });
        pdfParser.loadPDF(filePath);
    });
}

function cleanText(text: string): string {
    let t = text.replace(/----------------Page \(\d+\) Break----------------/g, '\n');
    t = t.replace(/\r\n/g, '\n');
    return t;
}

function segmentConstitution(text: string) {
    // Attempt to skip TOC by finding "PART I" or "1. Name and territory"
    const startIndex = text.indexOf('1. Name and territory of the Union');
    if (startIndex > -1) {
        text = text.substring(startIndex);
    }

    const regex = /\n\s*(\d+[A-Z]?)\.\s+([^\n]+)/g;
    let match;
    const articles = [];
    let lastIndex = 0;
    let lastArticle: string | null = null;
    let lastTitle: string | null = null;

    while ((match = regex.exec(text)) !== null) {
        if (lastArticle) {
            articles.push({
                act: 'Constitution',
                type: 'Article',
                number: lastArticle,
                title: lastTitle!.trim(),
                content: text.substring(lastIndex, match.index).trim()
            });
        }
        lastArticle = match[1];
        lastTitle = match[2];
        lastIndex = match.index;
    }
    if (lastArticle) {
        articles.push({
            act: 'Constitution',
            type: 'Article',
            number: lastArticle,
            title: lastTitle!.trim(),
            content: text.substring(lastIndex).trim()
        });
    }
    // Filter out falsely matched articles (like 1. Subs by...) by checking content length and formatting or if number is too large
    return articles.filter(a => parseInt(a.number) > 0 && parseInt(a.number) < 500);
}

function segmentBNS(text: string, actName: string) {
    // Skip TOC by finding enactment string or "CHAPTER I"
    let startIndex = text.lastIndexOf('CHAPTER I');
    if (startIndex === -1) startIndex = 0;
    text = text.substring(startIndex);

    // BNS sections usually begin like "1. (1) This Act" or "2. Definitions"
    const regex = /\n\s*(\d+[A-Z]?)\.\s+([^\n]+)/g;
    let match;
    const sections = [];
    let lastIndex = 0;
    let lastArticle: string | null = null;
    let lastTitle: string | null = null;

    while ((match = regex.exec(text)) !== null) {
        if (lastArticle) {
            sections.push({
                act: actName,
                type: 'Section',
                number: lastArticle,
                title: lastTitle!.trim(),
                content: text.substring(lastIndex, match.index).trim()
            });
        }
        lastArticle = match[1];
        lastTitle = match[2];
        lastIndex = match.index;
    }
    if (lastArticle) {
        sections.push({
            act: actName,
            type: 'Section',
            number: lastArticle,
            title: lastTitle!.trim(),
            content: text.substring(lastIndex).trim()
        });
    }
    return sections.filter(a => parseInt(a.number) > 0 && parseInt(a.number) < 600);
}

async function main() {
    const docsDir = path.join(process.cwd(), 'Docs');

    console.log("Extracting and segmenting Constitution...");
    const constText = await extractText(path.join(docsDir, 'constituition.pdf'));
    const constArticles = segmentConstitution(cleanText(constText));
    fs.writeFileSync(path.join(docsDir, 'segmented_Constitution.json'), JSON.stringify(constArticles, null, 2));
    console.log(`Saved ${constArticles.length} Constitution articles.`);

    const acts = [
        { file: 'Bharatiya_Nyaya_Sanhita,_2023.pdf', name: 'BNS' },
        { file: 'Bharatiya_Nagarik_Suraksha_Sanhita,_2023.pdf', name: 'BNSS' },
        { file: 'BSA.pdf', name: 'BSA' }
    ];

    for (const act of acts) {
        console.log(`Extracting and segmenting ${act.name}...`);
        try {
            const actText = await extractText(path.join(docsDir, act.file));
            const actSections = segmentBNS(cleanText(actText), act.name);
            fs.writeFileSync(path.join(docsDir, `segmented_${act.name}.json`), JSON.stringify(actSections, null, 2));
            console.log(`Saved ${actSections.length} ${act.name} sections.`);
        } catch (e: any) {
            console.error(`Error processing ${act.name}:`, e);
        }
    }
}

main().catch(console.error);
