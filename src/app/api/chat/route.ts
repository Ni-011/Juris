import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { searchCases } from '@/lib/vaquill';
import { Pinecone } from '@pinecone-database/pinecone';
import { parsePDF } from '@/lib/pdf-parser';

// Allow up to 5 minutes for the multi-stage research pipeline
export const maxDuration = 300;

// Initialize NVIDIA client
const nvidia = new OpenAI({
    apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
    baseURL: 'https://integrate.api.nvidia.com/v1',
});

// Initialize Pinecone client
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY as string });
const jurisIndex = pc.Index('juris');

// Model Configuration
const STRATEGY_MODEL = 'moonshotai/kimi-k2-thinking';
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
            const stream = await nvidia.chat.completions.create(config, { timeout: 30000 }) as any;

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

async function fetchStatutesInternal(query: string) {
    if (!query) return [];
    try {
        const queryEmbed = await pc.inference.embed({
            model: 'llama-text-embed-v2',
            inputs: [query],
            parameters: { inputType: 'query', truncate: 'END' }
        });
        const statRes = await jurisIndex.query({
            topK: 5,
            vector: (queryEmbed.data[0] as any).values,
            includeMetadata: true
        });

        if (statRes.matches) {
            const primaryIds = statRes.matches.map((m: any) => m.id);
            const neighborIds: string[] = [];

            statRes.matches.forEach((m: any) => {
                const act = m.metadata.act;
                const num = parseInt(m.metadata.number);
                if (!isNaN(num)) {
                    if (num > 1) neighborIds.push(`${act}_${num - 1}`);
                    neighborIds.push(`${act}_${num + 1}`);
                }
            });

            const allUniqueIds = Array.from(new Set([...primaryIds, ...neighborIds]));
            const fetchRes = await jurisIndex.fetch({ ids: allUniqueIds as string[] });

            if (fetchRes.records) {
                const recordList = Object.values(fetchRes.records);
                return recordList.map((m: any) => ({
                    sourceType: 'statute',
                    retrievedContext: {
                        act: m.metadata.act,
                        number: parseInt(m.metadata.number) || 0,
                        title: m.metadata.title,
                        text: m.metadata.text
                    }
                })).sort((a, b) => {
                    if (a.retrievedContext.act !== b.retrievedContext.act) {
                        return a.retrievedContext.act.localeCompare(b.retrievedContext.act);
                    }
                    return a.retrievedContext.number - b.retrievedContext.number;
                });
            }
        }
    } catch (e) {
        console.error("[Chat API] Pinecone search failed:", e);
    }
    return [];
}

export async function POST(req: Request) {
    try {
        const { messages, isResearch, attachments } = await req.json();

        // Use regex to dynamically strip out previously injected System Context blocks to save thousands of tokens 
        const sanitizeContent = (content: string) => {
            return content.replace(/\[SYSTEM CONTEXT - RESEARCH FOUND\]:[\s\S]*?\[MY STRATEGY\]:\n/g, '');
        };

        // --- ATTACHMENT PROCESSING ---
        let attachmentContext = "";
        if (attachments && attachments.length > 0) {
            console.log(`[Chat API] Processing ${attachments.length} attachments...`);
            for (const att of attachments) {
                if (att.type === 'application/pdf' && att.base64) {
                    try {
                        const text = await parsePDF(att.base64);
                        attachmentContext += `\n### USER DOCUMENT: ${att.name}\n${text}\n---\n`;
                    } catch (e) {
                        console.error(`[Chat API] Failed to parse PDF ${att.name}:`, e);
                    }
                }
            }
        }

        // Build a readable conversation history
        const conversationHistory = messages.map((m: any) => `${m.role.toUpperCase()}: ${sanitizeContent(m.content)}`).join('\n\n---\n\n');

        // --- FAST PATH: Conversational Follow-up ---
        if (!isResearch) {
            console.log(`[Chat API] Follow-up Chat Detected. Using ${INTERNAL_MODEL} for fast conversational response.`);

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
                        const lastUserMessage = messages[messages.length - 1]?.content || "";
                        console.log(`[Chat API] [Fast Path] Running Statute RAG for: "${lastUserMessage.substring(0, 50)}..."`);

                        const statuteChunks = await fetchStatutesInternal(lastUserMessage);
                        const groundedContext = statuteChunks.map((c: any, i: number) => {
                            const ctx = c.retrievedContext;
                            return `[[${i + 1}]] STATUTE: ${ctx.act} ${ctx.number} - ${ctx.title}\nText: ${ctx.text}`;
                        }).join('\n\n---\n\n');

                        const systemPrompt = {
                            role: 'system',
                            content: `You are Juris, an elite legal AI assistant. Answer follow-up questions directly using the conversational context. 
                        
                            ### ATTACHED STATUTORY CONTEXT:
                            ${groundedContext || 'No specific statute found for this query.'}

                            ### FORMATTING RULES:
                            1. Use clear Markdown headers (###) for distinct sections where appropriate.
                            2. Use **bolding** for key legal terms and critical points.
                            3. Use bullet points for readability.
                            
                            ### CITATION RULES:
                            Always cite sources exactly as [[n]] where n is the source number (e.g., [[1]]) based on the 'ATTACHED STATUTORY CONTEXT' provided above.
                            
                            Do NOT hallucinate case laws.`
                        };

                        const recentSafeMessages = messages.map((m: any) => ({
                            role: m.role,
                            content: m.content
                        }));

                        const chatStream = await nvidia.chat.completions.create({
                            model: INTERNAL_MODEL,
                            messages: [systemPrompt, ...recentSafeMessages],
                            stream: true,
                        } as any) as any;

                        for await (const chunk of chatStream) {
                            const delta = chunk.choices?.[0]?.delta as any;
                            const content = delta?.content;

                            if (content) sendChunk({ t: content });
                        }

                        sendChunk({ t: "\n\n---" });
                        if (statuteChunks.length > 0) {
                            sendChunk({ m: { groundingChunks: statuteChunks } });
                        }
                        closeStream();
                    } catch (error: any) {
                        console.error('[Chat API] Follow-up Chat failed:', error.message);
                        const isTimeout = error.message?.includes('timeout') || error.message?.includes('aborted') || error.code === 'ETIMEDOUT';
                        const isRateLimit = error.status === 429;
                        const errorMsg = isTimeout
                            ? "\n\n⚠️ The request timed out. The AI model is under heavy load — please try again in a moment."
                            : isRateLimit
                                ? "\n\n⚠️ Rate limit reached. Please wait a moment before trying again."
                                : "\n\n⚠️ Juris encountered an issue processing the follow-up request. Please try again.";
                        sendChunk({ t: errorMsg });
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
                    sendChunk({ s: "Analyzing case context..." });
                    const analyzerPrompt = `Analyze the context for exhaustive CASE LAW research.
                                            Tasks:
                                            1. Identify primary legal issues.
                                            2. Decide if a Case Law search is needed ('needs_precedent_search': true).
                                            3. Generate EXACTLY 3-4 CORE keywords for Landmark Precedents. KEEP IT SPARSE.
                                            4. Identify roles.

                                            Return ONLY JSON:
                                            - legal_issues (array)
                                            - needs_precedent_search (boolean)
                                            - precedent_search_keywords (string: "key1 key2 key3")
                                            - client_role (string)
                                            - opposing_party_role (string)

                                            JSON:`;

                    const analyzerText = await generateNvidia(
                        [
                            { role: 'system', content: 'You are a senior legal analyst. Structure the search query based on legal issues. Respond ONLY with JSON.' },
                            { role: 'user', content: analyzerPrompt + "\n\nFULL CONVERSATION CONTEXT:\n" + conversationHistory + (attachmentContext ? "\n\nATTACHED USER DOCUMENTS:\n" + attachmentContext : "") }
                        ],
                        'Analyzer',
                        8192,
                        (text) => { try { JSON.parse(repairJson(text)); return true; } catch (e) { return false; } }
                    );

                    let initialAnalysis = JSON.parse(repairJson(analyzerText));
                    console.log(`[Chat API] [Stage 1] Analyzer Finished.`);
                    console.log(`[Chat API] Analyzer output:`, JSON.stringify(initialAnalysis, null, 2));

                    console.log(`[Chat API] [Stage 2] Safeguard Starting...`);
                    sendChunk({ s: "Safeguarding search intent..." });
                    const safeguardPrompt = `Refine this Case Law search query for MAXIMUM JUDICIAL RECALL.
                        
                        LEGAL ISSUES:
                        ${initialAnalysis.legal_issues?.join(', ') || 'General legal research'}

                        CRITICAL RESEARCH RULES (Lenient Boolean):
                        1. USE "OR" FOR SYNONYMS: To increase recall, group similar terms with OR and parentheses.
                        2. EXTREME SPARSITY: Limit to 2-3 concept groups. Do NOT use explicit "AND" (space is enough).
                        3. NO NOISE: Remove "of", "the", "in", "divorce", "case", "law" unless essential.

                        GOOD QUERY: "(concealment OR dissipation OR "hidden assets") alimony"
                        BAD QUERY: "fraudulent transfer to avoid alimony in divorce proceedings"

                        Return REFINED JSON:
                        - detailed_legal_reasoning (string)
                        - legal_issues (array)
                        - needs_precedent_search (boolean)
                        - precedent_search_keywords (string)
                        - statute_search_keywords (string)
                        - client_role (string)
                        - opposing_party_role (string)

                        JSON:`;

                    const safeguardText = await generateNvidia(
                        [
                            { role: 'system', content: 'You are a legal research safeguards agent. Refine Case Law and Statute queries. Respond ONLY with JSON. CRITICAL: PRESERVE the client_role and opposing_party_role exactly as provided.' },
                            { role: 'user', content: `Refine this search. \nCLIENT: ${initialAnalysis.client_role}\nOPPONENT: ${initialAnalysis.opposing_party_role}\nNeeds Case Law = ${initialAnalysis.needs_precedent_search}\n\n` + safeguardPrompt }
                        ],
                        'Safeguard',
                        8192,
                        (text) => { try { JSON.parse(repairJson(text)); return true; } catch (e) { return false; } }
                    );

                    const analysis = JSON.parse(repairJson(safeguardText));
                    console.log(`[Chat API] [Stage 2] Safeguard Finished.`);
                    sendChunk({ s: `Refining keywords: ${analysis.precedent_search_keywords}...` });
                    console.log(`[Chat API] Safeguard output:`, JSON.stringify(analysis, null, 2));

                    // Sanitize queries to allow Lenient Booleans (OR, parentheses) for higher recall
                    const sanitizeSearchQuery = (q: string) => {
                        return q.replace(/\bAND\b/g, ' ') // Remove explicit AND (implicit space is better)
                                .replace(/\bNOT\b/gi, ' ') // Remove NOT (tends to be too restrictive)
                                .replace(/["']/g, '') // Remove quotes unless explicitly needed
                                .replace(/\s+/g, ' ') // Collapse spaces
                                .trim();
                    };

                    const precedentQuery = sanitizeSearchQuery(ensureString(analysis.precedent_search_keywords || analysis.legal_issues || ''));
                    const statuteQuery = sanitizeSearchQuery(ensureString(analysis.statute_search_keywords || analysis.legal_issues || ''));
                    
                    console.log(`[Chat API] Precedent Query (Lenient Boolean): ${precedentQuery}`);
                    console.log(`[Chat API] Statute Query (Lenient Boolean): ${statuteQuery}`);

                    let precedentSources: any[] = [];
                    let statuteChunks: any[] = [];

                    const fetchPrecedents = async () => {
                        if (analysis.needs_precedent_search && precedentQuery) {
                            sendChunk({ s: `Searching Precedents for "${precedentQuery}"...` });
                            precedentSources = await searchCases(precedentQuery, 5);
                        } else {
                            console.log(`[Chat API] Skipping Precedent Search (Decision: false)`);
                        }
                    };

                    const fetchStatutes = async () => {
                        if (statuteQuery) {
                            sendChunk({ s: `Retrieving Statutes for "${statuteQuery}"...` });
                            statuteChunks = await fetchStatutesInternal(statuteQuery);
                            console.log(`[Chat API] Pinecone Expanded Context: ${statuteChunks.length} sections retrieved.`);
                        }
                    };

                    await Promise.all([fetchPrecedents(), fetchStatutes()]);
                    console.log(`[Chat API] Found ${precedentSources.length} precedents, ${statuteChunks.length} statutes.`);
                    sendChunk({ s: "Synthesizing legal logic..." });

                    const unifiedPrecedentChunks = precedentSources.map((p: any) => {
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

                    // Combine them
                    const allChunks = [...statuteChunks, ...unifiedPrecedentChunks];

                    const unifiedTextContext = allChunks.map((c: any, i: number) => {
                        if (c.sourceType === 'statute') {
                            const ctx = c.retrievedContext;
                            return `[[${i + 1}]] STATUTE: ${ctx.act} ${ctx.number} - ${ctx.title}\nText: ${ctx.text}`;
                        } else {
                            const ctx = c.retrievedContext;
                            return `[[${i + 1}]] PRECEDENT: ${ctx.title} (${ctx.citation})\nExcerpt: ${ctx.text}`;
                        }
                    }).join('\n\n---\n\n');

                    // ── Call 3: Strategy Generator ──────────────────
                    const strategyPrompt = `You are Juris, a senior legal strategist. Generate a highly explanatory, premium, and FIERCELY ADVOCATIVE legal strategy based EXCLUSIVELY on the provided statutes and precedents.
                        ### FORMATTING RULES:
                        1. Use clear Markdown headers (###) for each section.
                        2. Use **bolding** for key legal terms.
                        3. Use bullet points.

                        ### CITATION RULES:
                        - Every claim MUST end with [[n]] mapped exactly to the source number.
                        - You must cite the statutes when analyzing the rules, and cite precedents when analyzing court application.
                        
                        ### RESPONSE STRUCTURE:
                        ### 1. Statutory Grounding (Favoring Client)
                        ### 2. Case Similarities (Leveraging Precedents for Client)
                        ### 3. Winning Arguments (Primary Offensive/Defensive Strategy)
                        ### 4. Counter-Argument Neutralization (How to defeat the Opponent)
                        ### 5. Tactical Action Plan

                        ---
                        LEGAL ISSUES:
                        ${analysis.legal_issues?.join(', ') || 'General legal research'}

                        CLIENT ROLE (We are working FOR this person):
                        ${analysis.client_role || 'Unknown'}

                        OPPOSING PARTY (The Adversary):
                        ${analysis.opposing_party_role || 'Unknown'}

                        CRITICAL INSTRUCTION:
                        Frame every single sentence, strategy, and winning argument to favor the CLIENT ROLE. Identify risks from the OPPOSING PARTY only to provide rebuttals and neutralization tactics. Do NOT provide a balanced view; provide a winning partisan strategy for our client.

                        JUDICIAL PRECEDENTS & STATUTES:
                        ${unifiedTextContext || 'No context found.'}

                        USER'S ATTACHED DOCUMENTS:
                        ${attachmentContext || 'No additional documents provided.'}`;
                    console.log(`[Chat API] [Stage 3] Strategy Generation Starting (${STRATEGY_MODEL})...`);
                    sendChunk({ s: "Finalizing Juris briefing..." });
                    const strategyStream = await nvidia.chat.completions.create({
                        model: STRATEGY_MODEL,
                        messages: [
                            {
                                role: 'system',
                                content: `You are Juris, an elite legal strategist and fierce advocate. Your ONLY mission is to build a winning case for the identified CLIENT. 
                                Use ONLY the provided context. 
                                CRITICAL: Every numeric citation [[n]] MUST correspond EXACTLY to its index in the context list below. 
                                Re-verify that every argument you make is supported by the context but framed to bolster the client's position.`
                            },
                            ...messages.map((m: any) => ({ role: m.role, content: m.content })),
                            { role: 'user', content: strategyPrompt }
                        ],
                        stream: true,
                        max_tokens: 131072,
                    } as any, { timeout: 300000 }) as any; // 5 min timeout for heavy strategy

                    for await (const chunk of strategyStream) {
                        const delta = chunk.choices?.[0]?.delta as any;
                        const content = delta?.content;
                        const reasoning = delta?.reasoning_content;

                        if (reasoning) sendChunk({ r: reasoning });
                        if (content) sendChunk({ t: content });
                    }

                    sendChunk({ t: `\n\n---` });
                    sendChunk({ m: { groundingChunks: allChunks, researchSummary: initialAnalysis } });
                    closeStream();

                } catch (error: any) {
                    console.error('[Chat API] Pipeline failed:', error.message, error.stack);
                    const isTimeout = error.message?.includes('timeout') || error.message?.includes('aborted') || error.code === 'ETIMEDOUT';
                    const isRateLimit = error.status === 429;
                    const errorMsg = isTimeout
                        ? "⚠️ The research pipeline timed out. The AI model may be under heavy load — please try again in a moment."
                        : isRateLimit
                            ? "⚠️ Rate limit reached. Please wait a minute before submitting a new query."
                            : "⚠️ Juris encountered an issue during research. Please try again.";
                    sendChunk({ t: errorMsg });
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
