import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

// Ensure the API key is present
if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY in environment variables.");
    process.exit(1);
}

const ai = new GoogleGenAI({});

async function main() {
    try {
        console.log('Creating FileSearchStore...');
        const store = await ai.fileSearchStores.create({
            config: {
                displayName: 'Juris Legal Docs'
            }
        });

        console.log(`Created store successfully: ${store.name}`);

        const docsDir = path.join(process.cwd(), 'Docs');
        const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'));

        for (const file of files) {
            const filePath = path.join(docsDir, file);
            console.log(`Uploading ${file} to store...`);

            // Note: UploadToFileSearchStoreConfig might be passed in differently, but we use the signature from the typings.
            await ai.fileSearchStores.uploadToFileSearchStore({
                fileSearchStoreName: store.name!,
                file: filePath,
                config: {
                    displayName: file,
                }
            });
            console.log(`Successfully queued ${file} for indexing.`);
        }

        // Save the store name
        const outDir = path.join(process.cwd(), 'src', 'utils');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        const outPath = path.join(outDir, 'gemini-docs.json');

        fs.writeFileSync(outPath, JSON.stringify({ fileSearchStoreName: store.name }, null, 2));

        console.log(`Done! Store name saved to ${outPath}`);
    } catch (error) {
        console.error('Failed to create store and upload docs:', error);
    }
}

main();
