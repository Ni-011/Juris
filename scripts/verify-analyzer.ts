import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

const nvidia = new OpenAI({
    apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
    baseURL: 'https://integrate.api.nvidia.com/v1',
});

const INTERNAL_MODEL = 'moonshotai/kimi-k2-instruct-0905';

function repairJson(text: string): string {
    let clean = (text || '').trim();
    if (clean.includes('```')) {
        const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) clean = match[1].trim();
    }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }
    return clean;
}

async function analyze(prompt: string) {
    const analyzerPrompt = `Analyze the context for exhaustive CASE LAW research.
                            Tasks:
                            1. Identify primary legal issues.
                            2. Decide if a Case Law search is needed ('needs_precedent_search': true for factual scenarios, complex disputes, or case situations; false for direct statutory/constitutional questions).
                            3. Generate ONE high-recall keyword search string for Landmark Precedents.

                            Return ONLY JSON using this exact schema:
                            - legal_issues (array of strings)
                            - needs_precedent_search (boolean)
                            - precedent_search_keywords (string)

                            JSON:`;

    const response = await nvidia.chat.completions.create({
        model: INTERNAL_MODEL,
        messages: [
            { role: 'system', content: 'You are a senior legal analyst. Structure the search query based on legal issues. Respond ONLY with JSON.' },
            { role: 'user', content: analyzerPrompt + "\n\nFULL CONVERSATION CONTEXT:\nUSER: " + prompt }
        ],
        max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "";
    return JSON.parse(repairJson(content));
}

async function runTests() {
    console.log("--- TEST 1: Simple Statutory Question ---");
    const res1 = await analyze("What does Article 21 of the Indian Constitution say?");
    console.log("Prompt: What does Article 21 of the Indian Constitution say?");
    console.log("Decision (needs_precedent_search):", res1.needs_precedent_search);
    console.log("Result:", JSON.stringify(res1, null, 2));

    console.log("\n--- TEST 2: Complex Case Situation ---");
    const res2 = await analyze("My neighbor's construction damaged my wall, what are my legal options in India?");
    console.log("Prompt: My neighbor's construction damaged my wall, what are my legal options in India?");
    console.log("Decision (needs_precedent_search):", res2.needs_precedent_search);
    console.log("Result:", JSON.stringify(res2, null, 2));
}

runTests().catch(console.error);
