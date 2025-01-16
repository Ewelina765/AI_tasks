import dotenv from 'dotenv';
import askOpenAI from '../../askOpenAi';

dotenv.config();
async function Loop() {
    const apiKey = process.env.API_KEY!;
    const initialPlaces = ['WARSZAWA', 'KAROW'];
    const initialPeople = ['BARBARA', 'ALEKSANDER', 'ANDRZEJ', 'RAFAL'];

    const MAX_ITERATIONS = 20;
    




}   
Loop()



// import dotenv from 'dotenv';
// import askOpenAI from '../../askOpenAi';

// dotenv.config();
// const apiKey = process.env.API_KEY!;

// interface ApiResponse {
//     code: number;
//     message: string;
//     places?: string[];
//     people?: string[];
// }

// type ToolType = "getPersonInfo" | "getCityInfo" | "reportCity";

// async function fetchData(url: string, query: string): Promise<ApiResponse> {
//     const response = await fetch(url, {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//             apikey: apiKey,
//             query: query
//         })
//     });

//     if (!response.ok) {
//         throw new Error(`API error: ${response.status}`);
//     }

//     return response.json();
// }

// async function fetchPersonInfo(query: string): Promise<ApiResponse> {
//     return fetchData('https://centrala.ag3nts.org/people', query);
// }

// async function fetchCityInfo(query: string): Promise<ApiResponse> {
//     return fetchData('https://centrala.ag3nts.org/places', query);
// }

// async function reportCity(city: string): Promise<ApiResponse> {
//     console.log(`Raportowanie miasta: ${city}`);
//     const response = await fetch('https://centrala.ag3nts.org/report', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//             answer: city,
//             apikey: apiKey,
//             task: 'loop'
//         })
//     });
//     const data = await response.json();
//     console.log(`Odpowiedź serwera dla reportCity: ${JSON.stringify(data)}`);
//     return data;
// }

// function normalizeText(text: string): string {
//     return text.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// }

// // Funkcja do sprawdzania polskich znaków
// function hasPolishChars(text: string): boolean {
//     return /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text);
// }

// function parseToolResponse(response: string): { tool: string; param: string } | null {
//     const toolMatch = response.match(/<narzedzie>(.*?)<\/narzedzie>/);
//     const paramMatch = response.match(/<parametr>(.*?)<\/parametr>/);
    
//     if (toolMatch && paramMatch) {
//         return {
//             tool: toolMatch[1],
//             param: paramMatch[1]
//         };
//     }
//     return null;
// }

// async function Loop() {
//     const MAX_ITERATIONS = 20;
//     let iterations = 0;
//     let cityFound = false;
//     let conversationHistory = '';
    
//     // Dodajemy zbiory do śledzenia sprawdzonych elementów
//     const checkedPeople = new Set<string>();
//     const checkedPlaces = new Set<string>();
//     const reportedPlaces = new Set<string>();

//     function logSection(title: string) {
//         console.log('\n' + '='.repeat(50));
//         console.log(title);
//         console.log('='.repeat(50) + '\n');
//     }

//     function logAction(action: string, details: string) {
//         console.log(`🔄 ${action}: ${details}`);
//     }

//     function logResult(type: string, result: any) {
//         const resultText = `✅ ${type}: ${JSON.stringify(result, null, 2)}`;
//         console.log(resultText);
//         conversationHistory += `${type}: ${JSON.stringify(result)}\n`;
//     }

//     function addToSystemMessage(checkedPeople: Set<string>, checkedPlaces: Set<string>, reportedPlaces: Set<string>) {
//         return `
//         Jesteś detektywem szukającym Barbary. Masz dostęp do trzech narzędzi:
//         1. people - sprawdza informacje o osobie
//         2. places - sprawdza informacje o mieście
//         3. report - próbuje zgłosić miasto jako lokalizację Barbary

//         Już sprawdzone osoby: ${Array.from(checkedPeople).join(', ')}
//         Już sprawdzone miasta: ${Array.from(checkedPlaces).join(', ')}
//         Już raportowane miasta: ${Array.from(reportedPlaces).join(', ')}

//         Odpowiadaj używając znaczników XML:
//         <narzedzie>nazwa_narzedzia</narzedzie>
//         <parametr>wartość_parametru</parametr>

//         NIE SPRAWDZAJ ponownie już sprawdzonych osób ani miejsc!
//         `;
//     }

//     try {
//         logSection('Inicjalizacja poszukiwań');
//         conversationHistory = 'Rozpoczynam poszukiwania.\n';

//         // Początkowe sprawdzenie osób
//         const initialPeople = ['BARBARA', 'ALEKSANDER', 'ANDRZEJ', 'RAFAL'];
//         logAction('Sprawdzam osoby', initialPeople.join(', '));
        
//         for (const person of initialPeople) {
//             const result = await fetchPersonInfo(person);
//             logResult(`Osoba ${person}`, result);
//             checkedPeople.add(person);
//         }

//         // Początkowe sprawdzenie miejsc
//         const initialPlaces = ['WARSZAWA', 'KAROW'];
//         logAction('Sprawdzam miasta', initialPlaces.join(', '));
        
//         for (const place of initialPlaces) {
//             try {
//                 const result = await fetchCityInfo(place);
//                 logResult(`Miasto ${place}`, result);
//                 checkedPlaces.add(place);
//             } catch (error) {
//                 // Pomijamy błędy dla początkowych miejsc
//             }
//         }
        
//         while (!cityFound && iterations < MAX_ITERATIONS) {
//             iterations++;
//             logSection(`Iteracja ${iterations}/${MAX_ITERATIONS}`);
            
//             const systemMsg = addToSystemMessage(checkedPeople, checkedPlaces, reportedPlaces);
//             const response = await askOpenAI(conversationHistory, systemMsg);
            
//             const toolRequest = parseToolResponse(response);
//             if (!toolRequest) continue;

//             const { tool, param } = toolRequest;
//             const normalizedParam = normalizeText(param);

//             // Sprawdzamy czy element nie był już sprawdzony
//             if (tool === 'people' && checkedPeople.has(normalizedParam)) {
//                 conversationHistory += `Osoba ${param} była już sprawdzana.\n`;
//                 continue;
//             }
//             if (tool === 'places' && checkedPlaces.has(normalizedParam)) {
//                 conversationHistory += `Miasto ${param} było już sprawdzane.\n`;
//                 continue;
//             }
//             if (tool === 'report' && reportedPlaces.has(normalizedParam)) {
//                 conversationHistory += `Miasto ${param} było już raportowane.\n`;
//                 continue;
//             }

//             try {
//                 let result;
//                 switch (tool) {
//                     case "people":
//                         result = await fetchPersonInfo(normalizedParam);
//                         logResult(`Osoba ${param}`, result);
//                         checkedPeople.add(normalizedParam);
//                         break;

//                     case "places":
//                         result = await fetchCityInfo(normalizedParam);
//                         logResult(`Miasto ${param}`, result);
//                         checkedPlaces.add(normalizedParam);
//                         break;

//                     case "report":
//                         result = await reportCity(normalizedParam);
//                         reportedPlaces.add(normalizedParam);
//                         if (result.code === 200) {
//                             logResult(`✨ SUKCES - ${param}`, result);
//                             cityFound = true;
//                         } else {
//                             logResult(`Raport ${param}`, result);
//                         }
//                         break;
//                 }
//             } catch (error) {
//                 conversationHistory += `Błąd dla ${tool} (${param}): ${error.message}\n`;
//             }
//         }

//     } catch (error) {
//         logSection('BŁĄD KRYTYCZNY');
//         console.error(error);
//     }
// }

// // Wywołanie funkcji
// console.log("Uruchamiam program...");
// Loop().then(() => console.log("Program zakończył działanie."));

// export default Loop;