import { Pinecone } from '@pinecone-database/pinecone';
require('dotenv').config();
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
async function test() {
    const result = await pc.inference.embed({
        model: 'llama-text-embed-v2',
        inputs: ['hello world'],
        parameters: { inputType: 'passage', truncate: 'END' }
    });
    console.log(JSON.stringify(result, null, 2));
}
test().catch(console.error);
