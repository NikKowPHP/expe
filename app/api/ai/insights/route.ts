import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const { expenses } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ insight: "Please configure your Gemini API Key to get insights." });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        const prompt = `
      Analyze the following expense data and provide a brief, helpful insight (2-3 sentences).
      Focus on spending trends or anomalies.
      
      Expenses:
      ${JSON.stringify(expenses)}
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ insight: text });
    } catch (error) {
        console.error('AI Insights failed:', error);
        return NextResponse.json({ insight: "Failed to generate insights." }, { status: 500 });
    }
}
