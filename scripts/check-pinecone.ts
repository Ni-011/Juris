import { Pinecone } from '@pinecone-database/pinecone';
require('dotenv').config();
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
async function check() {
    const indexList = await pc.listIndexes();
    console.log("Indexes:", JSON.stringify(indexList, null, 2));
}
check().catch(console.error);
