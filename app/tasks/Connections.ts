import dotenv from 'dotenv';
import neo4j, { Node } from 'neo4j-driver';


import askOpenAI from "../../askOpenAi";

dotenv.config();


async function Connections() {
    const apiKey = process.env.API_KEY!;
    const taskName = "connections";
    const databaseAPI = process.env.DATABASE_TASK_URL!;
    const answerUrl = process.env.ANSWER_URL!;
    const neo4jUrl = process.env.NEO4J_URL!;
    const neo4jUser = process.env.NEO4J_USER!;
    const neo4jPassword = process.env.NEO4J_PASSWORD!;
    // const neo4j = require('neo4j-driver');

    const driver = neo4j.driver(
        neo4jUrl,
        neo4j.auth.basic(neo4jUser, neo4jPassword)
    );
    console.log('Połączenie Neo4j działa:', await driver.verifyConnectivity());

    const session = driver.session();

    try {
        // Pobierz dane z tabeli users
        const usersResponse = await fetch(databaseAPI, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task: "database",
                apikey: apiKey,
                query: "SELECT * FROM users"
            })
        });

        // Pobierz dane z tabeli connections
        const connectionsResponse = await fetch(databaseAPI, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                task: "database",
                apikey: apiKey,
                query: "SELECT * FROM connections"
            })
        });

        if (!usersResponse.ok || !connectionsResponse.ok) {
            throw new Error(`Błąd API: ${usersResponse.status} lub ${connectionsResponse.status}`);
        }

        const users = await usersResponse.json();
        const connections = await connectionsResponse.json();
        const usersData = users.reply
        const connectionsData = connections.reply

        // Usuń istniejące dane
        await session.run('MATCH (n) DETACH DELETE n');

        // Utwórz węzły dla użytkowników
        for (const user of usersData) {
            await session.run(
                'CREATE (p:Person {id: $id, name: $name})',
                { id: user.id, name: user.username }
            );
        }

        // Tworzenie relacji "KNOWS"
        for (const connection of connectionsData) {
            await session.run(
                `MATCH (a:Person {id: $user1_id}), (b:Person {id: $user2_id})
           CREATE (a)-[:KNOWS]->(b)`,
                { user1_id: connection.user1_id, user2_id: connection.user2_id }
            );
        }
        console.log('Struktura grafowa została utworzona');


        // Znajdź najkrótszą ścieżkę między Rafałem a Barbarą
        const pathResult = await session.run(
            `MATCH (start:Person {name: $startName}), (end:Person {name: $endName}),
                       p = shortestPath((start)-[:KNOWS*]-(end))
                 RETURN nodes(p) AS pathNodes`,
            { startName: 'Rafał', endName: 'Barbara' }
        );

        if (pathResult.records.length === 0) {
            console.log('Brak ścieżki między wskazanymi węzłami.');
            return null;
        }
        const pathNodes = pathResult.records[0].get('pathNodes');
        console.log('Najkrótsza ścieżka:', pathNodes);
        const names = pathNodes.map((node: Node) => node.properties.name);
        console.log('Nazwy węzłów:', names);
        const shortestPathNames = names.join(', ')
        console.log('Imiona na najkrótszej ścieżce:', names.join(', '));

        const verifyResponse = await fetch(answerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: shortestPathNames,
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
    } finally {
        await session.close();
        await driver.close();
    }
}
Connections()