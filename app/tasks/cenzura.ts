import OpenAI from "openai";
import dotenv from 'dotenv';
import askOpenAI from '../../askOpenAi';

dotenv.config();

async function Cenzura() {
    const loginUrl = `https://centrala.ag3nts.org/data/${process.env.API_KEY}/cenzura.txt`;
    const apikey = process.env.API_KEY
    const answerUrl = process.env.ANSWER_URL
    const taskName = "CENZURA"
    const prompt = "Replace any sensitive data (name + surname, city, street name + number, age of the person) with the word CENZURA.You are not allowed to reword the text so everything else must remain the same."

    try {
        const response = await fetch(loginUrl);

        if (!response.ok) {
            throw new Error(`Błąd HTTP! Status: ${response.status}`);
        }

        const htmlContent = await response.text();
        console.log("Treść HTML:", htmlContent);

        const answer = await askOpenAI(htmlContent, prompt);

        console.log("answer", answer)

        const verifyResponse = await fetch(answerUrl!, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
              task: taskName,
              apikey: apikey,
              answer: answer,
            }),
          });   
          const result = await verifyResponse.json();
          console.log("Odpowiedź z weryfikacji:", result);
    

    } catch (error) {
        console.error("Wystąpił błąd:", error);
    }
}

Cenzura();


