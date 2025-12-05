import { NextResponse } from 'next/server';
import { GeminiClient } from '@/lib/gemini';

const client = new GeminiClient();

export async function POST(req: Request) {
    try {
        const { expenses } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ insight: "Please configure your Gemini API Key to get insights." });
        }

        const prompt = `
      Analyze the following expense data and provide a brief, helpful insight (2-3 sentences).
      Focus on spending trends or anomalies.
      
      Expenses:
      ${JSON.stringify(expenses)}
    `;

        const text = await client.generateContent(
            prompt,
            undefined,
            { model: 'gemini-1.5-flash' }
        );

        return NextResponse.json({ insight: text });
    } catch (error) {
        console.error('AI Insights failed:', error);
        return NextResponse.json({ insight: "Failed to generate insights." }, { status: 500 });
    }
}
