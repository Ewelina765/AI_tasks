import { readFile } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function processImage(imagePath: string): Promise<{ file: string, text: string }> {
    const fileData = await readFile(imagePath); // fileData to Buffer - surowe dane binarne pliku
    const base64Image = fileData.toString('base64'); // Konwertuje Buffer na string w formacie Base64

    //Dlaczego używamy Base64? Bezpieczne przesyłanie plików binarnych jako tekst.Kompatybilność z API, które przyjmują tylko tekstMożliwość osadzania obrazów bezpośrednio w HTML/JSON

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: "You are an OCR assistant. Extract text from the image. If the text is unreadable or there is no text, respond with 'no text'. Only return the extracted text, nothing else."
            },
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`,
                            detail: "high"
                        }
                    } as const
                ]
            }
        ],
        max_tokens: 1024
    });

    return {
        file: imagePath,
        text: response.choices[0].message.content || 'no text'
    };


}

// Przykład użycia
const imagePath = join(process.cwd(), 'public/IMG_3471.jpeg'); // Dostosuj ścieżkę do swojego pliku
const result = await processImage(imagePath);
console.log(result);
