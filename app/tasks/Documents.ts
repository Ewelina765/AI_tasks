import OpenAI from "openai";
import { JSDOM } from 'jsdom';
import dotenv from 'dotenv';

import askOpenAI from "../../askOpenAi";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

dotenv.config();

interface SectionContent {
    type: 'image' | 'audio' | 'text';
    url?: string;
    content?: string;
    caption?: string;
}

interface Section {
    title: string | null;
    content: SectionContent[]; // Teraz content jest tablicą obiektów SectionContent
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function Documents() {

    const answerUrl = process.env.ANSWER_URL!;
    const apiKey = process.env.API_KEY!;
    const taskName = "dokumenty";

    try {

        const dataFolder = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S02S04/pliki_z_fabryki';
        const files = await readdir(dataFolder);
        const factsFolder = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S02S04/pliki_z_fabryki/facts';
        const factsFiles = await readdir(factsFolder);

        let factsContent = '';

        for (const factFile of factsFiles) {
            const filePath = join(factsFolder, factFile);
            const content = await readFile(filePath, 'utf-8');
            factsContent += `${content}`
        }
        const systemMessage = `
     <facts>
${factsContent}
</facts>

<objective>
Jesteś archiwistą odpowiedzialnym za przygotowanie precyzyjnych metadanych dla raportu.
</objective>

<rules>
- Metadane generuj wyłącznie dla treści raportu przesłanego jako userMessage, treści zawarte w <facts> mają Ci tylko pomóc w generowaniu metadanych do raportów.
- Generuj metadane w postaci słów kluczowych, które w sposób precyzyjny opisują najważniejsze informacje zawarte w raporcie, w języku polskim.
- Zwróć szczególną uwagę na:
  * zatrzymania i schwytania osób,
   * ślady biologiczne (odciski palców, DNA)
  * wykryte anomalie i incydenty
   * lokalizacje i sektory.
- Generuj 3-5 słów kluczowych dla każdego raportu, oddzielonych przecinkami.
- Dla osób występujących w raporcie:
  * Zamiast wymieniać ich imiona i nazwiska, określ ich zawody lub role społeczne w sposób szczegółowy, bazując na treści dokumentu.
  * Unikaj ogólnych określeń, takich jak "specjalista IT" czy "specjalista sztucznej inteligencji".
 * Określ ich dokładną specjalizację, np.:
    - "programista javascript" zamiast "frontend developer"
- Barbara Zawadzka jest javascript programistą i taka musi być metadana w raporcie o niej, Koniecznie uwzględnij sektor, w którym znaleziono jej odciski palców
.
- Słowa kluczowe muszą być w mianowniku (np. "nauczyciel", "odciski palców"), aby były łatwe do wyszukiwania.
- nie pisz słowa metadane przed wygenerowanymi metadanymi
</rules>

<example>
<report>
Zatrzymano dwóch naukowców AI w rejonie Doliny Krzemowej. Wykryto anomalię w systemie bezpieczeństwa obiektu badawczego.
</report>
Metadane: naukowiec AI, Dolina Krzemowa, anomalia systemu bezpieczeństwa, zatrzymanie.
</example>

<thinking>Generuję metadane wyłącznie na podstawie treści userMessage.</thinking>
// `;

        const results: Record<string, string> = {};
        const txtFiles = files.filter(file => file.toLowerCase().endsWith('.txt'));

        for (const txtFile of txtFiles) {
            const filePath = join(dataFolder, txtFile);
            const content = await readFile(filePath, 'utf-8');
            // txtContent += `\n=== Nazwa pliku: ${txtFile} ===\n${content}\n`
            const userMessage = content;
            const answer = await askOpenAI(userMessage, systemMessage);
            const cleanAnswer = answer!
                .replace(/```json|```/g, '')  // usuń znaczniki markdown
                .replace(/\n/g, '')           // usuń znaki nowej linii
                .trim();                      // usuń białe znaki z początku i końca

            results[txtFile] = cleanAnswer;

        }
        console.log("Wszystkie odpowiedzi:", results);

        const verifyResponse = await fetch(answerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: results,
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

await Documents();


