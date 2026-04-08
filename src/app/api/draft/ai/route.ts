import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const nvidia = new OpenAI({
    apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
    baseURL: 'https://integrate.api.nvidia.com/v1',
});

const MODEL = 'moonshotai/kimi-k2-instruct-0905';

export async function POST(req: Request) {
    try {
        const { prompt, selection, fullDocument } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const systemPrompt = `You are an elite legal drafting assistant. 
        Your task is to modify the provided text based on the user's request.
        
        CRITICAL RULES:
        1. MAINTAIN the legal structure and tone.
        2. USE the full document context provided to ensure consistency in terms (e.g., if "Party A" is used, don't change it to "Client").
        3. Respond ONLY with the modified section of text. DO NOT include explanations, introduction, or conversational filler.
        4. Preserve the formatting (like bolding or underlines) if appropriate for the change.
        
        FULL DOCUMENT CONTEXT:
        ${fullDocument}

        TEXT TO MODIFY:
        ${selection || '(No specific text selected. Please propose a change based on the prompt)'}
        `;

        const completion = await nvidia.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 4096,
        });

        const result = completion.choices[0]?.message?.content || "";

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('[Draft AI API] Error:', error.message);
        return NextResponse.json({ error: 'Failed to process AI request' }, { status: 500 });
    }
}
