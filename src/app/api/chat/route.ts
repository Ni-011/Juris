import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { searchCases } from '@/lib/vaquill';

// Initialize NVIDIA client
const nvidia = new OpenAI({
    apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
    baseURL: 'https://integrate.api.nvidia.com/v1',
});

// Model Configuration
const STRATEGY_MODEL = 'moonshotai/kimi-k2-instruct';
const INTERNAL_MODEL = 'moonshotai/kimi-k2-instruct';

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
    } else if (firstBrace !== -1) {
        clean = clean.substring(firstBrace);
    }

    const lastOpenQuote = clean.lastIndexOf('"');
    const lastCloseBrace = clean.lastIndexOf('}');
    const lastCloseBracket = clean.lastIndexOf(']');
    const maxClose = Math.max(lastCloseBrace, lastCloseBracket);

    if (lastOpenQuote > maxClose) {
        if (!clean.endsWith('"')) clean += '"';
        if (clean.lastIndexOf('{') > clean.lastIndexOf('}')) clean += ' }';
    }

    const openBraces = (clean.match(/\{/g) || []).length;
    let closeBraces = (clean.match(/\}/g) || []).length;
    while (openBraces > closeBraces) {
        clean += ' }';
        closeBraces++;
    }

    const openBrackets = (clean.match(/\[/g) || []).length;
    let closeBrackets = (clean.match(/\]/g) || []).length;
    while (openBrackets > closeBrackets) {
        clean += ' ]';
        closeBrackets++;
    }

    return clean;
}

function ensureString(val: any): string {
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(' ');
    return '';
}

// Generate content with internal streaming to bypass non-streaming stalls
async function generateNvidia(
    messages: OpenAI.ChatCompletionMessageParam[],
    label = 'call',
    maxTokens = 131072,
    validator?: (text: string) => boolean
): Promise<string> {
    const config: any = {
        model: INTERNAL_MODEL,
        messages,
        max_tokens: maxTokens,
        stream: true, // Force streaming for reliability
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            if (attempt > 1) {
                const delay = 1000 * Math.pow(2, attempt - 2);
                console.log(`[Chat API] ${label}: Retry attempt ${attempt} after ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }

            console.log(`[Chat API] ${label} config:`, JSON.stringify({ model: config.model, max_tokens: config.max_tokens }));
            const stream = await nvidia.chat.completions.create(config, { timeout: 60000 }) as any;

            let fullContent = "";
            let fullReasoning = "";
            for await (const chunk of stream) {
                const delta = chunk.choices?.[0]?.delta as any;
                const content = delta?.content || "";
                const reasoning = delta?.reasoning_content || "";

                if (content) {
                    fullContent += content;
                }
                if (reasoning) {
                    fullReasoning += reasoning;
                }
            }

            if (fullReasoning) {
                console.log(`[Chat API] ${label} Thought Process: ${fullReasoning.substring(0, 300)}...`);
            }

            if (!fullContent) {
                throw new Error('Empty response content');
            }

            if (validator && !validator(fullContent)) {
                console.log(`[Chat API] Failing Content Snippet: ${fullContent.substring(0, 500)}...`);
                throw new Error('Validation failed (malformed JSON)');
            }

            return fullContent;
        } catch (e: any) {
            console.error(`[Chat API] ${label} attempt ${attempt} failed:`, e.message || e.status);

            const isRetryable = e.message === 'Empty response content' || e.message === 'Validation failed (malformed JSON)' || e.status === 429 || e.status === 503 || e.status === 500;

            if (!isRetryable || attempt === 3) {
                throw e;
            }
        }
    }
    throw new Error(`${label} failed after all retries`);
}

export async function POST(req: Request) {
    try {
        const { messages, isResearch } = await req.json();

        // Use regex to dynamically strip out previously injected System Context blocks to save thousands of tokens 
        const sanitizeContent = (content: string) => {
            return content.replace(/\[SYSTEM CONTEXT - RESEARCH FOUND\]:[\s\S]*?\[MY STRATEGY\]:\n/g, '');
        };

        // Build a readable conversation history
        const conversationHistory = messages.map((m: any) => `${m.role.toUpperCase()}: ${sanitizeContent(m.content)}`).join('\n\n---\n\n');

        // --- FAST PATH: Conversational Follow-up ---
        if (!isResearch) {
            console.log(`[Chat API] Follow-up Chat Detected. Using ${STRATEGY_MODEL} for fast conversational response.`);

            const responseStream = new ReadableStream({
                async start(controller) {
                    let streamClosed = false;
                    const sendChunk = (data: any) => {
                        if (streamClosed) return;
                        try { controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + "\n")); } catch (e) { }
                    };
                    const closeStream = () => {
                        if (streamClosed) return;
                        streamClosed = true;
                        try { controller.close(); } catch (e) { }
                    };

                    try {
                        const systemPrompt = {
                            role: 'system',
                            content: `You are Juris, an elite legal AI assistant. Answer follow-up questions directly using the conversational context. 
Always cite sources exactly as [[n]] where n is the source number (e.g., [[1]]). 
Do NOT hallucinate case laws.`
                        };

                        const recentSafeMessages = messages.map((m: any) => ({
                            role: m.role,
                            content: m.content
                        }));

                        const chatStream = await nvidia.chat.completions.create({
                            model: STRATEGY_MODEL,
                            messages: [systemPrompt, ...recentSafeMessages],
                            stream: true,
                        } as any) as any;

                        for await (const chunk of chatStream) {
                            const delta = chunk.choices?.[0]?.delta as any;
                            const content = delta?.content;

                            if (content) sendChunk({ t: content });
                        }

                        closeStream();
                    } catch (error: any) {
                        console.error('[Chat API] Follow-up Chat failed:', error.message);
                        sendChunk({ t: "\n\n⚠️ Juris is experiencing an issue processing the follow-up request." });
                        closeStream();
                    }
                }
            });

            return new Response(responseStream, {
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
            });
        }

        // --- HEAVY PATH: Initial Research Pipeline ---
        console.log(`[Chat API] Incoming Request. Pipeline: NVIDIA ${STRATEGY_MODEL}`);

        const stream = new ReadableStream({
            async start(controller) {
                let streamClosed = false;

                const sendChunk = (data: any) => {
                    if (streamClosed) return;
                    try {
                        controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + "\n"));
                    } catch (e) { /* silently ignore */ }
                };

                const closeStream = () => {
                    if (streamClosed) return;
                    streamClosed = true;
                    try { controller.close(); } catch (e) { /* already closed */ }
                };

                try {
                    console.log(`[Chat API] [Stage 1] Analyzer Starting...`);
                    const analyzerPrompt = `Analyze the context for exhaustive CASE LAW research.
                                            Tasks:
                                            1. Identify primary legal issues.
                                            2. Generate ONE high-recall keyword search string for Landmark Precedents.

                                            Return ONLY JSON using this exact schema:
                                            - legal_issues (array of strings)
                                            - precedent_search_keywords (string)

                                            JSON:`;

                    const analyzerText = await generateNvidia(
                        [
                            { role: 'system', content: 'You are a senior legal analyst. Structure the search query based on legal issues. Respond ONLY with JSON.' },
                            { role: 'user', content: analyzerPrompt + "\n\nFULL CONVERSATION CONTEXT:\n" + conversationHistory }
                        ],
                        'Analyzer',
                        131072,
                        (text) => { try { JSON.parse(repairJson(text)); return true; } catch (e) { return false; } }
                    );

                    let initialAnalysis = JSON.parse(repairJson(analyzerText));
                    console.log(`[Chat API] [Stage 1] Analyzer Finished.`);
                    console.log(`[Chat API] Analyzer output:`, JSON.stringify(initialAnalysis, null, 2));

                    console.log(`[Chat API] [Stage 2] Safeguard Starting...`);
                    const safeguardPrompt = `Refine this Case Law search query for maximum judicial recall.
                        
                        LEGAL ISSUES:
                        ${initialAnalysis.legal_issues?.join(', ') || 'General legal research'}

                        CRITICAL RESEARCH RULES:
                        1. AVOID OVER-CONSTRAINING.
                        2. PREFER "OR" for broader recall.
                        3. NO IMPLICIT "AND" OVERLOAD.

                        KEEP THE QUERY CONCISE (under 300 characters).

                        Return REFINED JSON using EXACTLY this schema structure:
                        - detailed_legal_reasoning (string)
                        - legal_issues (array of strings)
                        - precedent_search_keywords (string)

                        JSON:`;

                    const safeguardText = await generateNvidia(
                        [
                            { role: 'system', content: 'You are a legal research safeguards agent. Refine Case Law queries. Respond ONLY with JSON.' },
                            { role: 'user', content: safeguardPrompt }
                        ],
                        'Safeguard',
                        131072,
                        (text) => { try { JSON.parse(repairJson(text)); return true; } catch (e) { return false; } }
                    );

                    const analysis = JSON.parse(repairJson(safeguardText));
                    console.log(`[Chat API] [Stage 2] Safeguard Finished.`);
                    console.log(`[Chat API] Safeguard output:`, JSON.stringify(analysis, null, 2));

                    // ── Vaquill Search ────────
                    const precedentQuery = ensureString(analysis.precedent_search_keywords || analysis.legal_issues || '').trim();
                    console.log(`[Chat API] Precedent Query: ${precedentQuery}`);

                    let precedentSources: any[] = [];
                    if (precedentQuery) {
                        precedentSources = await searchCases(precedentQuery, 6);
                    }
                    console.log(`[Chat API] Found ${precedentSources.length} precedents.`);

                    const unifiedChunks = precedentSources.map((p: any) => {
                        const rawText = p.summary || p.snippet || p.excerpt || '';
                        const safeText = rawText.length > 1500 ? rawText.substring(0, 1500) + '... [TRUNCATED FOR LENGTH]' : rawText;
                        return {
                            sourceType: 'precedent',
                            retrievedContext: {
                                title: p.caseName || p.title,
                                text: safeText,
                                citation: p.citation || 'Judgment',
                                court: p.court,
                                year: p.year,
                                judges: p.judges,
                                pdfUrl: p.pdfUrl,
                                petitioner: p.petitioner,
                                respondent: p.respondent
                            }
                        };
                    });

                    const unifiedTextContext = unifiedChunks.map((c: any, i: number) => {
                        const ctx = c.retrievedContext;
                        return `[[${i + 1}]] PRECEDENT: ${ctx.title} (${ctx.citation})\nExcerpt: ${ctx.text}`;
                    }).join('\n\n---\n\n');

                    // ── Call 3: Strategy Generator ──────────────────
                    const strategyPrompt = `You are Juris, a senior legal strategist. Generate a highly explanatory, premium, and actionable legal strategy based EXCLUSIVELY on the provided 6 landmark precedents.
                        ### FORMATTING RULES:
                        1. Use clear Markdown headers (###) for each section.
                        2. Use **bolding** for key legal terms.
                        3. Use bullet points.

                        ### CITATION RULES:
                        - Every claim MUST end with [[n]].

                        ### RESPONSE STRUCTURE:
                        ### 1. Case Similarities
                        ### 2. Winning Arguments
                        ### 3. Pitfalls & Counter-Arguments
                        ### 4. Action Plan

                        ---
                        LEGAL ISSUES:
                        ${analysis.legal_issues?.join(', ') || 'General legal research'}

                        JUDICIAL PRECEDENTS:
                        ${unifiedTextContext || 'No precedents found.'}`;

                    console.log(`[Chat API] [Stage 3] Strategy Generation Starting (${STRATEGY_MODEL})...`);
                    const strategyStream = await nvidia.chat.completions.create({
                        model: STRATEGY_MODEL,
                        messages: [
                            { role: 'system', content: 'Generate a high-parameter legal strategy using only provided judicial precedents.' },
                            { role: 'user', content: strategyPrompt }
                        ],
                        stream: true,
                        max_tokens: 131072,
                    } as any, { timeout: 300000 }) as any; // 5 min timeout for heavy strategy

                    for await (const chunk of strategyStream) {
                        const delta = chunk.choices?.[0]?.delta as any;
                        const content = delta?.content;

                        if (content) sendChunk({ t: content });
                    }

                    sendChunk({ t: `\n\n---\n*Architecture: Kimi-K2-Instruct via NVIDIA API.*` });
                    sendChunk({ m: { groundingChunks: unifiedChunks, researchSummary: initialAnalysis } });
                    closeStream();

                } catch (error: any) {
                    console.error('[Chat API] Pipeline failed:', error.message);
                    sendChunk({ t: "⚠️ Juris is experiencing an issue. Please try again." });
                    closeStream();
                }
            },
        });

        return new Response(stream, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
    } catch (error: any) {
        console.error('Error in chat route:', error.message);
        return NextResponse.json({ error: 'Critical failure' }, { status: 500 });
    }
}
