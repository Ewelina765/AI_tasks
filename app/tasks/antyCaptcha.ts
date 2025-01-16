import OpenAI from "openai";
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
import dotenv from 'dotenv';
dotenv.config();

// Tak, to jest funkcja która próbuje pobrać dane z URL loginUrl poprzez fetch.
// Sprawdza czy odpowiedź jest poprawna (response.ok) i wyświetla ją w konsoli.
// W przypadku błędu rzuca wyjątek z informacją o statusie HTTP.
async function askOpenAI(question: string) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "user",
                    content: question
                }, {
                    role: "system",
                    content: "answer only with year, just number without any other words"
                }
            ],
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("Błąd podczas komunikacji z OpenAI:", error);
        throw error;
    }
}

async function antyCaptcha() {
    const loginUrl = "https://xyz.ag3nts.org";
    const apikey = process.env.NEXT_PUBLIC_API_KEY


    try {

        const response = await fetch(loginUrl);

        if (!response.ok) {
            throw new Error(`Błąd HTTP! Status: ${response.status}`);
        }

        // Pobieramy treść jako tekst zamiast JSON
        const htmlContent = await response.text();
        // console.log("Treść HTML:", htmlContent);
        const questionMatch = htmlContent.match(/<p id="human-question">Question:<br \/>(.*?)<\/p>/);
        const question = questionMatch ? questionMatch[1] : null;
        // console.log("Pytanie:", question);
        if (question) {
            const answer = await askOpenAI(question);
            // console.log("Odpowiedź OpenAI:", answer);



            const verifyResponse = await fetch(loginUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    answer: answer ?? '',
                    username: "tester",
                    password: "574e112a"
                }).toString(),
            });

            const responseText = await verifyResponse.text();
            // console.log("Status odpowiedzi:", verifyResponse.status);
            // console.log("Nagłówki odpowiedzi:", Object.fromEntries(verifyResponse.headers));
            console.log("Odpowiedź z serwera:", responseText);

            // Pobieramy plik firmware
            const firmwareUrl = "https://xyz.ag3nts.org/files/0_13_4b.txt";
            const firmwareResponse = await fetch(firmwareUrl);
            const firmwareContent = await firmwareResponse.text();
            console.log("Zawartość pliku firmware:", firmwareContent);

        }

    } catch (error) {
        console.error("Wystąpił błąd:", error);
    }
}

// Wywołanie funkcji
antyCaptcha();


