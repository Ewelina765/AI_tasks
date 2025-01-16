import dotenv from 'dotenv';

dotenv.config();

async function sendAnswers(answer: any, taskName?: string) {
    const answerUrl = process.env.ANSWER_URL!;
    const apiKey = process.env.API_KEY!;
    try {
        const verifyResponse = await fetch(answerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: answer,
                apikey: apiKey,
                task: taskName
            }),
        });
        
        const result = await verifyResponse.json();
        console.log("Odpowiedź z serwera:", result);
        return result;
    } catch (error) {
        console.error("Błąd podczas wysyłania odpowiedzi:", error);
        throw error;
    }
}

export default sendAnswers;