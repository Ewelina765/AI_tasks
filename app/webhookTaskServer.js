import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';


dotenv.config();
const app = express();
app.use(express.json());

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Mapa terenu 4x4
const map = [
    ['start', 'trawa', 'drzewa', 'dom'],
    ['trawa', 'młyn', 'trawa', 'trawa'],
    ['trawa', 'trawa', 'skały', 'drzewa'],
    ['skały', 'skały', 'samochód', 'jaskinia']
];

async function askGPT(instruction) {
    const prompt = `
    Mam mapę 4x4, gdzie:
    - Pozycja startowa to (0,0) w lewym górnym rogu
    - Współrzędne to (x,y), gdzie x to kolumny (0-3), y to wiersze (0-3)
    - Ruch w prawo zwiększa x
    - Ruch w lewo zmniejsza x
    - Ruch w dół zwiększa y
    - Ruch w górę zmniejsza y
    
    Na podstawie instrukcji: "${instruction} "
    
    Podaj TYLKO współrzędne końcowe w formacie (x,y), np. "(2,3)".
    Nie dodawaj żadnych wyjaśnień ani komentarzy.
    `;

    const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            { role: "system", content: "Jesteś precyzyjnym asystentem, który analizuje instrukcje ruchu i zwraca tylko współrzędne." },
            { role: "user", content: prompt }
        ],
        temperature: 0
    });

    const coordinates = response.choices[0].message.content.trim();
    // Wyciągamy liczby ze stringa "(x,y)"
    const [x, y] = coordinates.slice(1, -1).split(',').map(Number);
    return map[y][x];
}


app.post('/moje_api', async (req, res) => {
    try {
        console.log('OpenAI API Key:', process.env.OPENAI_API_KEY);
        const { instruction } = req.body;
        console.log('Otrzymano instrukcję:', instruction); // dodaj logi

        if (!instruction) {
            return res.status(400).json({ error: 'Brak instrukcji w żądaniu' });
        }
        const description = await askGPT(instruction);
        console.log('Wysyłam odpowiedź:', description); // dodaj logi
        res.json({ description });
    } catch (error) {
        console.error('Błąd:', error);
        res.status(500).json({ error: 'Wystąpił błąd serwera' });
    }
});

// Używamy portu 50350
const PORT = 50350;
app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}`);
});