import { Pinecone } from '@pinecone-database/pinecone';
require('dotenv').config();
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
async function test() {
    const result = await pc.inference.embed('llama-text-embed-v2', ['hello world'], { inputType: 'passage', truncate: 'END' });
    console.log(JSON.stringify(result, null, 2));
}
test().catch(console.error);
