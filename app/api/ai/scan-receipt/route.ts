import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const { image, categories } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Gemini API Key not configured" }, { status: 500 });
        }

        // Use gemini-1.5-flash for speed and multimodal capabilities
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
            Analyze this receipt image. Extract the following information:
            1. Total Amount (number)
            2. Date (ISO string, e.g., "2023-12-25")
            3. Merchant/Note (string)
            4. Category ID (string) - Suggest the best matching category ID from the provided list.

            Categories List:
            ${JSON.stringify(categories.map((c: any) => ({ id: c.id, name: c.name })))}

            Return ONLY a JSON object with keys: amount, date, note, category_id.
            If a field cannot be found, use null.
        `;

        // image is expected to be base64 string without data:image/jpeg;base64, prefix
        // or we handle it here. Let's assume the client sends the full data url or we strip it.
        // The API expects "inlineData".
        
        const base64Data = image.split(',')[1] || image;
        const mimeType = image.split(';')[0].split(':')[1] || 'image/jpeg';

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        return NextResponse.json(data);
    } catch (error) {
        console.error('Receipt scan failed:', error);
        return NextResponse.json({ error: "Failed to scan receipt" }, { status: 500 });
    }
}
