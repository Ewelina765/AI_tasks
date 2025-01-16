import dotenv from 'dotenv';

import askOpenAI from "../../askOpenAi";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import sendAnswers from "../../sendAnswer";

dotenv.config();

async function Phone() {
    const apiKey = process.env.API_KEY!;
    const taskName = "phone";

    try {
        const sortedDialogsUrl = `https://centrala.ag3nts.org/data/${apiKey}/phone_sorted.json`;
        const response = await fetch(sortedDialogsUrl);
        const sortedDialogs = await response.json();
        console.log('sortedDialogs', sortedDialogs);
        const fetchQuestions = await fetch(`https://centrala.ag3nts.org/data/${apiKey}/phone_questions.json`);
        const questions = await fetchQuestions.json();
        // console.log('questions', questions);
        const factsFolder = '/Users/ewelinakuzniewska/Desktop/programowanie/aidevs3/app/data/S02S04/pliki_z_fabryki/facts';
        const factsFiles = await readdir(factsFolder);

        let factsContent = '';

        for (const factFile of factsFiles) {
            const filePath = join(factsFolder, factFile);
            const content = await readFile(filePath, 'utf-8');
            factsContent += `${content}`
        }
        const answers: Record<string, { answer: string, type: string }> = {};

        // Przygotuj jeden, uniwersalny prompt
        const contextPrompt = `
            Analyze the following dialogues and facts, then answer the question.
            
            FACTS:
            ${factsContent}
            
            DIALOGS:
            ${JSON.stringify(sortedDialogs, null, 2)}
            
            -Respond briefly and concisely, only to what is being asked, based on information from the dialogues and facts.
            -Some individuals refer to certain facts, but one person is lying—who? This will require referencing either common knowledge or the fact folder. Reply with only the name of the liar.
            -Answer questions precisely.
            -If asked about the endpoint, return only the URL, nothing more, and consider who the liar is.
            -When asked about names from the conversations, consider the facts and other dialogues.
            <wrong_answers>
            - Barbara’s boyfriend does not have the nickname Azazel, Witek, Samuel, Musk, or Helmut Rahn. One nickname appears in dialogue #5, and the context of its mention and Barbara’s reaction may suggest that this person is "her" boyfriend.
            - The liar is not Azazel.
            - Conversations in the dialogues are interconnected. If a question refers to a specific dialogue, analyze all of them: ${JSON.stringify(sortedDialogs, null, 2)}.
            - The person who provided access to the API but didn’t know its password is neither Witek, Zygfryd, Tomasz, Adam, nor Rafał "Musk" Bomba.
            - Zygfryd, Adam, and Andrzej do not participate in the first conversation; 
            - The incorrect endpoint is https://rafal.ag3nts.org/510bc.
            </wrong_answers>`;

        // Najpierw znajdź kłamcę (pytanie 01)
        const liar = await askOpenAI(questions['01'], contextPrompt);
        answers['01'] = {
            answer: liar?.trim() ?? '',
            type: "string"
        };

        // Teraz możemy użyć informacji o kłamcy w pozostałych pytaniach
        const enhancedContextPrompt = `
        ${contextPrompt}
        
        WAŻNE: Wiemy już, że ${liar?.trim() ?? ''} to osoba, która skłamała.`;

        // Obsłuż wszystkie pytania w pętli
        for (const [key, question] of Object.entries(questions)) {
            let answer;

            // Specjalna obsługa dla pytania o odpowiedź z API
            if (key === '05') {
                // Najpierw znajdź endpoint
                const fifthQuestion = `What is the real API endpoint provided by the person who did NOT lie? Extract it from the dialogue of people who are not liars. Return only the URL, nothing else.`;
                const endpoint = await askOpenAI(fifthQuestion, enhancedContextPrompt);
                const getPassword = `find password in dialogs ${JSON.stringify(sortedDialogs, null, 2)}. return password, nothing else`;
                const password = await askOpenAI(getPassword, enhancedContextPrompt);
                // Wykonaj zapytanie do API
                const apiResponse = await fetch(endpoint?.trim() ?? '', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: password })
                });
                answer = await apiResponse.text();
                const parsedAnswer = JSON.parse(answer);
                answer = parsedAnswer.message;
                console.log('apiresponse', answer);
            } else {
                // Dla wszystkich innych pytań użyj standardowego promptu
                console.log('querrentquestion', question);
                const questionStr = question as string;
                answer = await askOpenAI(questionStr, enhancedContextPrompt);
            }

            answers[key] = answer?.trim() || '';
        }

        // Wyślij odpowiedź do API
        sendAnswers(answers, taskName);

    } catch (error) {
        console.error("Błąd:", error);
        throw error;
    }
}

await Phone();



