import OpenAI from "openai";
import dotenv from 'dotenv';
import askOpenAI from '../../askOpenAi';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
dotenv.config();

// Utwórz odpowiednik __dirname dla modułów ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function Vision() {
    const question = "Podpowiedź: Miasto to posiada spichlerze i twierdze. Nie jest to Gdańsk ANI TORUŃ. Pamiętaj, że jeden z fragmentów mapy może być błędny i może pochodzić z innego miasta."
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        // Ścieżki do zdjęć map
        const imageFiles = [
            path.join(__dirname, '../../public/IMG_3471.jpeg'),
            path.join(__dirname, '../../public/IMG_3472.jpeg'),
            path.join(__dirname, '../../public/IMG_3473.jpeg'),
            path.join(__dirname, '../../public/IMG_3474.jpeg')
        ];

        // Najpierw sprawdź, czy wszystkie pliki istnieją
        for (const file of imageFiles) {
            if (!fs.existsSync(file)) {
                console.log(`Próbuję znaleźć plik w: ${file}`);
                throw new Error(`Brak pliku: ${file}`);
            }
        }

        // Jeśli wszystkie pliki istnieją, kontynuuj przetwarzanie
        const imageContents = await Promise.all(imageFiles.map(async (file) => {
            const imageBuffer = await fs.promises.readFile(file);
            return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        }));

        const responses = await Promise.all(imageContents.map(async (image, index) => {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: question },
                            {
                                type: "image_url",
                                image_url: {
                                    url: image,
                                    detail: "high"
                                }
                            } as const
                        ]
                    }
                ],
                max_tokens: 500
            });
            return {
                imageIndex: index + 1,
                answer: response.choices[0].message.content
            };
        }));

        responses.forEach(({imageIndex, answer}) => {
            console.log(`\nAnaliza obrazu ${imageIndex}:`);
            console.log(answer);
        });

    }
    catch (error) {
        console.error("Wystąpił błąd:", error);
    }
}

Vision();
