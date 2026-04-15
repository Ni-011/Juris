import * as fs from 'fs';
import * as path from 'path';
import { Pinecone } from '@pinecone-database/pinecone';

require('dotenv').config();

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.Index('juris'); // Name is juris as retrieved previously

async function main() {
    const docsDir = path.join(process.cwd(), 'Docs');

    // Test just one chunk of Constitution
    const filePath = path.join(docsDir, 'segmented_Constitution.json');
    const segments = JSON.parse(fs.readFileSync(filePath, 'utf8')).slice(0, 2);

    const chunk = segments;
    const inputs = chunk.map((seg: any) => `${seg.act} ${seg.type} ${seg.number}: ${seg.title}\n${seg.content}`);

    const embedResult = await pc.inference.embed({
        model: 'llama-text-embed-v2',
        inputs: inputs,
        parameters: { inputType: 'passage', truncate: 'END' }
    });

    const vectors = chunk.map((seg: any, index: number) => ({
        id: `${seg.act}_${seg.number}`,
        values: (embedResult.data[index] as any).values,
        metadata: {
            act: seg.act,
            type: seg.type,
            number: seg.number,
            title: seg.title || '',
            text: seg.content || ''
        }
    }));

    console.log("Vector 0 looks like:", JSON.stringify({ ...vectors[0], values: "[Array of " + vectors[0].values.length + " floats]" }));

    // Try Upsert
    try {
        await index.upsert(vectors);
        console.log("Upsert succeeded!");
    } catch (e: any) {
        console.error("Upsert failed:", e);
    }
}

main().catch(console.error);
