import OpenAI from 'openai';
import { searchCases } from '@/lib/vaquill';
import { Pinecone } from '@pinecone-database/pinecone';

// Allow up to 5 minutes for the multi-stage drafting pipeline
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
const DRAFTING_MODEL = 'moonshotai/kimi-k2-thinking';
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

async function generateNvidia(
    messages: OpenAI.ChatCompletionMessageParam[],
    label = 'call',
    maxTokens = 8192,
    validator?: (text: string) => boolean
): Promise<string> {
    const config: any = {
        model: INTERNAL_MODEL,
        messages,
        max_tokens: maxTokens,
        stream: true,
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            if (attempt > 1) {
                const delay = 1000 * Math.pow(2, attempt - 2);
                await new Promise(r => setTimeout(r, delay));
            }

            const stream = await nvidia.chat.completions.create(config, { timeout: 30000 }) as any;
            let fullContent = "";

            for await (const chunk of stream) {
                const delta = chunk.choices?.[0]?.delta as any;
                const content = delta?.content || "";
                if (content) fullContent += content;
            }

            if (!fullContent) throw new Error('Empty response content');

            if (validator && !validator(fullContent)) {
                throw new Error('Validation failed (malformed JSON)');
            }

            return fullContent;
        } catch (e: any) {
            console.error(`[Draft API] ${label} attempt ${attempt} failed:`, e.message || e.status);
            const isRetryable = e.message === 'Empty response content' || e.message === 'Validation failed (malformed JSON)' || e.status === 429 || e.status === 503 || e.status === 500;
            if (!isRetryable || attempt === 3) throw e;
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
                console.log(`[Draft API] [RAG] Fetched ${recordList.length} statute records from Pinecone.`);
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
        console.error("[Draft API] [RAG] Pinecone search failed:", e);
    }
    return [];
}

export async function POST(req: Request) {
    try {
        const { docType, instructions } = await req.json();

        // Start Streaming Response
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
                    const startTime = Date.now();
                    // Stage 1: Analyze Document Request
                    console.log(`[Draft API] [Stage 1] Analyzing Request...`);
                    console.log(`[Draft API] [Stage 1] Prompt Preview: "${instructions.substring(0, 100)}..."`);
                    sendChunk({ s: "Analyzing draft requirements..." });

                    const analyzerPrompt = `Analyze the context for exhaustive LEGAL DRAFTING.
                        Document Type: ${docType}
                        User Instructions: ${instructions}
                        
                        Tasks:
                        1. Identify primary legal issues.
                        2. Decide if a Case Law search is needed ('needs_precedent_search': true).
                        3. Generate EXACTLY 3-4 CORE keywords for Landmark Precedents. KEEP IT SPARSE.
                        
                        Return ONLY JSON:
                        - legal_issues (array)
                        - needs_precedent_search (boolean)
                        - precedent_search_keywords (string: "key1 key2 key3")
                        - statute_search_keywords (string)

                        JSON:`;

                    const analyzerText = await generateNvidia(
                        [
                            { role: 'system', content: 'You are a senior legal drafter analyzing requirements. Respond ONLY with JSON.' },
                            { role: 'user', content: analyzerPrompt }
                        ],
                        'Analyzer',
                        8192,
                        (text) => { try { JSON.parse(repairJson(text)); return true; } catch (e) { return false; } }
                    );

                    const analysis = JSON.parse(repairJson(analyzerText));
                    console.log(`[Draft API] [Stage 1] Complete in ${Date.now() - startTime}ms. Analysis:`, JSON.stringify(analysis, null, 2));

                    // Stage 2: Retrieve Relevant Context
                    const sanitizeSearchQuery = (q: string) => {
                        return q.replace(/\bAND\b/g, ' ')
                                .replace(/\bNOT\b/gi, ' ')
                                .replace(/["']/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                    };

                    const precedentQuery = sanitizeSearchQuery(ensureString(analysis.precedent_search_keywords || analysis.legal_issues || ''));
                    const statuteQuery = sanitizeSearchQuery(ensureString(analysis.statute_search_keywords || analysis.legal_issues || ''));

                    let precedentSources: any[] = [];
                    let statuteChunks: any[] = [];

                    const fetchPrecedents = async () => {
                        if (analysis.needs_precedent_search && precedentQuery) {
                            console.log(`[Draft API] [Stage 2] Fetching Case Law for: "${precedentQuery}"`);
                            sendChunk({ s: `Searching Precedents for "${precedentQuery}"...` });
                            precedentSources = await searchCases(precedentQuery, 5);
                            console.log(`[Draft API] [Stage 2] Found ${precedentSources.length} precedents.`);
                        }
                    };

                    const fetchStatutes = async () => {
                        if (statuteQuery) {
                            console.log(`[Draft API] [Stage 2] Fetching Statutes for: "${statuteQuery}"`);
                            sendChunk({ s: `Retrieving Statutes for "${statuteQuery}"...` });
                            statuteChunks = await fetchStatutesInternal(statuteQuery);
                            console.log(`[Draft API] [Stage 2] Found ${statuteChunks.length} statute chunks.`);
                        }
                    };

                    const retrievalStartTime = Date.now();
                    await Promise.all([fetchPrecedents(), fetchStatutes()]);
                    console.log(`[Draft API] [Stage 2] Context retrieval complete in ${Date.now() - retrievalStartTime}ms. Total snippets: ${precedentSources.length + statuteChunks.length}`);
                    sendChunk({ s: "Synthesizing legal logic and building draft..." });

                    const unifiedPrecedentChunks = precedentSources.map((p: any) => {
                        const rawText = p.summary || p.snippet || p.excerpt || '';
                        const safeText = rawText.length > 1500 ? rawText.substring(0, 1500) + '... [TRUNCATED FOR LENGTH]' : rawText;
                        return { title: p.caseName || p.title, text: safeText, citation: p.citation };
                    });

                    const allChunks = [
                        ...statuteChunks.map((c: any) => `[[STATUTE]] ${c.retrievedContext.act} ${c.retrievedContext.number} - ${c.retrievedContext.title}\nText: ${c.retrievedContext.text}`),
                        ...unifiedPrecedentChunks.map((c: any) => `[[PRECEDENT]] ${c.title} (${c.citation})\nExcerpt: ${c.text}`)
                    ].join('\n\n---\n\n');

                    // Stage 3: The Drafter (Generating HTML Output directly)
                    console.log(`[Draft API] [Stage 3] Document Drafting Starting (${DRAFTING_MODEL})...`);
                    sendChunk({ s: "Drafting Document..." });

                    const draftingPrompt = `You are Juris, an elite legal drafter. Construct a highly professional and robust legal document.

                        DOCUMENT TYPE: ${docType}
                        USER INSTRUCTIONS: ${instructions}

                        RELEVANT LEGAL CONTEXT (Incorporate heavily):
                        ${allChunks || 'No specialized context found. Use general legal principles.'}

                        CRITICAL FORMATTING INSTRUCTIONS:
                        1. You MUST output the document in pure **HTML**. Do NOT use markdown. Do NOT use markdown blocks like \`\`\`html.
                        2. Use appropriate Semantic HTML tags: <h1> for title, <h2> for sections, <p> for paragraphs, <ol>/<ul> for lists, <strong> for bolding.
                        3. VERY IMPORTANT: For any placeholders (names, courts, addresses, dates, amounts, properties, blank spaces, etc.), always wrap them with a custom attribute span exactly like this:
                           <span data-variable-key="variable_name">[Placeholder Text]</span>
                           Example: <span data-variable-key="applicant">[Applicant Name]</span>, <span data-variable-key="court_name">[Name of Court]</span>.
                        4. Write confidently and accurately. Synthesize precedents and statutes directly into the legal arguments.
                        5. ONLY OUTPUT VALID HTML. Do not output conversational text or introductions.

                        START YOUR ENTIRE RESPONSE WITH AN HTML TAG (e.g. <h1>). Do not over-explain. Generate the PERFECT final draft.`;

                    const strategyStream = await nvidia.chat.completions.create({
                         model: DRAFTING_MODEL,
                         messages: [
                             { role: 'system', content: `You are an elite legal drafting AI. Generate pure HTML.` },
                             { role: 'user', content: draftingPrompt }
                         ],
                         stream: true,
                         max_tokens: 131072,
                    } as any, { timeout: 300000 }) as any;

                    let generatedLength = 0;
                    for await (const chunk of strategyStream) {
                        const delta = chunk.choices?.[0]?.delta as any;
                        const content = delta?.content;
                        const reasoning = delta?.reasoning_content;

                        if (reasoning) {
                            console.log(`[Draft API] [Thinking]: ${reasoning.substring(0, 100)}...`);
                            sendChunk({ r: reasoning });
                        }
                        if (content) {
                            generatedLength += content.length;
                            sendChunk({ t: content });
                        }
                    }
                    console.log(`[Draft API] [Stage 3] Drafting complete. Generated ${generatedLength} characters.`);

                    // Final chunk: send metadata for research dialogs
                    sendChunk({ 
                        m: { 
                            research: { 
                                precedents: precedentSources, 
                                statutes: statuteChunks 
                            } 
                        } 
                    });

                    sendChunk({ t: `\n\n---END---` });
                    sendChunk({ s: "Completed", m: { done: true } });
                    closeStream();
                } catch (error: any) {
                    console.error('[Draft API] Pipeline failed:', error.message);
                    sendChunk({ s: "Error Details: " + error.message, error: true });
                    closeStream();
                }
            }
        });

        return new Response(stream, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: 'Critical failure' }), { status: 500 });
    }
}
