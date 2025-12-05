import { NextResponse } from 'next/server';
import { GeminiClient } from '@/lib/gemini';

const client = new GeminiClient();

export async function POST(req: Request) {
  try {


    const { image, categories, subcategories } = await req.json();

    if (!image || !categories) {
      return NextResponse.json(
        { error: 'Missing image or categories' },
        { status: 400 }
      );
    }

    const categoryList = categories.map((c: { id: string; name: string }) => ({
      id: c.id,
      name: c.name,
    }));

    const subcategoryList = subcategories ? subcategories.map((s: { id: string; name: string; category_id: string }) => ({
      id: s.id,
      name: s.name,
      category_id: s.category_id,
    })) : [];

    // --- Stage 1: parse base64 and upload as File ---

    const imageStr = String(image);

    // Expecting data URL "data:image/jpeg;base64,XXXX" but also works if it's plain base64
    const [meta, base64Part] = imageStr.split(',');

    let mimeType = 'image/jpeg';
    const mimeMatch = meta?.match(/data:(.+);base64/);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1];
    }

    const base64Data = base64Part || imageStr;
    const buffer = Buffer.from(base64Data, 'base64');

    const uploadedFile = await client.uploadFile(buffer, mimeType);
    const fileUri = uploadedFile.uri;

    // --- Stage 2: call model with fileUri and prompt ---

    const prompt = `
Analyze this receipt image (which might be in Polish or English).

Extract the Merchant Name and the Date.
Then, extract EVERY single purchased item as a separate line item.

For each item:
1. Extract the Item Name (description).
2. Extract the Item Price (amount). Ensure you parse commas as decimals (e.g., 3,99 becomes 3.99).
3. Select the most appropriate Category ID from the provided list.
4. Select the most appropriate "Subcategory Name" from the list of existing subcategories for the chosen Category ID. 
   - If an existing subcategory fits well, use its EXACT name.
   - If NO existing subcategory fits, create a new, short, generic "Subcategory Name" (e.g., from "Whole Grain Bread 500g" extract "Bread").

Categories List:
${JSON.stringify(categoryList)}

Existing Subcategories List:
${JSON.stringify(subcategoryList)}

Return ONLY a JSON object with this structure:
{
  "merchant": "Store Name",
  "date": "YYYY-MM-DD",
  "items": [
    { 
      "description": "Milk", 
      "amount": 2.99, 
      "category_id": "uuid...",
      "subcategory_name": "Dairy" 
    },
    { 
      "description": "Fancy Bread", 
      "amount": 1.50, 
      "category_id": "uuid...",
      "subcategory_name": "Bread" 
    }
  ]
}
    `.trim();

    const text = await client.generateContent(
      prompt,
      { uri: fileUri, mimeType },
      { model: 'gemini-flash-latest' }
    );

    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(jsonStr);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Receipt scan failed:', error);
    return NextResponse.json(
      { error: 'Failed to scan receipt' },
      { status: 500 }
    );
  }
}
