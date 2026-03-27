import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { searchCases } from '@/lib/vaquill';

// Initialize Groq client
const groq = new OpenAI({
    apiKey: process.env.GROQ as string,
    baseURL: 'https://api.groq.com/openai/v1',
});

// Model Configuration
const ANALYZER_MODEL = 'openai/gpt-oss-20b';
const SAFEGUARD_MODEL = 'openai/gpt-oss-safeguard-20b';
const STRATEGY_MODEL = 'openai/gpt-oss-120b';
const GROQ_FALLBACK = 'llama-3.3-70b-versatile';

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

// Generate content with retry + model fallback for Groq
async function generateWithFallback(
    messages: OpenAI.ChatCompletionMessageParam[],
    model: string,
    label = 'call',
    maxTokens = 4096,
    validator?: (text: string) => boolean
): Promise<string> {
    const config: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages,
        max_tokens: maxTokens,
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            if (attempt > 1) {
                const delay = 500 * Math.pow(2, attempt - 2);
                console.log(`[Chat API] ${label}: Retry attempt ${attempt} after ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
            }
            const response = await groq.chat.completions.create(config);
            const content = response.choices?.[0]?.message?.content || "";

            if (!content) {
                throw new Error('Empty response content');
            }

            if (validator && !validator(content)) {
                console.log(`[Chat API] Failing Content Snippet: ${content.substring(0, 500)}...`);
                throw new Error('Validation failed (malformed JSON)');
            }

            return content;
        } catch (e: any) {
            console.error(`[Chat API] ${label} attempt ${attempt} failed:`, e.message || e.status);

            const isRetryable = e.message === 'Empty response content' || e.message === 'Validation failed (malformed JSON)' || e.status === 429 || e.status === 503 || e.status === 500;

            if (!isRetryable || attempt === 3) {
                if (config.model !== GROQ_FALLBACK) {
                    console.warn(`[Chat API] [FALLBACK] ${label}: Switching to Groq fallback ${GROQ_FALLBACK}...`);
                    config.model = GROQ_FALLBACK;
                    attempt = 0; // Restart loop for fallback model
                    continue;
                }
                throw e;
            }
        }
    }
    throw new Error(`${label} failed after all retries`);
}

export async function POST(req: Request) {
    try {
        const { messages, isResearch } = await req.json();
        const userQuery = messages[messages.length - 1].content;
        
        // Use regex to dynamically strip out previously injected System Context blocks to save thousands of tokens 
        // This removes the massive precedent dumps while preserving the final strategy text the Assistant actually output
        const sanitizeContent = (content: string) => {
            return content.replace(/\[SYSTEM CONTEXT - RESEARCH FOUND\]:[\s\S]*?\[MY STRATEGY\]:\n/g, '');
        };

        // Build a readable conversation history so the Analyzer/Strategy models understand the FULL context safely
        const conversationHistory = messages.map((m: any) => `${m.role.toUpperCase()}: ${sanitizeContent(m.content)}`).join('\n\n---\n\n');

        // --- FAST PATH: Conversational Follow-up (or explicit chat mode) ---
        if (!isResearch) {
            console.log(`[Chat API] Follow-up Chat Detected. Using ${GROQ_FALLBACK} for fast conversational response.`);

            const responseStream = new ReadableStream({
                async start(controller) {
                    let streamClosed = false;
                    const sendChunk = (data: any) => {
                        if (streamClosed) return;
                        try { controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + "\n")); } catch (e) {}
                    };
                    const closeStream = () => {
                        if (streamClosed) return;
                        streamClosed = true;
                        try { controller.close(); } catch (e) {}
                    };

                    try {
                        const systemPrompt = { 
                            role: 'system', 
                            content: `You are Juris, an elite legal AI assistant. Answer follow-up questions directly using the conversational context. 
Always cite sources exactly as [[n]] where n is the source number (e.g., [[1]]). 
Do NOT hallucinate case laws.` 
                        };
                        
                        // Pass all messages to retain context
                        const recentSafeMessages = messages.map((m: any) => ({
                            role: m.role,
                            content: m.content
                        }));

                        const chatStream = await groq.chat.completions.create({
                            model: GROQ_FALLBACK,
                            messages: [systemPrompt, ...recentSafeMessages],
                            stream: true,
                        });

                        for await (const chunk of chatStream) {
                            const content = chunk.choices?.[0]?.delta?.content;
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
        console.log(`[Chat API] Incoming Request. Pipeline: ${ANALYZER_MODEL} -> ${SAFEGUARD_MODEL} -> ${STRATEGY_MODEL}`);

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
                    const analyzerPrompt = `Analyze the context for exhaustive CASE LAW research.
                                            Tasks:
                                            1. Provide a "detailed_legal_reasoning" field: Perform a step-by-step analysis of the legal issues, considering both statutory provisions and potential judicial interpretations.
                                            2. Identify primary legal issues.
                                            3. Generate ONE high-recall keyword search string for Landmark Precedents (using both new BNS and old IPC for recall).

                                            Return ONLY JSON using this exact schema:
                                            - detailed_legal_reasoning (string, step-by-step analysis)
                                            - legal_issues (array of strings)
                                            - precedent_search_keywords (string)

                                            JSON:`;

                    const analyzerText = await generateWithFallback(
                        [
                            { role: 'system', content: 'You are a senior legal analyst. Provide deep, step-by-step legal reasoning before structuring the search query. Respond ONLY with JSON.' },
                            { role: 'user', content: analyzerPrompt + "\n\nFULL CONVERSATION CONTEXT:\n" + conversationHistory }
                        ],
                        ANALYZER_MODEL,
                        'Analyzer',
                        2048,
                        (text) => { try { JSON.parse(repairJson(text)); return true; } catch (e) { return false; } }
                    );

                    let initialAnalysis = JSON.parse(repairJson(analyzerText));
                    console.log(`[Chat API] Analyzer output:`, JSON.stringify(initialAnalysis, null, 2));

                    const safeguardPrompt = `Refine this Case Law search query for maximum judicial recall based on the provided legal analysis.
                        Ensure it targets Supreme Court and High Court judgments effectively.

                        LEGAL ISSUES:
                        ${initialAnalysis.legal_issues?.join(', ') || 'General legal research'}

                        KEY REASONING POINTS:
                        ${(initialAnalysis.detailed_legal_reasoning || '').substring(0, 800)}...

                        CRITICAL RESEARCH RULES:
                        1. AVOID OVER-CONSTRAINING: Do NOT use more than 2-3 double-quoted phrases.
                        2. PREFER "OR": Use the OR operator for broader recall between synonyms or similar sections (e.g., "eviction OR removal OR vacate").
                        3. NO IMPLICIT "AND" OVERLOAD: Do not mix 5+ specific terms without OR, as it will likely return zero results.
                        4. If the analysis mentions new BNS sections, you MUST also include their equivalent old IPC sections in the query (e.g., "(Section 85 BNS OR Section 498A IPC)").

                        KEEP THE QUERY CONCISE (under 300 characters). Avoid excessive Boolean operators.

                        Return REFINED JSON using EXACTLY this schema structure:
                        - detailed_legal_reasoning (string)
                        - legal_issues (array of strings)
                        - precedent_search_keywords (string)

                        JSON:`;

                    const safeguardText = await generateWithFallback(
                        [
                            { role: 'system', content: 'You are a legal research safeguards agent. Refine Case Law queries based on deep legal reasoning. Respond ONLY with JSON.' },
                            { role: 'user', content: safeguardPrompt }
                        ],
                        SAFEGUARD_MODEL,
                        'Safeguard',
                        1024,
                        (text) => { try { JSON.parse(repairJson(text)); return true; } catch (e) { return false; } }
                    );

                    const analysis = JSON.parse(repairJson(safeguardText));
                    console.log(`[Chat API] Safeguard output:`, JSON.stringify(analysis, null, 2));

                    // ── Vaquill Search (Precedents Only - Limit 10) ────────
                    const precedentQuery = ensureString(analysis.precedent_search_keywords || analysis.legal_issues || '').trim();
                    console.log(`[Chat API] Precedent Query (${precedentQuery.length} chars): ${precedentQuery}`);

                    let precedentSources: any[] = [];
                    if (precedentQuery) {
                        console.log(`[Chat API] Searching for 6x Case Laws...`);
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
                    
                    console.log(unifiedTextContext);
                    // ── Call 3: Strategy Generator (120B) ──────────────────
                    const strategyPrompt = `You are Juris, a senior legal strategist. Generate a highly explanatory, premium, and actionable legal strategy based EXCLUSIVELY on the provided 6 landmark precedents.
                        ### FORMATTING RULES:
                        1. Use clear Markdown headers (###) for each section.
                        2. Use **bolding** for key legal terms, statues, and core arguments.
                        3. Use bullet points for readability.
                        4. Ensure a professional, authoritative tone.

                        ### CITATION RULES:
                        - Every claim or legal point MUST end with the EXACT format [[n]] where n is the source number.
                        - Do NOT add spaces inside the brackets (e.g., use [[1]], not [[ 1 ]]).
                        - Only cite if the information is directly supported by the precedent.

                        ### IF NO PRECEDENTS ARE FOUND:
                        If "No precedents found" is shown, you MUST NOT provide a strategy. Instead, inform the user: "No specific judicial precedents were found for your query. To ensure legal accuracy and avoid hallucination, Juris requires factual source material to draft a strategy."

                        ### RESPONSE STRUCTURE:

                        ### 1. Case Similarities
                        Explain the specific factual and legal similarities between the user's case context and the cited precedents.

                        ### 2. Winning Arguments
                        Detail the specific arguments the lawyer can make in court, backed by the provided precedents, to help them win.

                        ### 3. Pitfalls & Counter-Arguments
                        Explain potential edge cases, pitfalls, or counter-arguments that the opposing side might raise based on the precedents.

                        ### 4. Action Plan
                        Provide a logical, step-by-step plan for the lawyer to follow, incorporating the precedents at the correct stages.

                        ---
                        LEGAL REASONING:
                        ${analysis.detailed_legal_reasoning}

                        FULL CONVERSATION CONTEXT (FOR FACTS):
                        ${conversationHistory}

                        JUDICIAL PRECEDENTS:
                        ${unifiedTextContext || 'No precedents found.'}`;

                    // ── Call 3: Strategy Generator (120B with Streaming Fallback) ──
                    let currentStrategyModel = STRATEGY_MODEL;
                    let strategyStream;

                    try {
                        console.log(`[Chat API] Call 3: Strategy (${currentStrategyModel})...`);
                        strategyStream = await groq.chat.completions.create({
                            model: currentStrategyModel,
                            messages: [
                                { role: 'system', content: 'Generate a high-parameter legal strategy using only provided judicial precedents.' },
                                { role: 'user', content: strategyPrompt }
                            ],
                            stream: true,
                        });
                    } catch (e: any) {
                        console.warn(`[Chat API] [FALLBACK: Strategy] Switching to ${GROQ_FALLBACK} due to:`, e.message);
                        currentStrategyModel = GROQ_FALLBACK;
                        strategyStream = await groq.chat.completions.create({
                            model: currentStrategyModel,
                            messages: [
                                { role: 'system', content: 'Generate a high-parameter legal strategy using only provided judicial precedents.' },
                                { role: 'user', content: strategyPrompt }
                            ],
                            stream: true,
                        });
                    }

                    for await (const chunk of strategyStream) {
                        const content = chunk.choices?.[0]?.delta?.content;
                        if (content) sendChunk({ t: content });
                    }

                    sendChunk({ t: `\n\n---\n*Architecture: 6x Case Law Consolidation (Detailed 20B → Safeguard 20B → ${currentStrategyModel} Reasoning).*` });
                    // Send precedents and reasoning array to frontend metadata so it can be automatically looped back in on follow-up queries
                    sendChunk({ m: { groundingChunks: unifiedChunks, researchSummary: initialAnalysis } });
                    closeStream();

                } catch (error: any) {
                    console.error('[Chat API] Pipeline failed:', error.message);
                    sendChunk({ t: "⚠️ Juris is experiencing high load with Groq. Falling back to base intelligence..." });
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
