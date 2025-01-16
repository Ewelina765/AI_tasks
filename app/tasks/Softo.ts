import { chromium } from 'playwright';
// import fetch from 'node-fetch';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function fetchPageWithPlaywright(url: string): Promise<{ content: string; links: string[]; page: any }> {
    console.log(`\nPobieram stronę: ${url}`);
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForLoadState('domcontentloaded');

        const content = await page.content();
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href.startsWith('https://softo.ag3nts.org'))
                .filter(href => !href.includes('#'));
        });

        console.log(`Znaleziono ${links.length} linków na stronie ${url}:`);
        links.forEach(link => console.log(`- ${link}`));

        return { content, links, page };
    } catch (error) {
        await browser.close();
        throw error;
    }
}

async function analyzeContent(content: string, question: string, url: string, page: any): Promise<string> {
    console.log('Analizuję linki na stronie w poszukiwaniu odpowiedzi...');

    // Pobierz wszystkie linki na stronie
    const allLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
            .map(a => ({
                href: a.href,
                text: a.textContent,
                title: a.title
            }));
    });

    console.log('Znalezione linki:', allLinks);

    // Jeśli nie znaleziono odpowiedniego linku, użyj OpenAI do analizy treści
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `Analizujesz treść strony w poszukiwaniu odpowiedzi na pytanie.
                Precyzyjnie odpowiadasz na zadanie pytanie.
                Jeśli znajdziesz dokładną odpowiedź, zwróć ją.
                Jeśli nie znajdziesz odpowiedzi, zwróć 'SZUKAJ_DALEJ'.
                Jeśli jest pytanie o adres email, zwróć tylko i wyłącznie dokładny adres email.
                Jeśli pytanie dotyczy adresów url: 
                -zwróć tylko i wyłącznie dokładny adres url,
                -aby znaleć odpowiedz masz do dyspozycji analize tesktow i tytylow linkow
                -zanim zwrocisz adres url, przejdz do tego linku i sprawdz tam linki , bo mogą bardziej dokładnie odpowiadać na pytanie. Jeśli znajdziesz bardziej dokładna odpowiedz, zwróć ją. Jeśli nie, zwróć ten adres url.
                Poprzednie odpowiedzi nie przeszły walidacji: https://softo.ag3nts.org/portfolio_1_c4ca4238a0b923820dcc509a6f75849b, zwróć 'SZUKAJ_DALEJ'.
                
                `
            },
            {
                role: "user",
                content: `Pytanie: ${question}
                Treść strony: ${content}
                Linki na stronie: ${allLinks.map((link: {href: string, text: string, title: string}) => `URL: ${link.href}, Tekst: ${link.text}, Tytuł: ${link.title}`).join('\n')}`
            }
        ],
        temperature: 0
    });

    return completion.choices[0].message.content?.trim() ?? '';
}

async function findBestNextLink(links: string[], question: string, visitedLinks: string[]): Promise<string | null> {
    const unvisitedLinks = links.filter(link => !visitedLinks.includes(link));
    if (unvisitedLinks.length === 0) return null;

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `Wybierz najbardziej odpowiedni link do znalezienia odpowiedzi na pytanie.
                Zwróć TYLKO URL wybranego linku, bez żadnych dodatkowych wyjaśnień.`
            },
            {
                role: "user",
                content: `Pytanie: ${question}
                Dostępne nieodwiedzone linki:
                ${unvisitedLinks.join('\n')}`
            }
        ],
        temperature: 0
    });

    return completion.choices[0].message.content?.trim() ?? null;
}

async function Softo() {
    try {
        console.log('Rozpoczynam wykonywanie zadania Softo...');

        const apiKey = process.env.API_KEY!;
        console.log('Pobieram pytania z centrali...');
        const questionsResponse = await fetch(`https://centrala.ag3nts.org/data/${apiKey}/softo.json`);

        if (!questionsResponse.ok) {
            throw new Error(`Błąd podczas pobierania pytań: ${questionsResponse.status}`);
        }

        const questions = await questionsResponse.json();
        console.log('Otrzymane pytania:', questions);

        const answers: Record<string, string> = {};
        const maxDepth = 3;

        // Dla każdego pytania zaczynamy z czystą listą odwiedzonych linków
        for (const [questionId, question] of Object.entries(questions)) {
            console.log(`\nSzukam odpowiedzi na pytanie ${questionId}: ${question}`);

            const visitedLinks: string[] = [];
            let currentUrl = 'https://softo.ag3nts.org';
            let depth = 0;
            let answer = 'SZUKAJ_DALEJ';
            let currentBrowser = null;

            while (answer === 'SZUKAJ_DALEJ' && depth < maxDepth) {
                if (visitedLinks.includes(currentUrl)) {
                    console.log(`Link ${currentUrl} był już odwiedzony`);
                    break;
                }

                visitedLinks.push(currentUrl);
                console.log(`Pobieram stronę: ${currentUrl}`);
                const pageResult = await fetchPageWithPlaywright(currentUrl);
                console.log(`Analizuję treść strony dla pytania: ${question}`);

                try {
                    answer = await analyzeContent(pageResult.content, question as string, currentUrl, pageResult.page);
                    console.log(`Odpowiedź ze strony ${currentUrl}:`, answer);

                    if (answer === 'SZUKAJ_DALEJ') {
                        console.log('Szukam najlepszego następnego linku...');
                        const nextLink = await findBestNextLink(pageResult.links, question as string, visitedLinks);
                        if (!nextLink) {
                            console.log('Nie znaleziono więcej linków do sprawdzenia');
                            break;
                        }
                        currentUrl = nextLink;
                        depth++;
                        console.log(`Przechodzę do: ${currentUrl} (głębokość: ${depth})`);
                    }
                } finally {
                    // Zamknij przeglądarkę po zakończeniu analizy strony
                    if (pageResult.page.context().browser()) {
                        await pageResult.page.context().browser().close();
                    }
                }
            }

            answers[questionId] = answer;
            console.log(`Zakończono szukanie odpowiedzi na pytanie ${questionId}. Odpowiedź: ${answer}`);
            console.log(`Odwiedzone linki dla tego pytania:`, visitedLinks);
        }

        console.log('\nZnalezione odpowiedzi:', answers);

        const answerUrl = process.env.ANSWER_URL!;
        console.log('Wysyłam odpowiedzi do centrali...');
        const verifyResponse = await fetch(answerUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                answer: answers,
                apikey: apiKey,
                task: "softo"
            }),
        });

        const result = await verifyResponse.json();
        console.log("Odpowiedź z serwera:", result);

    } catch (error) {
        console.error('Błąd:', error);
        throw error;
    }
}

console.log('Uruchamiam skrypt...');
Softo().catch(error => {
    console.error('Błąd główny:', error);
    process.exit(1);
});

export default Softo;
