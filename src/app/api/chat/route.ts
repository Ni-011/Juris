import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Initialize the new Gemini SDK with the key directly
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // Mapping messages to the format expected by the Gemini SDK
        const history = messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        const model = genAI.getGenerativeModel({
            model: 'gemini-3.1-flash-lite-preview',
            systemInstruction: `You are Juris, an expert AI legal research assistant designed specifically for Indian law practitioners. 
            
            Your core knowledge base is built upon the Constitution of India and the new criminal laws: 
            - Bharatiya Nyaya Sanhita (BNS) 
            - Bharatiya Nagarik Suraksha Sanhita (BNSS) 
            - Bharatiya Sakshya Adhiniyam (BSA)
            
            Always maintain a professional, precise, and authoritative tone suitable for a high-end law firm. 
            Cite specific sections, articles, and precedents where possible. 
            Most importantly, DO NOT HALLUCINATE. If you do not know the answer based on the Indian legal framework, say you are not certain and recommend consulting the specific Bare Act.`
        });

        const responseStream = await model.generateContentStream({
            contents: history,
        });

        // Create a readable stream to send chunks one-by-one to the frontend
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of responseStream.stream) {
                        // We encode the string to Uint8Array for the stream
                        controller.enqueue(new TextEncoder().encode(chunk.text()));
                    }
                    controller.close();
                } catch (streamError) {
                    console.error("Stream generation error:", streamError);
                    controller.error(streamError);
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('Error in Gemini route:', error);
        return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
    }
}
