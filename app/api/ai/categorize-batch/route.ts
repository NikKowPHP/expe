import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const { descriptions, categories } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ mapping: {} });
        }

        // Use Flash model for speed and higher rate limits
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            generationConfig: { responseMimeType: "application/json" } 
        });

        // Create a clean list of categories for the AI
        const categoryList = categories.map((c: any) => ({ id: c.id, name: c.name }));

        const prompt = `
            You are an expense classifier. 
            I will provide a list of transaction descriptions. 
            For EACH description, select the most appropriate Category ID from the provided list.
            
            Categories: ${JSON.stringify(categoryList)}
            
            Descriptions to classify: ${JSON.stringify(descriptions)}
            
            Return a JSON object where the keys are the exact descriptions provided, and the values are the chosen Category IDs.
            If a description is completely ambiguous, use the ID for "Other" or null.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Parse the JSON response
        const mapping = JSON.parse(text);

        return NextResponse.json({ mapping });
    } catch (error) {
        console.error('Batch AI Categorization failed:', error);
        return NextResponse.json({ mapping: {} }, { status: 500 });
    }
}
