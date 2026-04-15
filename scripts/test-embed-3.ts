import { Pinecone } from '@pinecone-database/pinecone';
require('dotenv').config();
async function test() {
    const pc = new Pinecone();
    try {
        const result = await pc.inference.embed({
            model: 'llama-text-embed-v2',
            inputs: ['hello world'],
            parameters: { inputType: 'passage', truncate: 'END' }
        });
        console.log("Success with object:", result);
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}
test().catch(console.error);
