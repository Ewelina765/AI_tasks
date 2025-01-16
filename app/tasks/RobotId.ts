import OpenAI from "openai";

import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function generateAndSendImage() {

    const fetchUrl = process.env.ROBOTID_TASK_URL;
    const answerUrl = process.env.ANSWER_URL!;
    const apiKey = process.env.API_KEY!;

    try {

        const response = await fetch(fetchUrl!);

        if (!response.ok) {
            throw new Error(`Błąd HTTP! Status: ${response.status}`);
        }

        const data = await response.json();
        const robotDescription = data.description; // Wyciągamy opis z obiektu

        console.log("opis robota", robotDescription);

        // Generowanie obrazu
        const generateImage = await openai.images.generate({
            model: "dall-e-3",
            prompt: robotDescription,
            n: 1,
            size: "1024x1024",
        });

        const imageData = generateImage.data[0].url;

        // Wysyłanie odpowiedzi na answerUrl
        const verifyResponse = await fetch(answerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: imageData,
                apikey: apiKey,
                task: "robotId"
            }),
        });

        const result = await verifyResponse.json();
        console.log("Odpowiedź z serwera:", result);
        return result;

    } catch (error) {
        console.error("Błąd:", error);
        throw error;
    }
}



await generateAndSendImage();


