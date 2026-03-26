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
