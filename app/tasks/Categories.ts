import OpenAI from "openai";
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';


import dotenv from 'dotenv';
import { createReadStream } from "fs";
import askOpenAI from "../../askOpenAi";

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function Categories() {

    const answerUrl = process.env.ANSWER_URL!;
    const apiKey = process.env.API_KEY!;
    const taskName = "kategorie";

    try {

        const dataFolder = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S02S04/pliki_z_fabryki';
        const files = await readdir(dataFolder);

        //mp3 files
        let allTranscriptions = '';
        const mp3Files = files.filter(file => file.toLowerCase().endsWith('.mp3'));

        for (const mp3File of mp3Files) {
            const filePath = join(dataFolder, mp3File); // Tworzymy pełną ścieżkę do pliku
            const fileStream = createReadStream(filePath); // Tworzymy strumień pliku

            const transcription = await openai.audio.transcriptions.create({
                file: fileStream,
                model: "whisper-1",
            });

            allTranscriptions += `\n=== Zeznanie z pliku ${mp3File} ===\n${transcription.text}\n`;
        }

        //txt files
        const txtFiles = files.filter(file => file.toLowerCase().endsWith('.txt'));
        let txtContent = '';

        for (const txtFile of txtFiles) {
            const filePath = join(dataFolder, txtFile);
            const content = await fs.readFile(filePath, 'utf-8');
            txtContent += `\n=== Zeznanie z pliku ${txtFile} ===\n${content}\n`


        }

        //png files
        const pngFiles = files.filter(file => file.toLowerCase().endsWith('.png'));
        const prompt = "Read text from ALL images. you dont need to add REPAIR NOTE, FROM: Repair department, APPROVED BY Joseph N. <thinking>";
        let pngContent = '';

        for (const pngFile of pngFiles) {
            const filePath = join(dataFolder, pngFile);
            const imageBuffer = await fs.readFile(filePath);
            const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: {
                                    url: base64Image,
                                    detail: "high"
                                }
                            } as const
                        ]
                    }
                ],
                max_tokens: 500
            });

            pngContent += `\n=== Zeznanie z pliku ${pngFile} ===\n${response.choices[0].message.content}\n`

        }

        const userMessage = txtContent + pngContent + allTranscriptions;
        const systemMessage = `<objective>Z podanych danych wywnioskuj które notatki zawierają informacje o schwytanych ludziach lub o śladach ich obecności oraz o naprawionych usterkach hardwarowych.<objective>
         <rules>
         -jesli notatki nie zawieraja takich informacji to je pomiń.
         -pomiń te związane z softem
         -notatki zawierające potrzebne dane odpowiednio skategoryzuj (people, hardware)
         -zapisz nazwe pliku w formacie json.
         -zwroc czysty json, bez dodatkowych tekstów.
         </rules>
         <example>
{
  "people": ["plik1.txt", "plik2.mp3", "plikN.png"],
  "hardware": ["plik4.txt", "plik5.png", "plik6.mp3"]
}
        </example>`
            ;

        const answer = await askOpenAI(userMessage, systemMessage);

        console.log("answer", answer);
        const parsedAnswer = JSON.parse(answer!);
        const verifyResponse = await fetch(answerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: parsedAnswer,
                apikey: apiKey,
                task: taskName
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



await Categories();


