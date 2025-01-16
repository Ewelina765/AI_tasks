import dotenv from 'dotenv';

dotenv.config();

async function Webhook() {
    const apiKey = process.env.API_KEY!;
    const answerUrl = process.env.ANSWER_URL!

    try {
        const response = await fetch(answerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apikey: apiKey,
                answer: "https://azyl-50350.ag3nts.org/moje_api",
                task: "webhook"
            })
        });

        const result = await response.json();
        console.log('Odpowiedź z centrali:', result);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

Webhook()
