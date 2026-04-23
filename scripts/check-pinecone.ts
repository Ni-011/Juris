import { Pinecone } from '@pinecone-database/pinecone';
require('dotenv').config();
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
async function check() {
    const indexList = await pc.listIndexes();
    console.log("Indexes:", JSON.stringify(indexList, null, 2));
    
    if (indexList.indexes) {
        for (const idx of indexList.indexes) {
            const stats = await pc.index(idx.name).describeIndexStats();
            console.log(`Stats for ${idx.name}:`, JSON.stringify(stats, null, 2));
        }
    }
}
check().catch(console.error);
