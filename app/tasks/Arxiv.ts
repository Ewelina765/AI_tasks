import OpenAI from "openai";
import { JSDOM } from 'jsdom';
import dotenv from 'dotenv';

import askOpenAI from "../../askOpenAi";

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

async function Arxiv() {

    const answerUrl = process.env.ANSWER_URL!;
    const apiKey = process.env.API_KEY!;
    const taskName = "arxiv";
    const questionsUrl = `https://centrala.ag3nts.org/data/${apiKey}/arxiv.txt`

    try {
        const questions = await fetch(questionsUrl);
        const response = await fetch('https://centrala.ag3nts.org/dane/arxiv-draft.html');
        const questionsContent = await questions.text();
        const htmlContent = await response.text();


        console.log(questionsContent);

        const dom = new JSDOM(htmlContent);
        const h2Headers = dom.window.document.querySelectorAll('h2');
        const sections: Section[] = [];

        h2Headers.forEach((header: Element) => {
            let section: Section = {
                title: header.textContent,
                content: []
            };

            let currentElement = header.nextElementSibling;

            while (currentElement && currentElement.tagName !== 'H2') {
                if (currentElement.tagName === 'FIGURE') {
                    const img = currentElement.querySelector('img');
                    const figcaption = currentElement.querySelector('figcaption');
                    if (img && img.getAttribute('src')) {
                        section.content.push({
                            type: 'image',
                            url: new URL(img.getAttribute('src')!, 'https://centrala.ag3nts.org/dane/').href,
                            caption: figcaption?.innerHTML.replace(/<br>/g, ' ') || '' // dodajemy podpis, zamieniając <br> na spację
                        } as SectionContent);
                    }
                }
                else if (currentElement.tagName === 'AUDIO') {
                    const audio = currentElement.querySelector('source');
                    if (audio && audio.getAttribute('src')) {
                        section.content.push({
                            type: 'audio',
                            url: new URL(audio.getAttribute('src')!, 'https://centrala.ag3nts.org/dane/').href
                        } as SectionContent);
                    }
                }
                else if (currentElement.textContent?.trim()) {
                    section.content.push({
                        type: 'text',
                        content: currentElement.textContent.trim()
                    } as SectionContent);
                }

                currentElement = currentElement.nextElementSibling;
            }

            sections.push(section);
        });

        // console.log("Sekcje dokumentu według h2:", sections);

        // ... existing code ...

        const contextForAI = await Promise.all(sections.map(async section => {
            // Najpierw przetworz audio na transkrypcje
            const processedContent = await Promise.all(section.content.map(async (item) => {
                if (item.type === 'audio' && item.url) {
                    const audioResponse = await fetch(item.url);
                    const audioBuffer = await audioResponse.arrayBuffer();
                    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
                    const audioFile = new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' });

                    const transcription = await openai.audio.transcriptions.create({
                        file: audioFile,
                        model: "whisper-1",
                    });

                    return {
                        ...item,
                        content: transcription.text
                    };
                }
                return item;
            }));

            section.content = processedContent;

            // Zbierz kontekst tekstowy (teraz zawiera też transkrypcje)
            const sectionTextContext = section.content
                .filter(item => item.type === 'text' || item.type === 'audio')
                .map(item => item.content)
                .join('\n');

            const sectionContent = await Promise.all(section.content.map(async (item) => {
                if (item.type === 'text' || item.type === 'audio') {
                    return item.content;
                }
                if (item.type === 'image' && item.url) {
                    const imageResponse = await fetch(item.url);
                    const imageBuffer = await imageResponse.arrayBuffer();
                    const base64Image = `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}`;

                    const imageAnalysis = await openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        messages: [
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: `Opisz ten obraz szczegółowo, zwracając uwagę na to, co przedstawia i na jego kontekst. Podpis pod zdjęciem: ${item.caption}`
                                    },
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
                        max_tokens: 300
                    });

                    return `[Obraz: ${item.url}]\nPodpis: ${item.caption}\nOpis obrazu: ${imageAnalysis.choices[0].message.content}`;
                }
                return '';
            }));

            return `# ${section.title || 'Bez tytułu'}\n${sectionContent.filter(Boolean).join('\n')}`;
        }));
        // console.log(contextForAI);

        const notArray = contextForAI.join('\n\n');
        console.log("Kontekst dla AI:", notArray);

        const userMessage = questionsContent;
        const systemMessage = `<objective>
                Odpowiedz na zadane pytania korzystając z dostarczonego tekstu.
                <objective>
                 <rules>
                 -odpowiedz precyzyjnie w jednym zdaniu na kazde z pięciu pytań,
                 -zwróc w formie takiej jak podano w przykładzie.
                 -zwroc czysty json, bez dodatkowych tekstów i znaków.
              
              
                 </rules>
                 <example>
       {
 {
    "01": "krótka odpowiedź w 1 zdaniu",
    "02": "krótka odpowiedź w 1 zdaniu",
    "03": "krótka odpowiedź w 1 zdaniu",
    "04": "krótka odpowiedź w 1 zdaniu",
    "05": "krótka odpowiedź w 1 zdaniu"
}
}
                </example>
                <context>
                ${notArray}
                </context>`
            ;

        const answer = await askOpenAI(userMessage, systemMessage);

        console.log("answer", answer);
        const answerObject = JSON.parse(answer!);

        // Konwertujemy obiekt na tablicę odpowiedzi

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
        console.error("Błąd:", error);
        throw error;
    }
}

await Arxiv();


