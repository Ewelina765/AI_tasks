import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function Photos() {
    const apiKey = process.env.API_KEY;
    const answerUrl = process.env.ANSWER_URL!;
    const taskName = 'photos';
    const baseUrl = 'https://centrala.ag3nts.org/dane/barbara/';
    const images = ['IMG_559.PNG', 'IMG_1410.PNG', 'IMG_1443.PNG', 'IMG_1444.PNG'];

    try {
        // Start task
        const startResponse = await fetch(answerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: "START",
                apikey: apiKey,
                task: taskName,
            }),
        });

        const startResult = await startResponse.json();
        console.log("Odpowiedź z serwera (START):", startResult);

        // Prepare commands
        const commands = [
            "REPAIR IMG_559-small.PNG",
            "BRIGHTEN IMG_1410-small.PNG",
            "REPAIR IMG_1443-small.PNG",
        ];

        for (const command of commands) {
            const commandResponse = await fetch(answerUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    answer: command,
                    apikey: apiKey,
                    task: taskName,
                }),
            });

            const commandResult = await commandResponse.json();
            console.log(`Odpowiedź na komendę ${command}:`, commandResult);
        }

        // OpenAI System Message
        const systemMessage =
            "Based on the images, analyze the general characteristics of the person depicted in Polish. Describe notable features such as hairstyle, hair length and color, facial features (shape, any distinct characteristics), eye color, and general clothing style. Focus on visual details and ensure the description is neutral and detailed. Avoid making judgments or including information not directly derived from the visual material.";

        const imageUrls = [
            `${baseUrl}IMG_1443_FT12.PNG`,
            `${baseUrl}IMG_1410_FXER.PNG`,
            `${baseUrl}IMG_559_FGR4.PNG`,
        ];

        const responses = await Promise.all(imageUrls.map(async (image, index) => {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: systemMessage},
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

        const answer = responses
        .map(({imageIndex, answer}) => `Analiza obrazu ${imageIndex}:\n${answer}`)
        .join('\n\n');

        // Verify response with server
        const verifyResponse = await fetch(answerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: answer,
                apikey: apiKey,
                task: taskName,
            }),
        });

        const result = await verifyResponse.json();
        console.log("Odpowiedź z serwera (VERIFY):", result);

        return result;
    } catch (error) {
        console.error('Błąd:', error);
        throw error;
    }
}

Photos();
