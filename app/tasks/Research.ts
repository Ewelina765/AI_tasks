import dotenv from 'dotenv';
import { readdir, readFile, writeFile } from 'fs/promises';
import Openai from 'openai';
import { join } from 'path';
import fs from 'fs';

dotenv.config();
const openai = new Openai({ apiKey: process.env.OPENAI_API_KEY });


async function createTrainingFile() {
    const correctTxt = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S04E02/lab_data/correct.txt';
    const correctContent = await readFile(correctTxt, 'utf-8');
    const incorrectTxt = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S04E02/lab_data/incorrect.txt';
    const incorrectContent = await readFile(incorrectTxt, 'utf-8');
    const correctLines = correctContent.split('\n').filter(line => line.trim());
    const incorrectLines = incorrectContent.split('\n').filter(line => line.trim());
    console.log("correctLines", correctLines);

    const trainingData = [
        // Dodaj przykłady z correct.txt
        ...correctLines.map(line => ({
            messages: [
                { role: "system", content: "validate data" },
                { role: "user", content: line },
                { role: "assistant", content: "correct" }
            ]
        })),
        // Dodaj przykłady z incorrect.txt
        ...incorrectLines.map(line => ({
            messages: [
                { role: "system", content: "validate data" },
                { role: "user", content: line },
                { role: "assistant", content: "incorrect" }
            ]
        }))
    ];

    // Zapisz jako JSONL
    const jsonlContent = trainingData
        .map(item => JSON.stringify(item))
        .join('\n');

    const outputPath = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S04E02/lab_data/training_data.jsonl';
    await writeFile(outputPath, jsonlContent, 'utf-8');

    // Dodaj logi do weryfikacji
    console.log('Liczba przykładów treningowych:', trainingData.length);
    console.log('Przykładowy wpis:', trainingData[0]);
}
createTrainingFile()

async function uploadTrainingFile() {
    try {
        // Ścieżka do pliku JSONL z danymi treningowymi
        const trainingFilePath = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S04E02/lab_data/training_data.jsonl';
        if (!fs.existsSync(trainingFilePath)) {
            throw new Error('Plik treningowy nie istnieje!');
        }
        // Przesyłanie pliku do OpenAI
        const response = await openai.files.create({
            file: fs.createReadStream(trainingFilePath),
            purpose: 'fine-tune'
        });

        console.log('ID przesłanego pliku:', response.id);
        return response.id;
    } catch (error) {
        console.error('Błąd podczas przesyłania pliku:', error);
        throw error;
    }
}

async function fineTuneModel() {
    try {
        const fileId = await uploadTrainingFile();

        const response = await openai.fineTuning.jobs.create({
            training_file: fileId, // ID pliku treningowego, który wcześniej został przesłany
            model: "gpt-3.5-turbo", // bazowy model do fine-tuningu
            hyperparameters: {
                n_epochs: 3 // liczba epok treningowych
            },
            suffix: "custom-research-model" // opcjonalny suffix dla nazwy modelu
        });

        console.log("Status fine-tuningu:", response);
        return response;
    } catch (error) {
        console.error('Błąd podczas fine-tuningu:', error);
        throw error;
    }
}

// Dodaj nową funkcję do sprawdzania statusu
async function waitForFineTuning(jobId: string) {
    try {
        let status: string;
        let fineTunedModel: string | null = null;

        do {
            // Pobierz aktualny status
            const response = await openai.fineTuning.jobs.retrieve(jobId);
            status = response.status;
            fineTunedModel = response.fine_tuned_model;
            console.log('Status fine-tuningu:', status);

            if (status === 'failed') {
                throw new Error('Fine-tuning nie powiódł się');
            }

            if (status !== 'succeeded') {
                console.log('Czekam 30 sekund przed kolejnym sprawdzeniem...');
                await new Promise(resolve => setTimeout(resolve, 30000)); // Czekaj 30 sekund
            }

        } while (status !== 'succeeded');

        if (!fineTunedModel) {
            throw new Error('Nie otrzymano ID wytrenowanego modelu');
        }

        console.log('Fine-tuning zakończony sukcesem!');
        return fineTunedModel; // Zwróć ID wytrenowanego modelu
    } catch (error) {
        console.error('Błąd podczas oczekiwania na fine-tuning:', error);
        throw error;
    }
}

async function Research() {
    try {

        const apiKey = process.env.API_KEY;
        const answerUrl = process.env.ANSWER_URL!;
        const taskName = "research";

        await createTrainingFile();
        const fineTuneResponse = await fineTuneModel();
        console.log('Fine-tuning rozpoczęty:', fineTuneResponse);

        // Poczekaj na zakończenie fine-tuningu
        const fineTunedModelId = await waitForFineTuning(fineTuneResponse.id);
        console.log('ID wytrenowanego modelu:', fineTunedModelId);

        const verifyText = `
        01=12,100,3,39
        02=-41,75,67,-25
        03=78,38,65,2
        04=5,64,67,30
        05=33,-21,16,-72
        06=99,17,69,61  
        07=17,-42,-65,-43
        08=57,-83,-54,-43
        09=67,-55,-6,-32
        10=-20,-23,-2,44`


        const systemMessage = `
Otrzymałeś próbkę wyników badań. Na podstawie danych referencyjnych (poprawnych i niepoprawnych) zdecyduj, którym wynikom możemy zaufać. 
Wyniki mają identyfikatory na początku każdej linii (dwucyfrowy numer). 

Twoje zadanie:
1. sprawdz wszystkie wyniki pod wzgledem poprawnosci i odrzuc te niepoprawne 
2. zwroc id wynikow poprawnych w formacie surowej tablicy JSON, bez zadnych formatowan
Przykład odpowiedzi:
<response_example> [ "01", "02", "03", "0N" ] </response_example>
<thinking> 
</thinking>
`;

        const response = await openai.chat.completions.create({
            model: `ft:gpt-3.5-turbo-0125:personal:custom-research-model:AXyq8OAC`, // Format: ft:{base_model}:{suffix}
            messages: [
                {
                    role: "system",
                    content: systemMessage
                },
                {
                    role: "user",
                    content: verifyText
                }
            ],
        });


        let answer = response.choices[0].message.content;
        console.log("answer", answer);

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
    }

    catch (error) {
        console.error('Błąd podczas wykonywania funkcji Research:', error);
        throw error;
    }
}


Research()  