import OpenAI from "openai";
import dotenv from 'dotenv';
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { QdrantClient } from "@qdrant/js-client-rest";

dotenv.config();

// Konfiguracja klientów
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const client = new QdrantClient({
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY,
});

// Stałe
const COLLECTION_NAME = "vectors";
const EMBEDDING_SIZE = 1536;

// Funkcje pomocnicze
async function createEmbedding(text: string) {
    const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
    });
    return embedding.data[0].embedding;
}

async function initializeCollection() {
    const collections = await client.getCollections();
    const collectionExists = collections.collections.find(
        (collection: any) => collection.name === COLLECTION_NAME
    );

    if (!collectionExists) {
        await client.createCollection(COLLECTION_NAME, {
            vectors: {
                size: EMBEDDING_SIZE,
                distance: "Cosine"
            }
        });
        console.log("Utworzono kolekcję vectors");
    }
}

async function processDocument(file: string, index: number) {
    const dataFolder = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S03E02/do-not-share';
    const filePath = join(dataFolder, file);
    const content = await readFile(filePath, 'utf-8');

    const dateMatch = file.match(/(\d{4})_(\d{2})_(\d{2})\.txt/);
    const date = dateMatch 
        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` 
        : 'unknown';

    const metadata = {
        filename: file,
        date: date,
    };

    const embedding = await createEmbedding(content);

    await client.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
            {
                id: file.replace('.txt', ''),
                vector: embedding,
                payload: metadata
            }
        ]
    });
    console.log(`Dodano dokument ${file} do bazy Qdrant`);
    return { metadata, embedding };
}

async function searchDocuments(question: string) {
    const questionEmbedding = await createEmbedding(question);
    return await client.search(COLLECTION_NAME, {
        vector: questionEmbedding,
        limit: 1,
        with_payload: true,
    });
}

// Główna funkcja
async function Documents() {
    const answerUrl = process.env.ANSWER_URL!;
    const apiKey = process.env.API_KEY!;
    const taskName = "wektory";
    const dataFolder = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S03E02/do-not-share';

    try {
        // Inicjalizacja kolekcji
        await initializeCollection();

        // Wczytanie i przetworzenie dokumentów
        const files = await readdir(dataFolder);
        const documents = await Promise.all(
            files.map((file, index) => processDocument(file, index))
        );

        // Wyszukiwanie odpowiedzi
        const question = "W raporcie, z którego dnia znajduje się wzmianka o kradzieży prototypu broni?";
        const searchResults = await searchDocuments(question);
        console.log("Znalezione dokumenty:", searchResults);
        
        const answer = searchResults[0].payload?.date;

        // Wysłanie odpowiedzi
        const verifyResponse = await fetch(answerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answer, apikey: apiKey, task: taskName })
        });

        const result = await verifyResponse.json();
        console.log("Odpowiedź z serwera:", result);
        return result;

    } catch (error) {
        console.error("Błąd:", error);
        throw error;
    }
}

// Uruchomienie
await Documents();

