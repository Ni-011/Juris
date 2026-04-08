import { NextResponse } from 'next/server';
import HTMLToDocx from 'html-to-docx';

export async function POST(req: Request) {
    try {
        const { html } = await req.json();

        if (!html) {
            return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
        }

        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
        
        const docBlob = await HTMLToDocx(fullHtml, null, {
            table: { row: { cantSplit: true } },
            footer: true,
            pageNumber: true,
        });

        return new NextResponse(docBlob, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': 'attachment; filename="Legal_Draft_Juris.docx"',
            },
        });
    } catch (error: any) {
        console.error('[Docx Export API] Error:', error.message);
        return NextResponse.json({ error: 'Failed to generate Word document' }, { status: 500 });
    }
}
