import { NextResponse } from 'next/server';
import { GeminiClient } from '@/lib/gemini';

const client = new GeminiClient();

export async function POST(req: Request) {
    try {
        const { expenses } = await req.json();



        const prompt = `
      Analyze the following expense data and provide a brief, helpful insight (2-3 sentences).
      Focus on spending trends or anomalies.
      
      Expenses:
      ${JSON.stringify(expenses)}
    `;

        const text = await client.generateContent(
            prompt,
            undefined,
            { model: process.env.GEMINI_LARGE_MODEL}
        );

        return NextResponse.json({ insight: text });
    } catch (error) {
        console.error('AI Insights failed:', error);
        return NextResponse.json({ insight: "Failed to generate insights." }, { status: 500 });
    }
}
