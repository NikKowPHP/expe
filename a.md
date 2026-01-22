<reasoning>
The user is reporting that the receipt scanning AI incorrectly identifies discounts (specifically "OPUST" in Polish receipts) as separate items/categories instead of applying the discount to the item's price.

To fix this, I need to update the prompt sent to the Gemini AI in `app/api/ai/scan-receipt/route.ts`. I will explicitly instruct the AI to:
1.  Identify discount lines (like "OPUST", "RABAT", "Discount").
2.  Subtract the discount amount from the preceding item's price to get the final net amount.
3.  Prohibit creating separate line items for these discounts.
4.  Provide a concrete example in the prompt logic (e.g., 5.38 - 1.62 = 3.76).

I will also create a `TASKS.md` file to track this task as per the interaction model.
</reasoning>

<modifications>
    <file path="app/api/ai/scan-receipt/route.ts">
      <![CDATA[
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

Extract the Merchant Name.
Then, extract EVERY single purchased item as a separate line item.

CRITICAL INSTRUCTION FOR DISCOUNTS (e.g., "OPUST", "RABAT", "DISCOUNT"):
- Receipts often list an item, followed immediately by a line saying "OPUST", "RABAT", or "Discount" with a negative value.
- You MUST calculate the NET price for that item: (Item Price) - (Discount Amount).
- Use this NET price as the item's "amount".
- Do NOT create a separate line item for the "OPUST" or "Discount".
- Do NOT create a separate category for "OPUST".
- Example: If you see "Beans ... 5.38" followed by "OPUST ... -1.62", output ONE item "Beans" with amount 3.76.

For each item:
1. Extract the Item Name (description).
2. Extract the FINAL Item Price (amount) after applying any specific discounts found below the line. Ensure you parse commas as decimals (e.g., 3,99 becomes 3.99).
3. Select the most appropriate Category from the provided list.
   - If an existing category fits well, use its "category_id".
   - If NO existing category fits, provide a short, generic "new_category_name" (e.g., "Electronics", "Pet Supplies") and set "category_id" to null.
4. Select the most appropriate "Subcategory Name" from the list of existing subcategories for the chosen Category (if any). 
   - If an existing subcategory fits well, use its EXACT name.
   - If NO existing subcategory fits, create a new, short, generic "Subcategory Name" (e.g., from "Whole Grain Bread 500g" extract "Bread").

Categories List:
${JSON.stringify(categoryList)}

Existing Subcategories List:
${JSON.stringify(subcategoryList)}

Return ONLY a JSON object with this structure:
{
  "merchant": "Store Name",
  "items": [
    { 
      "description": "Milk", 
      "amount": 2.99, 
      "category_id": "uuid...",
      "new_category_name": null,
      "subcategory_name": "Dairy" 
    },
    { 
      "description": "New TV", 
      "amount": 299.99, 
      "category_id": null,
      "new_category_name": "Electronics",
      "subcategory_name": "TVs" 
    }
  ]
}
    `.trim();

    const text = await client.generateContent(
      prompt,
      { uri: fileUri, mimeType },
      { model: process.env.GEMINI_LARGE_MODEL || 'gemini-1.5-flash' }
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
      ]]>
    </file>
    <file path="TASKS.md">
      <![CDATA[
- [x] Fix AI receipt scanning to handle discounts (OPUST/RABAT) by merging them into the item price instead of creating separate items.
      ]]>
    </file>
</modifications>