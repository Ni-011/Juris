import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

const nvidia = new OpenAI({
    apiKey: process.env.NVIDIA as string,
    baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function testKimiInstruct() {
    const model = "moonshotai/kimi-k2-instruct-0905";
    console.log(`Testing model: ${model}...`);
    try {
        const response = await nvidia.chat.completions.create({
            model: model,
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 10,
        });
        console.log(`✅ Success with ${model}`);
    } catch (error: any) {
        console.error(`❌ Failed with ${model}: ${error.message}`);
    }
}

testKimiInstruct();
