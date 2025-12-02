import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const { note, categories } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ category_id: null });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        const prompt = `
      You are a smart expense categorizer.
      Map the following expense note to one of the provided categories.
      
      Note: "${note}"
      
      Categories:
      ${JSON.stringify(categories)}
      
      Return ONLY the "id" of the best matching category. If unsure, return "other".
      Do not include any other text or JSON formatting.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim().replace(/['"]/g, '');

        return NextResponse.json({ category_id: text });
    } catch (error) {
        console.error('AI Categorization failed:', error);
        return NextResponse.json({ category_id: null }, { status: 500 });
    }
}
