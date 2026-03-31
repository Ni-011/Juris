import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

const nvidia = new OpenAI({
    apiKey: process.env.NVIDEA as string,
    baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function testV31Streaming() {
    console.log("Testing NVIDIA DeepSeek 3.1 (Streaming)...");
    try {
        const stream = await nvidia.chat.completions.create({
            model: "deepseek-ai/deepseek-v3.1",
            messages: [{ role: "user", content: "Hi" }],
            stream: true,
        });
        console.log("Stream started!");
        for await (const chunk of stream as any) {
            process.stdout.write(chunk.choices[0]?.delta?.content || "");
        }
        console.log("\nStream finished!");
    } catch (error: any) {
        console.error("Test failed:", error.message);
    }
}

testV31Streaming();
