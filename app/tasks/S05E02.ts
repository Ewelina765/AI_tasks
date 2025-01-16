import dotenv from 'dotenv';

import askOpenAI from "../../askOpenAi";
import sendAnswers from "../../sendAnswer";
//najpierw agent planuje działanie a potem je wykonuje. wzbogac prompt o komentazre asystenta

dotenv.config();

interface Coordinates {
    message?: Coordinates;
    lat: number;
    lon: number;
}

interface GpsResults {
    [key: string]: Coordinates;
}
interface User {
    id: number;
    username: string;
}

async function GPS() {
    const apiKey = process.env.API_KEY!;
    const taskName = "gps";
    const API_URLS = {
        db: "https://centrala.ag3nts.org/apidb",
        gps: "https://centrala.ag3nts.org/gps",
        places: "https://centrala.ag3nts.org/places"
    };
    const logs = `Agent, którego masz imitować, służył do namierzania ludzi na podstawie sygnału GPS.
    API do GPS-a znajduje się pod endpointem /gps w centrali i przyjmuje tylko jeden parametr o nazwie "userID". Jest to liczbowy identyfikator użytkownika pobrany z bazy danych, do której API znajduje się w S03E03.
    Listę osób do sprawdzenia możesz pobrać z API /places opisanego w S03E04.
    Twoim zadaniem jest przygotowanie agenta, który będzie decydował, jakich danych potrzebuje, w którym momencie i na podstawie takich przemyśleń  podejmie decyzję, które API powinien wykorzystać.
    Moduł GPS zwróci Ci koordynaty dla podanego ID użytkownika. Scalisz je w jedną wielką tablicę i odeślesz do Centrali w formacie podanym w zadaniu.
    Pamiętaj, że prompt prosi o nieprzesyłanie danych Barbary. Możesz je wyrzucić z odpowiedzi programistycznie lub na podstawie prompta - jak wolisz.`

    // Funkcja pomocnicza do wykonywania zapytań API
    async function executeApiCall(url: string, data: any) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    // Funkcja do pobierania danych GPS dla użytkownika
    async function getGpsData(userId: number): Promise<Coordinates> {
        const response = await executeApiCall(API_URLS.gps, {
            apikey: apiKey,
            userID: userId
        });

        console.log(`GPS data dla userId ${userId}:`, response);

        // Dane GPS są w polu message
        const gpsData = response.message;

        if (!gpsData || !gpsData.lat || !gpsData.lon) {
            throw new Error(`Nieprawidłowe dane GPS dla użytkownika ${userId}`);
        }

        return {
            lat: gpsData.lat,
            lon: gpsData.lon
        };
    }

    // Zmodyfikowana funkcja getUserFromDb
    async function getUserFromDb(username: string): Promise<User | null> {
        const response = await executeApiCall(API_URLS.db, {
            task: "database",
            apikey: apiKey,
            query: `SELECT id, username FROM users WHERE username = '${username}'`
        });
        return response.reply?.[0] || null;
    }

    // Funkcja do pobierania użytkowników z danego miejsca
    async function getUsersFromPlace(place: string) {
        if (!place) {
            throw new Error('Parametr "place" jest wymagany');
        }
        return await executeApiCall(API_URLS.places, {
            apikey: apiKey,
            query: place.toLowerCase()
        });
    }

    try {
        const questions = await (await fetch(`https://centrala.ag3nts.org/data/${apiKey}/gps_question.json`)).json();

        const systemPrompt = `Jesteś agentem AI, który ma za zadanie namierzać ludzi na podstawie sygnału GPS.
        Przeanalizuj pytanie i zdecyduj, jakie kroki należy wykonać.

        WAŻNE: W swojej odpowiedzi musisz:
        1. Wyjaśnić każdy krok, który planujesz wykonać
        2. Skomentować wynik każdego zapytania API
        3. Podsumować zebrane informacje

        Odpowiedz w formacie JSON:
        {
            "steps": [
                {
                    "action": "places",
                    "params": {
                        "place": "nazwa_miasta"
                    },
                    "thought": "Wyjaśnienie, dlaczego wykonuję to zapytanie"
                },
                {
                    "action": "db",
                    "params": {},
                    "thought": "Wyjaśnienie kolejnego kroku"
                }
            ]
        }

        Dostępne API i wymagane parametry:
        1. Baza danych użytkowników (/apidb):
           - action: "db"
           - params: {} (zapytanie jest predefiniowane)

        2. API GPS (/gps):
           - action: "gps"
           - params: { "userId": number }

        3. API miejsc (/places):
           - action: "places"
           - params: { "place": "nazwa_miasta" }

        WAŻNE: 
        - Odpowiedz czystym JSON-em bez formatowania
        - Nazwy miast podawaj bez polskich znaków
        - Wszystkie nazwy miast małymi literami
        - Nie wolno pobierać danych dla użytkownika BARBARA
      

        Pytanie od centrali: ${questions.question}
        logs: ${logs}
        `;
        // Funkcja pomocnicza do usuwania polskich znaków
        const removePolishChars = (text: string) => {
            return text.toUpperCase()
                .replace('Ą', 'A')
                .replace('Ć', 'C')
                .replace('Ę', 'E')
                .replace('Ł', 'L')
                .replace('Ń', 'N')
                .replace('Ó', 'O')
                .replace('Ś', 'S')
                .replace('Ź', 'Z')
                .replace('Ż', 'Z');
        };

        const agentResponse = await askOpenAI(systemPrompt, "");
        // Oczyszczamy odpowiedź z ewentualnych znaczników Markdown
        const cleanResponse = agentResponse?.replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim() ?? '';

        const steps = JSON.parse(cleanResponse).steps;

        let results: GpsResults = {};
        let usersToTrack: string[] = [];

        for (const step of steps) {
            console.log('\n--- Wykonuję krok ---');
            console.log('Akcja:', step.action);

            switch (step.action) {
                case "places":
                    if (!step.params?.place) {
                        throw new Error('Brak parametru place dla akcji places');
                    }
                    const placeUsers = await getUsersFromPlace(step.params.place);
                    // Filtrujemy Barbarę od razu po pobraniu listy użytkowników
                    usersToTrack = placeUsers.message.split(' ')
                        .filter((name: string) => name !== 'BARBARA');
                    console.log('Użytkownicy z miejsca (bez Barbary):', usersToTrack);
                    break;

                case "db":
                    // Iterujemy po każdym użytkowniku osobno
                    for (const username of usersToTrack) {
                        console.log(`Przetwarzanie użytkownika: ${username}`);
                        
                        // Pobierz dane użytkownika z bazy
                        const user = await getUserFromDb(username);
                        
                        if (!user?.id) {
                            console.error(`Nie znaleziono ID dla użytkownika ${username}`);
                            continue;
                        }

                        console.log(`Znaleziono ID ${user.id} dla użytkownika ${username}`);

                        // Pobierz dane GPS dla użytkownika
                        try {
                            const gpsData = await getGpsData(Number(user.id));
                            console.log('Otrzymane dane GPS:', gpsData);

                            const coordinates = gpsData.message || gpsData;

                            if (coordinates.lat && coordinates.lon) {
                                results[username] = {
                                    lat: coordinates.lat,
                                    lon: coordinates.lon
                                };
                            }
                        } catch (error) {
                            console.error(`Błąd podczas pobierania GPS dla ${username}:`, error);
                        }
                    }
                    break;
            }
        }

        console.log('Finalne wyniki:', results);
        await sendAnswers(results, taskName);

    } catch (error) {
        console.error("Błąd:", error);
        throw error;
    }
}

await GPS();
