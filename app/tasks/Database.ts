import dotenv from 'dotenv';

dotenv.config();

async function Database() {
    const taskName = "database";
    const apiKey = process.env.API_KEY!;
    const databaseAPI = process.env.DATABASE_TASK_URL!;
    const answerUrl = process.env.ANSWER_URL!;

    // Najpierw sprawdźmy strukturę tabeli datacenters
    try {
        const response = await fetch(databaseAPI, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task: taskName,
                apikey: apiKey,
                query: "show create table datacenters"
            })
        });

        if (!response.ok) {
            throw new Error(`Błąd API: ${response.status}`);
        }

        const data = await response.json();
        console.log('Otrzymano odpowiedź:', data);

        // Teraz wykonajmy właściwe zapytanie
        const response2 = await fetch('https://centrala.ag3nts.org/apidb', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task: taskName,
                apikey: apiKey,
                query: `
                    SELECT d.dc_id 
                    FROM datacenters d
                    INNER JOIN users u ON d.manager = u.id
                    WHERE d.is_active = 1 
                    AND u.is_active = 0;
                `
            })
        });

        if (!response.ok) {
            throw new Error(`Błąd API: ${response.status}`);
        }
        const data2 = await response2.json();
        console.log('Wyniki zapytania:', data2); //Wyniki zapytania: { reply: [ { dc_id: '4278' }, { dc_id: '9294' } ], error: 'OK' }
        const dcIds = data2.reply.map((row: { dc_id: string; }) => parseInt(row.dc_id)); // Konwertujemy na liczby

        const verifyResponse = await fetch(answerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: dcIds,
                apikey: apiKey,
                task: taskName
            }),
        });

        const result = await verifyResponse.json();
        console.log("Odpowiedź z serwera:", result);
        return result;

    } catch (error) {
        console.error('Wystąpił błąd podczas łączenia z API:', error);
    }



}

Database();