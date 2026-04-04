import * as fs from 'fs';
import * as path from 'path';
import { Pinecone } from '@pinecone-database/pinecone';

require('dotenv').config();

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY as string }); // already has as string, but let's be consistent if it failed before
const indexHost = process.env.PINECONE?.replace('https://', '') || 'juris-puen1s1.svc.aped-4627-b74a.pinecone.io';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

        const chunkSize = 40;
        for (let i = 0; i < segments.length; i += chunkSize) {
            const chunk = segments.slice(i, i + chunkSize);
            const inputs = chunk.map((seg: any) => `${seg.act} ${seg.type} ${seg.number}: ${seg.title}\n${seg.content}`);

            try {
                // Rate limiting delay
                await sleep(1000);

                // Generate embeddings in batch
                const embedResult = await pc.inference.embed({
                    model: 'llama-text-embed-v2',
                    inputs: inputs,
                    parameters: { inputType: 'passage', truncate: 'END' }
                });

                const vectors = chunk.map((seg: any, index: number) => {
                    const saneId = `${seg.act}_${seg.number}`.replace(/[^a-zA-Z0-9_\-]/g, '_');

                    // Metadata size limit fix: truncate if > 30k chars
                    const cleanText = (seg.content || '').length > 30000
                        ? seg.content.substring(0, 30000) + '... [TRUNCATED]'
                        : seg.content;

                    return {
                        id: saneId,
                        values: (embedResult.data[index] as any).values,
                        metadata: {
                            act: seg.act,
                            type: seg.type,
                            number: seg.number,
                            title: seg.title || '',
                            text: cleanText || ''
                        }
                    };
                });

                // Upsert via REST POST
                const response = await fetch(`https://${indexHost}/vectors/upsert`, {
                    method: 'POST',
                    headers: {
                        'Api-Key': process.env.PINECONE_API_KEY as string,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ vectors })
                });

                if (response.ok) {
                    console.log(`Upserted batch of ${vectors.length} records. (${i + vectors.length}/${segments.length})`);
                } else {
                    const resData = await response.json();
                    console.error(`REST Error at index ${i}:`, JSON.stringify(resData));
                }

            } catch (err: any) {
                console.error(`Failed at batch index ${i}:`, err.message);
                if (err.message.includes('429')) {
                    console.log("Rate limited. Sleeping for 5s...");
                    await sleep(5000);
                    i -= chunkSize; // retry
                }
            }
        }
    }
    console.log("Indexing complete!");
}

main().catch(console.error);
