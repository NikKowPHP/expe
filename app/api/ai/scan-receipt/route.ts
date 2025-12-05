import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const { image, categories } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "Gemini API Key not configured" }, { status: 500 });
        }

        const model = genAI.getGenerativeModel({ model: 'models/gemini-flash-latest' });

        const categoryList = categories.map((c: any) => ({ id: c.id, name: c.name }));

        const prompt = `
            Analyze this receipt image (which might be in Polish or English).
            
            Extract the Merchant Name and the Date.
            Then, extract EVERY single purchased item as a separate line item.
            
            For each item:
            1. Extract the Item Name (description).
            2. Extract the Item Price (amount). Ensure you parse commas as decimals (e.g., 3,99 becomes 3.99).
            3. Select the most appropriate Category ID from the provided list.

            Categories List:
            ${JSON.stringify(categoryList)}

            Return ONLY a JSON object with this structure:
            {
                "merchant": "Store Name",
                "date": "YYYY-MM-DD",
                "items": [
                    { "description": "Milk", "amount": 2.99, "category_id": "uuid..." },
                    { "description": "Bread", "amount": 1.50, "category_id": "uuid..." }
                ]
            }
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

        console.log('text from image', text);
        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        return NextResponse.json(data);
    } catch (error) {
        console.error('Receipt scan failed:', error);
        return NextResponse.json({ error: "Failed to scan receipt" }, { status: 500 });
    }
}
