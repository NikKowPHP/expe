import { NextResponse } from 'next/server';
import { GeminiClient } from '@/lib/gemini';

const client = new GeminiClient();

export async function POST(req: Request) {
  try {
    const { note, categories } = await req.json();



    if (!note || !categories) {
      return NextResponse.json({ category_id: null }, { status: 400 });
    }

    const prompt = `
You are a smart expense categorizer.
Map the following expense note to one of the provided categories.

Note: "${note}"

Categories:
${JSON.stringify(categories)}

Return ONLY the "id" of the best matching category. If unsure, return "other".
Do not include any other text or JSON formatting.
    `.trim();

    const text = await client.generateContent(
      prompt,
      undefined,
      { model: process.env.GEMINI_LARGE_MODEL || 'gemini-1.5-flash' }
    );

    const result = (text ?? '').trim().replace(/['"]/g, '');

    return NextResponse.json({ category_id: result });
  } catch (error) {
    console.error('Category suggestion failed:', error);
    return NextResponse.json({ category_id: null }, { status: 500 });
  }
}
