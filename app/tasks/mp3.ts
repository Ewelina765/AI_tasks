import OpenAI from "openai";
import dotenv from 'dotenv';
import askOpenAI from '../../askOpenAi';
import fs from "fs";
import path from "path";
dotenv.config();

async function Mp3() {
  const apikey = process.env.API_KEY
  const answerUrl = process.env.ANSWER_URL
  const taskName = "mp3"
  const question = "What street is the university where Andrzej Maj lectures?"
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {

    const files = [
      "/Users/ewelinakuzniewska/Downloads/przesluchania/adam.m4a",
      "/Users/ewelinakuzniewska/Downloads/przesluchania/agnieszka.m4a",
      "/Users/ewelinakuzniewska/Downloads/przesluchania/ardian.m4a",
      "/Users/ewelinakuzniewska/Downloads/przesluchania/michal.m4a",
      "/Users/ewelinakuzniewska/Downloads/przesluchania/monika.m4a",
      "/Users/ewelinakuzniewska/Downloads/przesluchania/rafal.m4a"
    ];
    const CACHE_FILE = 'transcriptions_cache.json';

    let allTranscriptions = '';

    if (fs.existsSync(CACHE_FILE)) {
      console.log('Używam zapisanych transkrypcji z cache...');
      allTranscriptions = fs.readFileSync(CACHE_FILE, 'utf8');
    } else {
      console.log('Tworzę nowe transkrypcje...');

      for (const filePath of files) {
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(filePath),
          model: "whisper-1",
        });

        allTranscriptions += `\n=== Zeznanie z pliku ${path.basename(filePath)} ===\n`;
        allTranscriptions += transcription.text + '\n';
      }

      // Zapisz transkrypcje do pliku cache
      fs.writeFileSync(CACHE_FILE, allTranscriptions, 'utf8');
    }

    // const systemMessage = `za pomoca kilku tekstów audio odpowiedz na pytanie. Nazwa ulicy nie pada w treści transkrypcji - Musisz domyslic sie z kontekstu wypowiedzi, a najbardziej wiarygodna jest wypowiedz Rafała. opisz swój tok myślenia. Nie jest to ul. Gołębia w Krakowie. Plik zródłowy: ${allTranscriptions}`

    // const answer = await askOpenAI(question, systemMessage);
    // console.log("answer", answer)


  //   const verifyResponse = await fetch(answerUrl!, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       task: taskName,
  //       apikey: apikey,
  //       answer: answer,
  //     }),
  //   });
  //   const result = await verifyResponse.json();
  //   console.log("Odpowiedź z weryfikacji:", result);
  }

  catch (error) {
    console.error("Wystąpił błąd:", error);
  }
}

Mp3();


