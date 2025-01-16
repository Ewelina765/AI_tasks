// import OpenAI from "openai";
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
import dotenv from 'dotenv';
dotenv.config();

async function fetchAndSendData() {
  const url = "https://POLIGON.aidevs.pl/dane.txt";
  const verifyUrl = "https://poligon.aidevs.pl/verify";
  const taskName = "POLIGON";
  const apiKey = process.env.API_KEY;


  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Błąd HTTP! Status: ${response.status}`);
    }

    const data = await response.text();

    const dataArray = data.trim().split(/\s+/);

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: taskName,
        apikey: apiKey,
        answer: dataArray,
      }),
    });

   

    const result = await verifyResponse.json();
    console.log("Odpowiedź z weryfikacji:", result);
  } catch (error) {
    console.error("Wystąpił błąd podczas pobierania danych:", error);
  }
}

// Wywołanie funkcji
fetchAndSendData();


