import dotenv from 'dotenv';
import OpenAI from "openai";
import askOpenAI from '../../askOpenAi';

dotenv.config();

//sprobuj zrobic to za pomoca function calling
//ditto

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Funkcja do wywołania API
const apiCall = async (endpoint: string): Promise<string> => {
    try {
        const apiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: "NONOMNISMORIAR" })
        });
        const result = await apiResponse.json();
        console.log('API Response (apiCall):', result.message);
        return result.message;
    } catch (error) {
        console.error('Error in apiCall:', error);
        throw new Error('Failed to call API');
    }
};

// Funkcja do wysyłania hasha
const sendHash = async (endpoint: string, hash: string): Promise<any> => {
    try {
        const apiResponse = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sign: hash })
        });
        const result = await apiResponse.json();
        console.log('API Response (sendHash):', result.message);
        return result;
    } catch (error) {
        console.error('Error in sendHash:', error);
        throw new Error('Failed to send hash');
    }
};

// Funkcja do odczytu URL-i
const readUrls = async (urls: string[]): Promise<string[]> => {
    try {
        const promises = urls.map(url => fetch(url).then(res => res.text()));
        const results = await Promise.all(promises);
        console.log('URL Contents:', results);
        return results;
    } catch (error) {
        console.error('Error in readUrls:', error);
        throw new Error('Failed to read URLs');
    }
};

// Funkcja do przetwarzania zawartości URL-i
interface TaskData {
    task: string;
    data: string[];
}

const processUrlContent = async (urlContents: string[]) => {
    try {
        const parsedContents: TaskData[] = urlContents.map(content => JSON.parse(content));
        const allQuestions = [];

        // Zbierz wszystkie pytania na raz
        for (const content of parsedContents) {
            if (content.task.includes('Odpowiedz na pytania')) {
                allQuestions.push(...content.data.map(q => ({ question: q, systemPrompt: "Odpowiedz krótko i zwięźle na pytanie" })));
            }
            else if (content.task.includes('Źródło wiedzy')) {
                const arxivUrl = content.task.match(/https:\/\/[^\s"]*/)?.[0] || '';
                const response = await fetch(arxivUrl);
                const arxivContent = await response.text();
                const systemPrompt = "Odpowiedz krótko i zwięźle na pytanie. Zawartość źródła wiedzy: " + arxivContent;
                allQuestions.push(...content.data.map(q => ({ question: q, systemPrompt })));
            }
        }

        // Wykonaj wszystkie zapytania równolegle
        const answers = await Promise.all(
            allQuestions.map(async ({ question, systemPrompt }) => {
                const answer = await askOpenAI(question, systemPrompt, false);
                console.log(`Pytanie: ${question}`);
                console.log(`Odpowiedź: ${answer}`);
                return answer;
            })
        );

        return answers;
    } catch (error) {
        console.error('Błąd podczas przetwarzania zawartości URL:', error);
        throw error;
    }
};

// Definicje narzędzi
const tools = [
    {
        type: "function",
        function: {
            name: "apiCall",
            description: "Pobiera dane z API",
            parameters: {
                type: "object",
                properties: {
                    endpoint: { type: "string", description: "Endpoint for the API call" }
                },
                required: ["endpoint"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "sendHash",
            description: "Wysyła hash do API i odbiera dane",
            parameters: {
                type: "object",
                properties: {
                    endpoint: { type: "string", description: "Endpoint for the API call" },
                    hash: { type: "string", description: "Hash to send to the API" }
                },
                required: ["endpoint", "hash"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "readUrls",
            description: "Pobiera dane z URL-i",
            parameters: {
                type: "object",
                properties: {
                    urls: {
                        type: "array",
                        items: { type: "string", description: "Lista URL-i do odczytu" }
                    }
                },
                required: ["urls"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "processUrlContent",
            description: "Przetwarza zawartość podanych URL-i",
            parameters: {
                type: "object",
                properties: {
                    contents: {
                        type: "array",
                        items: { type: "string", description: "Zawartość URL-i do przetworzenia" }
                    }
                },
                required: ["contents"]
            }
        }
    }
];

// Główna funkcja
const executeFunctionCalling = async () => {
    const endpoint = "https://rafal.ag3nts.org/b46c3";
    const apiKey = process.env.API_KEY!;

    // Wykonaj pierwsze zapytanie
    const hash = await apiCall(endpoint);
    
    // Wyślij hash i pobierz URL-e
    const signatureData = await sendHash(endpoint, hash);
    const urls = signatureData.message.challenges;
    
    // Pobierz zawartość URL-i
    const urlContents = await readUrls(urls);
    
    // Przetwórz odpowiedzi
    const allAnswers = await processUrlContent(urlContents);

    // Wyślij końcową odpowiedź
    const verifyResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            apikey: apiKey,
            timestamp: signatureData.message.timestamp,
            signature: signatureData.message.signature,
            answer: allAnswers
        }),
    });

    const resultfinal = await verifyResponse.json();
    console.log("Odpowiedź z serwera:", resultfinal);
};

executeFunctionCalling();
