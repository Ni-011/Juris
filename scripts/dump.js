const fs = require('fs');
const PDFParser = require('pdf2json');
const path = require('path');

const pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync(path.join(process.cwd(), 'Docs', 'bns_raw.txt'), pdfParser.getRawTextContent());
    console.log("Extracted text successfully!");
});

const filePath = path.join(process.cwd(), 'Docs', 'Bharatiya_Nyaya_Sanhita,_2023.pdf');
pdfParser.loadPDF(filePath);
