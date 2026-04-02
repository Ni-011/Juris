import * as fs from 'fs';
import * as path from 'path';
import { Pinecone } from '@pinecone-database/pinecone';

require('dotenv').config();

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.Index('juris'); // Name is juris as retrieved previously

async function main() {
    const docsDir = path.join(process.cwd(), 'Docs');

    const files = [
        'segmented_Constitution.json',
        'segmented_BNS.json',
        'segmented_BNSS.json',
        'segmented_BSA.json'
    ];

    for (const file of files) {
        const filePath = path.join(docsDir, file);
        if (!fs.existsSync(filePath)) continue;

        console.log(`Processing ${file}...`);
        const segments = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        let batch = [];
        // Process in chunks of 50
        const chunkSize = 50;
        for (let i = 0; i < segments.length; i += chunkSize) {
            const chunk = segments.slice(i, i + chunkSize);
            const inputs = chunk.map((seg: any) => `${seg.act} ${seg.type} ${seg.number}: ${seg.title}\n${seg.content}`);

            try {
                // Generate embeddings in batch
                const embedResult = await pc.inference.embed({
                    model: 'llama-text-embed-v2',
                    inputs: inputs,
                    parameters: { inputType: 'passage', truncate: 'END' }
                });

                const vectors = chunk.map((seg: any, index: number) => ({
                    id: `${seg.act}_${seg.number}`,
                    values: embedResult.data[index].values,
                    metadata: {
                        act: seg.act,
                        type: seg.type,
                        number: seg.number,
                        title: seg.title || '',
                        text: seg.content || '' // The integrated index may auto-embed if we don't supply values, but we supplied values.
                    }
                }));

                await index.upsert(vectors);
                console.log(`Upserted batch of ${vectors.length} records. (${i + vectors.length}/${segments.length})`);
            } catch (err) {
                console.error(`Failed to upscale batch at index ${i}`, err.message);
            }
        }
    }
    console.log("Indexing complete!");
}

main().catch(console.error);
