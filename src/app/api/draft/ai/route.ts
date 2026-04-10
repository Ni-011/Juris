import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const nvidia = new OpenAI({
    apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
    baseURL: 'https://integrate.api.nvidia.com/v1',
});

const MODEL = 'moonshotai/kimi-k2-thinking';

export async function POST(req: Request) {
    try {
        const { prompt, selection, fullDocument } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const systemPrompt = `You are an elite legal drafting assistant. 
        Your task is to modify the provided document based on the user's request.
        
        CRITICAL RULES:
        1. MAINTAIN the legal structure and tone.
        2. USE the full document context provided to ensure consistency in terms (e.g., if "Party A" is used, don't change it to "Client").
        3. Preserve all HTML formatting (bold, italic, underline).
        4. ABSOLUTELY PRESERVE any metadata tags like <span data-variable-key="...">...</span>. Do NOT remove or change the data-variable-key attributes; only update the text inside them if requested.
        5. Return the result as raw HTML WITHOUT markdown wrappers like \`\`\`html.
        ${selection 
            ? `6. The user has explicitly selected a specific section. Respond ONLY with the newly modified section of text. DO NOT include the rest of the document. DO NOT include explanations.` 
            : `6. The user has NOT selected a specific section. You must return the ENTIRE document with the requested modifications applied in the correct place. DO NOT omit any untouched sections of the document.`
        }
        
        FULL DOCUMENT CONTEXT:
        ${fullDocument}

        ${selection ? `SELECTED TEXT TO MODIFY:\n${selection}` : ''}
        `;

        const completion = await nvidia.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 8192,
        });

        const result = completion.choices[0]?.message?.content || "";

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('[Draft AI API] Error:', error.message);
        return NextResponse.json({ error: 'Failed to process AI request' }, { status: 500 });
    }
}
