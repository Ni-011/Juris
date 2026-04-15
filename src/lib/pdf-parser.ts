import PDFParser from "pdf2json";
import * as fs from "fs";

export async function parsePDF(base64: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const pdfParser = new (PDFParser as any)(null, 1);
        const buffer = Buffer.from(base64, 'base64');

        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            const rawText = (pdfParser as any).getRawTextContent();
            resolve(rawText);
        });

        pdfParser.parseBuffer(buffer);
    });
}
