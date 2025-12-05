import { NextResponse } from 'next/server';
import { GeminiClient } from '@/lib/gemini';

const client = new GeminiClient();

export async function POST(req: Request) {
    try {
        const { expenses, categories, subcategories } = await req.json();

        // Prepare data for AI: aggregate by category
        // We do this server-side or pass pre-aggregated if the client did it.
        // For now, let's assume we pass a simplified list to avoid token limits.
        // Or we pass the raw data if it's small enough. The user said "all the user data".
        // Let's rely on the client to send a reasonable amount or we truncate.

        const prompt = `
        You are a financial advisor. Analyze the following expense data.
        
        Data provided:
        1. List of Expenses (Date, Amount, Category, Subcategory, Description)
        
        Your Goal:
        Provide a structured audit report with:
        1. "optimizations": A list of specific actionable advice (e.g., reduce dining out, cancel unused subscription). Each should have a title, description, and potential_savings.
        2. "overall_score": A score from 0-100 on financial health based on this data.
        3. "summary": A brief paragraph summarizing the spending habits.

        Return ONLY valid JSON in the following format:
        {
            "optimizations": [
                {
                    "title": "Stop eating out",
                    "description": "You spent $500 on restaurants.",
                    "impact": "High"
                }
            ],
            "overall_score": 75,
            "summary": "You are doing well but..."
        }

        Expenses Data:
        ${JSON.stringify(expenses).substring(0, 30000)} 
        `; // Cap input to ~30k chars to be safe-ish with limits if large

        const text = await client.generateContent(
            prompt,
            undefined,
            { model: process.env.GEMINI_LARGE_MODEL , generationConfig: { response_mime_type: "application/json" } }
        );

        return NextResponse.json(JSON.parse(text));
    } catch (error) {
        console.error('AI Audit failed:', error);
        return NextResponse.json({ error: "Failed to generate audit." }, { status: 500 });
    }
}
