import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

const nvidia = new OpenAI({
    apiKey: process.env.NVIDIA as string,
    baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function testKimiModels() {
    const models = [
        "moonshotai/kimi-k2-thinking",
        "moonshotai/kimi-k1-thinking",
        "moonshotai/kimi-thinking",
    ];

    for (const model of models) {
        console.log(`Testing model: ${model}...`);
        try {
            const response = await nvidia.chat.completions.create({
                model: model,
                messages: [{ role: "user", content: "Hi" }],
                max_tokens: 10,
            });
            console.log(`✅ Success with ${model}`);
            return model;
        } catch (error: any) {
            console.error(`❌ Failed with ${model}: ${error.message}`);
        }
    }
}

testKimiModels();
