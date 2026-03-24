import axios from 'axios';

export interface VaquillSearchResult {
    id: string;
    title: string;
    caseName: string;
    citation: string;
    court: string;
    courtType: string;
    year: number | null;
    date: string;
    summary: string;
    snippet: string;
    score: number;
    // Rich metadata from Search endpoint
    pdfUrl: string;
    petitioner: string;
    respondent: string;
    judges: string[];
    disposition: string;
    pageStart: number | null;
    pageEnd: number | null;
}

/**
 * Search the Vaquill legal corpus using the /research/search endpoint.
 * Supports Boolean operators: AND, OR, NOT, quoted phrases, parentheses grouping.
 * Returns real case precedents with full metadata (petitioner vs respondent, court, judges, pdfUrl).
 */
export async function searchCases(query: string, limit: number = 10): Promise<VaquillSearchResult[]> {
    const apiKey = process.env.VAQUILL_API_KEY;
    if (!apiKey) {
        console.error("VAQUILL_API_KEY is not set in .env");
        return [];
    }

    const endpoint = 'https://api.vaquill.ai/api/v1/research/search';

    try {
        console.log(`[Vaquill Search] Query: "${query.substring(0, 80)}..." (limit: ${limit})`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                query,
                pageSize: limit,
                page: 1,
            }),
            cache: 'no-store' as RequestCache,
            signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Vaquill Search] HTTP ${response.status}: ${errorText.substring(0, 200)}`);
            return [];
        }

        const data = await response.json();
        const results = data?.data?.results || data?.results || (Array.isArray(data) ? data : []);

        if (results && results.length > 0) {
            console.log(`[Vaquill Search] Found ${results.length} case results.`);

            return results.map((r: any) => {
                const meta = r.metadata || r.meta || {};
                const petitioner = meta.petitioner || '';
                const respondent = meta.respondent || '';

                // Build a proper "X vs Y" case name from metadata if available
                let caseName = r.title || r.name || 'Judgment';
                const lowerName = caseName.toLowerCase();
                const hasVs = lowerName.includes(' vs ') || lowerName.includes(' v. ') || lowerName.includes(' versus ');

                if (petitioner && respondent && !hasVs) {
                    caseName = `${petitioner} vs ${respondent}`;
                }

                return {
                    id: r.id || '',
                    title: r.title || r.name || 'Judgment',
                    caseName,
                    citation: r.citation || r.case_number || 'N/A',
                    court: r.court || meta.court || 'Indian Court',
                    courtType: r.courtType || meta.courtType || '',
                    year: r.year || null,
                    date: r.date || meta.decisionDate || '',
                    summary: r.content || r.summary || r.text || '',
                    snippet: r.snippet || '',
                    score: r.score || 0,
                    // Rich metadata
                    pdfUrl: meta.pdfUrl || r.pdfUrl || '',
                    petitioner,
                    respondent,
                    judges: meta.judges || r.judges || [],
                    disposition: meta.disposition || r.disposition || '',
                    pageStart: meta.pageStart || null,
                    pageEnd: meta.pageEnd || null,
                };
            });
        }

        console.warn(`[Vaquill Search] No results found.`);
        return [];

    } catch (error: any) {
        console.error(`[Vaquill Search] Error:`, error.message);
        return [];
    }
}

// --- Ask Endpoint: Real AI-curated case precedents ---

export interface VaquillAskSource {
    sourceIndex: number;
    caseName: string;
    citation: string;
    court: string;
    courtType: string;
    year: number | null;
    excerpt: string;
    relevanceScore: number;
    judges: string[];
    decisionDate: string;
    pdfUrl: string;
    disposition: string;
    petitioner: string;
    respondent: string;
    pageStart: number | null;
    pageEnd: number | null;
}

export interface VaquillAskResult {
    answer: string;
    sources: VaquillAskSource[];
    questionInterpreted: string;
    mode: string;
}

/**
 * Ask a legal question via POST /api/v1/ask.
 * Returns an AI-generated answer grounded in real court judgments (20M+ cases)
 * with structured source citations (caseName, court, judges, pdfUrl, excerpt).
 * Cost: 0.5 credits (standard) / 2.5 credits (deep).
 */
export async function askLegalQuestion(
    question: string,
    maxSources: number = 8,
    mode: 'standard' | 'deep' = 'standard'
): Promise<VaquillAskResult> {
    const apiKey = process.env.VAQUILL_API_KEY;
    if (!apiKey) {
        console.error("VAQUILL_API_KEY is not set in .env");
        return { answer: '', sources: [], questionInterpreted: '', mode };
    }

    console.log(`[Vaquill Ask] Question: "${question.substring(0, 80)}..." (mode: ${mode}, maxSources: ${maxSources})`);

    const payload = JSON.stringify({ question, mode, sources: true, maxSources });

    try {
        // Use Node.js native https to bypass Next.js fetch patching
        const https = require('https');
        const responseText = await new Promise<string>((resolve, reject) => {
            const req = https.request({
                hostname: 'api.vaquill.ai',
                path: '/api/v1/ask',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(payload),
                },
                timeout: 90000,
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => resolve(data));
            });
            req.on('error', (err: any) => {
                console.error('[Vaquill Ask] req error:', err.message);
                reject(err);
            });
            req.on('timeout', () => {
                console.error('[Vaquill Ask] req timeout');
                req.destroy();
                reject(new Error('Request timed out'));
            });
            req.write(payload);
            req.end();
        });

        console.log(`[Vaquill Ask] Response length: ${responseText.length} chars`);
        const json = JSON.parse(responseText);
        const data = json?.data || json;

        const sources: VaquillAskSource[] = (data.sources || []).map((s: any) => ({
            sourceIndex: s.sourceIndex || 0,
            caseName: s.caseName || 'Unknown Case',
            citation: s.citation || 'N/A',
            court: s.court || '',
            courtType: s.courtType || '',
            year: s.year || null,
            excerpt: s.excerpt || '',
            relevanceScore: s.relevanceScore || 0,
            judges: s.judges || [],
            decisionDate: s.decisionDate || '',
            pdfUrl: s.pdfUrl || '',
            disposition: s.disposition || '',
            petitioner: s.petitioner || '',
            respondent: s.respondent || '',
            pageStart: s.pageStart || null,
            pageEnd: s.pageEnd || null,
        }));

        console.log(`[Vaquill Ask] Got ${sources.length} case sources: ${sources.map(s => s.caseName).join(', ')}`);

        return {
            answer: data.answer || '',
            sources,
            questionInterpreted: data.questionInterpreted || '',
            mode: data.mode || mode,
        };

    } catch (error: any) {
        console.error(`[Vaquill Ask] Error:`, error.message?.substring(0, 300));
        return { answer: '', sources: [], questionInterpreted: '', mode };
    }
}
