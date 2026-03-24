import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { searchCases, askLegalQuestion } from '@/lib/vaquill';

// Initialize the new Gemini SDK with the key directly
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// Read the store name
let fileSearchStoreName = '';
try {
    const storePath = path.join(process.cwd(), 'src', 'utils', 'gemini-docs.json');
    if (fs.existsSync(storePath)) {
        const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        fileSearchStoreName = data.fileSearchStoreName || '';
    }
} catch (e) {
    console.error("Failed to read fileSearchStoreName", e);
}

async function generateWithRetry(ai: any, model: string, contents: any, config: any, maxRetries = 1, timeout = 15000) {
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = 500 * Math.pow(2, attempt - 1);
                console.log(`[Chat API] Retrying ${model} (Attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            return await ai.models.generateContent({
                model,
                contents,
                config: { ...config, httpOptions: { timeout } }
            });
        } catch (e: any) {
            lastError = e;
            const isRetryable = e.message?.includes('503') || e.message?.includes('high demand') || e.message?.includes('UNAVAILABLE') || e.message?.includes('DEADLINE_EXCEEDED') || e.message?.includes('504') || e.message?.includes('500') || e.message?.includes('INTERNAL');
            if (!isRetryable || attempt === maxRetries) break;
        }
    }
    throw lastError;
}

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const userQuery = messages[messages.length - 1].content;
        const selectedModel = 'gemini-3.1-flash-lite-preview';

        const stream = new ReadableStream({
            async start(controller) {
                const sendChunk = (data: any) => {
                    controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + "\n"));
                };

                try {
                    // Call 1 — Case Analyzer (Flash-Lite, cheap)
                    console.log(`[Chat API] Call 1: Case Analyzer...`);
                    const analyzerPrompt = `
Analyze the following legal case context and provide a structured JSON response.
Generate a clear, specific legal question for the Vaquill Case Law AI that will retrieve real court judgments ("X vs Y" case precedents).

**QUESTION RULES:**
1. Write a natural-language legal question that will retrieve RELEVANT COURT JUDGMENTS.
2. Focus on the legal principles, not just section numbers.
3. If user mentions BNS/BNSS/BSA, translate to IPC/CrPC/IEA equivalents in the question since the case database uses older terminology.
4. Include factual elements (e.g., "assault with iron rods", "stolen property") to find factually similar cases.
5. Ask about landmark cases, ratios, or settled legal principles.

Examples:
- User says "BNS section 103 self defence" → "What are the landmark Supreme Court cases on right of private defense under Section 96 to 106 IPC where the accused used deadly force?"
- User says "bail under BNSS" → "What are the leading cases on bail conditions and when bail should be granted under CrPC Section 437 and 439?"

CONTEXT:
${userQuery}

OUTPUT FORMAT (JSON):
{
  "legal_issues": ["issue1", "issue2"],
  "applicable_laws": ["BNS section X (IPC X)", "Article Y"],
  "precedent_question": "Natural-language legal question to find relevant court judgments",
  "proceeding_stage": "Stage description",
  "weaknesses_in_current_position": ["weakness1", "weakness2"]
}
`;

                    const analyzerResponse = await generateWithRetry(ai, selectedModel, [{ role: 'user', parts: [{ text: analyzerPrompt }] }], {
                        systemInstruction: "You are a legal case analyzer. Respond ONLY with valid JSON.",
                        responseMimeType: "application/json"
                    }, 2, 20000);

                    const analysisJsonText = analyzerResponse.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
                    let analysis: any = {};
                    try {
                        analysis = JSON.parse(analysisJsonText);
                    } catch (e) {
                        console.error("Failed to parse analyzer JSON:", analysisJsonText);
                    }

                    // Call 2 — Precedent Hunter (Vaquill Ask API — real court judgments)
                    console.log(`[Chat API] Call 2: Precedent Hunter (Ask API)...`);
                    const precedentQuestion = analysis.precedent_question
                        || analysis.vaquill_query
                        || `What are the landmark Indian court cases on ${(analysis.legal_issues || []).join(' and ')}?`;

                    const askResult = await askLegalQuestion(precedentQuestion, 8, 'standard');
                    const caseSources = askResult.sources;

                    console.log(`[Chat API] Found ${caseSources.length} real case precedents: ${caseSources.map(s => s.caseName).join(', ')}`);

                    // Call 3 — Strategy Generator
                    console.log(`[Chat API] Call 3: Strategy Generator...`);

                    // Fetch statutory grounding if available (BNS/Constitution context)
                    let groundingMetadata: any = null;
                    if (fileSearchStoreName) {
                        const groundingRequestConfig: any = {
                            systemInstruction: "Identify relevant BNS/Constitution sections for the case.",
                            tools: [{ fileSearch: { fileSearchStoreNames: [fileSearchStoreName] } }]
                        };
                        try {
                            const groundingResponse = await generateWithRetry(ai, selectedModel, [{ role: 'user', parts: [{ text: userQuery }] }], groundingRequestConfig, 1, 15000);
                            groundingMetadata = groundingResponse.candidates?.[0]?.groundingMetadata;
                        } catch (e) {
                            console.warn("Statutory grounding failed, proceeding with analysis and precedents.");
                        }
                    }

                    // Unified context merging for clean indexing [[1]], [[2]], etc.
                    const unifiedChunks: any[] = [
                        ...(groundingMetadata?.groundingChunks || []).map((c: any) => ({
                            ...c,
                            sourceType: 'statute',
                            retrievedContext: { ...c.retrievedContext, title: 'Statute' }
                        })),
                        ...caseSources.map((s) => ({
                            sourceType: 'precedent',
                            retrievedContext: {
                                title: s.caseName,
                                text: s.excerpt,
                                citation: s.citation,
                                court: s.court,
                                courtType: s.courtType,
                                year: s.year,
                                judges: s.judges,
                                pdfUrl: s.pdfUrl,
                                petitioner: s.petitioner,
                                respondent: s.respondent,
                                disposition: s.disposition,
                            }
                        }))
                    ];

                    // Also include the Vaquill AI's own analysis as supplementary context
                    const vaquillAnalysis = askResult.answer ? `\n\nVAQUILL AI ANALYSIS:\n${askResult.answer}` : '';

                    const unifiedContext = unifiedChunks.map((c, i) => {
                        const ctx = c.retrievedContext;
                        if (c.sourceType === 'precedent') {
                            const judgeLine = ctx.judges?.length ? `Judges: ${ctx.judges.join(', ')}` : '';
                            return `[[${i + 1}]] CASE PRECEDENT: ${ctx.title} (${ctx.citation})\nCourt: ${ctx.court} | Year: ${ctx.year || 'N/A'} | ${judgeLine}\nExcerpt: ${ctx.text}`;
                        }
                        return `[[${i + 1}]] STATUTE: ${ctx.title}\n${ctx.text}`;
                    }).join('\n\n---\n\n') + vaquillAnalysis;

                    const strategyPrompt = `
You are Juris, an expert AI legal strategy partner for Indian lawyers.
Generate a comprehensive legal strategy based ONLY on the provided legal sources.

CASE CONTEXT:
${userQuery}

STRUCTURED ISSUES:
${JSON.stringify(analysis, null, 2)}

LEGAL SOURCES (Statutes & Precedents):
${unifiedContext}

STRICT GROUNDING RULES:
1. NO EXTERNAL MEMORY: Only cite and use the [[n]] sources provided above.
2. PRECEDENTIAL AUTHORITY: You MUST include a dedicated '## Precedential Authority' section. List EVERY case precedent from the sources using its full "X vs Y" name.
3. CASE CITATION FORMAT: Always write the full case name exactly as given (e.g., "State of Maharashtra vs Mohd. Yakub") followed by the citation and [[n]].
4. RATIO DECIDENDI: For every case cited, explain the core principle (ratio decidendi) and how it directly applies to the current facts.
5. DISTINGUISH SOURCES: Mark statute sources as "Statutory Provision" and case sources as "Judicial Precedent" in your analysis.
6. ABSENCE: If no case precedents are found, state explicitly: "No direct matching precedents were found in the database."

OUTPUT REQUIREMENTS:
- **Case Strategy**: High-level defensive/offensive approach.
- **Precedential Authority**: List ALL case precedents with full "X vs Y" names, court, year, and ratio decidendi. This is the MOST IMPORTANT section.
- **Statutory Framework**: Relevant statutes and provisions.
- **Argument Examples**: Actionable oral/written argument snapshots citing [[n]].
- **Counter-Strategy**: Rebuttals based on the provided law and precedents.

Be professional, precise, and authoritative.
`;

                    const strategyIterator = await ai.models.generateContentStream({
                        model: selectedModel,
                        contents: [{ role: 'user', parts: [{ text: strategyPrompt }] }],
                        config: {
                            systemInstruction: "You are Juris. Build a winning strategy using ONLY the provided unified sources. Anchor every claim with accurate [[n]] citations."
                        }
                    });

                    for await (const chunk of strategyIterator) {
                        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            sendChunk({ t: text });
                        }
                    }

                    // Send final completion and metadata
                    sendChunk({ t: "\n\n---\n*Strategy generated with Precedent Hunter (Vaquill AI) and Juris statutory database.*" });

                    sendChunk({ m: { groundingChunks: unifiedChunks } });
                    controller.close();

                } catch (error: any) {
                    console.error("[Chat API] 3-Step process failed:", error.message);
                    sendChunk({ t: "⚠️ Juris is currently experiencing high load. Please try again in a moment." });
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('Error in Gemini route:', error.message || error);
        return NextResponse.json({ error: 'Failed to generate response', details: error.message }, { status: 500 });
    }
}


