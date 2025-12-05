import { NextResponse } from 'next/server';
import { GeminiClient } from '@/lib/gemini';

const client = new GeminiClient();

export async function POST(req: Request) {
    try {
        const { descriptions, categories } = await req.json();



        // Create a clean list of categories for the AI
        const categoryList = categories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));

        const prompt = `
            You are an expense classifier. 
            I will provide a list of transaction descriptions. 
            For EACH description, select the most appropriate Category ID from the provided list.
            
            Categories: ${JSON.stringify(categoryList)}
            
            Descriptions to classify: ${JSON.stringify(descriptions)}
            
            Return a JSON object where the keys are the exact descriptions provided, and the values are the chosen Category IDs.
            If a description is completely ambiguous, use the ID for "Other" or null.
        `;

        const text = await client.generateContent(
            prompt,
            undefined,
            { 
                model: process.env.GEMINI_LARGE_MODEL,
                generationConfig: { responseMimeType: "application/json" }
            }
        );
        
        // Parse the JSON response
        const mapping = JSON.parse(text);

        return NextResponse.json({ mapping });
    } catch (error) {
        console.error('Batch AI Categorization failed:', error);
        return NextResponse.json({ mapping: {} }, { status: 500 });
    }
}
