import OpenAI from "openai";
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TestData {
    question: string;
    answer: number;
    test?: { // opcjonalne, ponieważ `test` nie występuje w każdym obiekcie w `test-data`
        q: string;
        a: string;
    };
}

(async () => {
  const verifyUrl = process.env.ANSWER_URL;
  const taskName = "JSON";
  const apikey = process.env.API_KEY;
  const jsonTaskUrl = process.env.JSON_TASK_URL;

  try {
    if (!jsonTaskUrl) {
      throw new Error('URL zadania JSON nie został zdefiniowany');
    }
    const response = await fetch(jsonTaskUrl);
    if (!response.ok) {
      throw new Error(`Błąd HTTP! Status: ${response.status}`);
    }

    const rawData = await response.text();
    const jsonData = JSON.parse(rawData);

function calculateAnswer(question: string): number {
    // Usuwamy wszystkie spacje i dzielimy na części
    const [num1, separator, num2] = question.split(/\s+/);
    return parseInt(num1) + parseInt(num2); // Zakładamy, że mamy tylko dodawanie
  }
  
  // Sprawdzanie i korekta odpowiedzi dla obiektów bez pola test
  jsonData['test-data'] = jsonData['test-data'].map((item: TestData) => {
    if (!item.test) {
      const correctAnswer = calculateAnswer(item.question);
      if (item.answer !== correctAnswer) {
        return {
          ...item,
          answer: correctAnswer
        };
      }
    }
    return item;
  });

const answeredQuestions = await Promise.all(
    jsonData['test-data']
      .filter((item: TestData) => item.test)
      .map(async (item: TestData) => {
        const completion = await openai.chat.completions.create({
          messages: [{ 
            role: "user", 
            content: `Answer short and concise to the question: ${item.test?.q}` 
          }],
          model: "gpt-4o-mini",
        });

        return {
          q: item.test?.q,
          a: completion.choices[0].message.content?.trim() || ''
        };
      })
  );

  console.log('Pytania z odpowiedziami:', answeredQuestions);

let answerIndex = 0;
jsonData['test-data'] = jsonData['test-data'].map((item: TestData) => {
  if (item.test) {
    const answer = answeredQuestions[answerIndex++];
    return {
      ...item,
      test: {
        q: item.test.q,
        a: answer.a
      }
    };
  }
  return item;
});

jsonData.apikey= apikey;
//   console.log('Zaktualizowany JSON:', jsonData);
    //   const completion = await openai.chat.completions.create({
    //     messages: [{ role: "user", content: `Odpowiedz krótko i zwięźle na pytanie: ${question}`  }],
    //     model: "gpt-3.5-turbo",
    //   });

    //   const answer = completion.choices[0].message.content;
    //   console.log('Pytanie:', jsonData.test.q);
    //   console.log('Odpowiedź LLM:', answer);
      if (!verifyUrl) {
        throw new Error('verifyUrl is not defined');
      }
      const verifyResponse = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task: taskName,
          apikey: apikey,
          answer: jsonData,
        }),
      });

      const result = await verifyResponse.json();
      console.log("Odpowiedź z weryfikacji:", result);
    
    
    process.exit(0);
  } catch (error) {
    console.error("Wystąpił błąd:", error);
    process.exit(1);
  }
})();


