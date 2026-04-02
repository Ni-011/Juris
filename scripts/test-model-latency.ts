import OpenAI from 'openai';
require('dotenv').config();

const nvidia = new OpenAI({
    apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
    baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function test() {
    console.log("Testing moonshotai/kimi-k2-instruct-0905...");
    try {
        const start = Date.now();
        const response = await nvidia.chat.completions.create({
            model: 'moonshotai/kimi-k2-instruct-0905',
            messages: [{ role: 'user', content: 'Say hello' }],
            max_tokens: 10
        });
        const end = Date.now();
        console.log("Response:", response.choices[0].message.content);
        console.log(`Time taken: ${end - start}ms`);
    } catch (e: any) {
        console.error("Test failed:", e.message);
    }
}

test();
