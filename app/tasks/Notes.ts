import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { readFile } from 'fs/promises';


import askOpenAI from "../../askOpenAi";
import OpenAI from 'openai';
import sendAnswers from '../../sendAnswer';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

const execAsync = promisify(exec);
//zamieniam pdf na text, obraz z pdfu analizuje za pomocą gpt na text, a nastepnie wysyłam do analizy i odpowiedzi na pytania do chata

//konwersja pdf do obrazów
async function extractImagesFromPdf(pdfPath: string, outputDir: string): Promise<string[]> {
    try {
        // Upewnij się, że katalog wyjściowy istnieje
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Najpierw sprawdź informacje o obrazach na stronie 19
        console.log('Sprawdzam obrazy na stronie 19:');
        const { stdout: imageInfo } = await execAsync(`pdfimages -list -f 19 -l 19 "${pdfPath}"`);
        console.log('Informacje o obrazach:', imageInfo);

        // Wyodrębnij tylko obrazy ze strony 19
        await execAsync(`pdfimages -png -f 19 -l 19 "${pdfPath}" "${outputDir}/page19"`);

        // Sprawdź wyodrębnione pliki
        const files = fs.readdirSync(outputDir)
            .filter(file => file.startsWith('page19') && file.endsWith('.png'))
            .map(file => `${outputDir}/${file}`);

        console.log('Wyodrębnione pliki:', files);

        // Wyświetl podstawowe informacje o każdym wyodrębnionym pliku
        for (const file of files) {
            const stats = fs.statSync(file);
            console.log(`
                Znaleziono plik: ${file}
                Rozmiar: ${stats.size} bajtów
            `);
        }

        return files;
    } catch (error) {
        console.error('Błąd podczas wyodrębniania obrazów:', error);
        throw error;
    }
}
//konwersja obrazu do txt
async function processImage(imagePath: string) {
    const fileData = await readFile(imagePath);
    const base64Image = fileData.toString('base64');

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: "You are an OCR assistant. Extract precisely text from the image. Date in the file is 2238"
            },
            {
                role: "user",
                content: [
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
        max_tokens: 1024
    });

    return response.choices[0].message.content || 'no text';
}
//konwersja pdf do txt
async function convertPdfToText(pdfPath: string, txtPath: string): Promise<void> {
    try {
        // Używamy innych parametrów:
        // -raw: tryb surowy, bez próby zachowania układu
        // -nopgbrk: bez podziału stron
        // -enc UTF-8: kodowanie UTF-8
        await execAsync(`pdftotext -raw -nopgbrk -enc UTF-8 "${pdfPath}" "${txtPath}"`);
        console.log('Konwersja do tekstu zakończona pomyślnie.');

        // Odczytujemy i czyścimy tekst
        let textContent = await fs.promises.readFile(txtPath, 'utf-8');

        // Rozszerzone czyszczenie tekstu
        textContent = textContent
            // Usuń wielokrotne spacje
            .replace(/\s+/g, ' ')
            // Usuń spacje przed znakami interpunkcyjnymi
            .replace(/\s+([.,!?])/g, '$1')
            // Usuń pojedyncze litery otoczone spacjami
            .replace(/\s[a-zA-Z]\s/g, ' ')
            // Usuń wielokrotne nowe linie
            .replace(/\n{2,}/g, '\n\n')
            // Usuń linie zawierające tylko pojedyncze znaki
            .replace(/^[a-zA-Z\s]{1,2}$/gm, '')
            // Usuń linie zawierające tylko cyfry i spacje
            .replace(/^\d+\s*$/gm, '')
            // Połącz linie, które kończą się na przerwanych słowach
            .replace(/(\w)-\n(\w)/g, '$1$2')
            // Usuń puste linie na początku i końcu
            .trim();

        await fs.promises.writeFile(txtPath, textContent, 'utf-8');
        console.log('Zawartość tekstu po czyszczeniu:', textContent);
    } catch (error) {
        console.error('Błąd podczas konwersji do tekstu:', error);
        throw error;
    }
}


async function Notes() {
    const apiKey = process.env.API_KEY!;
    const pdfPath = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S04E05/notatnik-rafala.pdf'
    const txtPath = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S04E05/notatnik-rafala.txt';
    const outputDir = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S04E05';
    const notesFromLastPage = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S04E05/notesFromLastPage.txt'

    try {
        console.log('Pobieram pytania z centrali...');
        const questionsResponse = await fetch(`https://centrala.ag3nts.org/data/${apiKey}/notes.json`);

        if (!questionsResponse.ok) {
            throw new Error(`Błąd podczas pobierania pytań: ${questionsResponse.status}`);
        }

        const questions = await questionsResponse.json();
        console.log('Otrzymane pytania:', questions);

        // const imageFiles = await extractImagesFromPdf(pdfPath, outputDir);
        // console.log(`Znaleziono ${imageFiles.length} obrazów na stronie 19`);

        const notesFromLastPageContent = await readFile(notesFromLastPage, 'utf-8');

        // const notesFromLastPageContent = await processImage(notesFromLastPage);
        // console.log('Otrzymane notesy z ostatniej strony:', notesFromLastPageContent);

        const txtContent = await readFile(txtPath, 'utf-8');
        const completeNotes = `${txtContent} ${notesFromLastPageContent}`;

        const systemMessage = `
         <facts>
${completeNotes}
</facts>
<prompt_objective>
Answer questions based on a given user text with conciseness and precision. Return the answers as a concise JSON object.
</prompt_objective>

<prompt_rules>
- Carefully analyze any temporal anomalies in the narrative and shifts in time perspective.
- Pay attention to unusual transitions between different time periods and their impact on the chronology of events.
-begin your response with an internal thinking process answering questions precisely.
- Ensure all dates are in the format: YYYY-MM-DD.
- Responses must be concise and adhere to the specified JSON structure,
-include all facts given in the text, especially references to events,
-answer precisely in one sentence to each of the five questions,
-Dates must be inferred from the context of events described in the text (e.g., the date Rafał moved must be deduced from events around it).
- Look for time clues in the descriptions of events and their outcomes.
- Symbolic references to Rafał's shelter (derived from biblical symbols) must be deduced contextually, based on text-provided clues.
- Look for connections between the described events and known milestones in technological development.
- Consider the historical context of the described technological achievements.
- Look for time clues in the descriptions of events and their outcomes.
- Pay attention to time-indicating words, such as "tomorrow," and determine dates based on them.
- Analyze the chronology of events to establish exact dates within the context of the provided information.
-respond in polish language
-First show your thinking process, then return the JSON object with answers
- After the thought process, return ONLY one JSON object without any additional formatting or repetitions.

</prompt_rules>
<hints>
- GPT-2 came out in 2019
- 2024-11-11 is not correct date for the 4th question
</hints>

<context_importance>
-Each breakthrough event has its specific moment in time. The narrator is a witness to and participant in such events. Their emotions and reactions to the occurring changes can help determine exactly when these events took place.
-Words such as "tomorrow" are key to understanding the chronological sequence of events.
-Dates mentioned in the narrative may refer to the time of writing rather than the events described. Pay attention to the context to correctly interpret their meaning.
-The narrator may experience reality in a non-linear way, affecting their perception of dates and events. Their time perspective may be complex and multi-layered.
</context_importance>

<prompt_examples>
USER: { "text": "The meeting was rescheduled to 2023-10-25. Rafał moved to the city when the war ended in 1945. His shelter was akin to the shelter, a place of safety." }
AI: { 
  "01": "2023-10-25", 
  "02": "1945", 
  "03": "Rafał's shelter is symbolically described as the shelter.", 
  "04": "The meeting was rescheduled due to unforeseen circumstances.", 
  "05": "Rafał moved to the city after the war ended." 
}
</prompt_examples>

Respond in this JSON format:
{
 "01": "2023-10-25", 
  "02": "1945", 
  "03": "Rafał's shelter is symbolically described as the shelter.", 
  "04": "The meeting was rescheduled due to unforeseen circumstances.", 
  "05": "Rafał moved to the city after the war ended." 
}
<thinking>
your thought process here
</thinking>
`
        const questionsText = Object.entries(questions)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');


        const answerQuestions = await askOpenAI(questionsText, systemMessage);
        console.log("Pełna odpowiedź AI (z procesem myślenia):", answerQuestions);

        // Sprawdź, czy odpowiedź jest poprawnym JSON-em
        const jsonMatch = answerQuestions?.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Nie znaleziono poprawnego JSON-a w odpowiedzi AI");
        }

        const jsonAnswer = JSON.parse(jsonMatch[0]);
        console.log("Sparsowany JSON:", jsonAnswer);

        await sendAnswers(jsonAnswer, "notes");

    } catch (error) {
        console.error('Błąd wykonywania zadania Notes:', error);
    }

}
Notes();