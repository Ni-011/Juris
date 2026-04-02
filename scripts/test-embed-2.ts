import { Pinecone } from '@pinecone-database/pinecone';
require('dotenv').config();
async function test() {
    const pc = new Pinecone();
    console.log("Calling embed...");
    try {
        const result = await pc.inference.embed(
            'llama-text-embed-v2',
            ['hello world'],
            { inputType: 'passage', truncate: 'END' }
        );
        console.log(result);
    } catch (e1) {
        console.log("Error 1:", e1.message);
        console.log("Trying object parameter parameter...");
        try {
            const result2 = await pc.inference.embed(
                'llama-text-embed-v2',
                ['hello world'],
                { parameters: { inputType: 'passage', truncate: 'END' } }
            );
            console.log(result2);
        } catch (e2) {
            console.log("Error 2:", e2.message);
        }
    }
}
test().catch(console.error);
