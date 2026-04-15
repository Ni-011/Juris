import * as fs from 'fs';
import * as path from 'path';
const pdfParse = require('pdf-parse');

async function dumpFirstPages() {
    const filePath = path.join(process.cwd(), 'Docs', 'constituition.pdf');
    const buffer = fs.readFileSync(filePath);

    const options = {
        max: 10, // only the first 10 pages to avoid dumping megabytes
    };

    const data = await pdfParse(buffer, options);
    console.log(data.text.substring(0, 5000));
}

dumpFirstPages().catch(console.error);
