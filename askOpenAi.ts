import OpenAI from "openai";

export default async function askOpenAI(question: string, systemMessage: string, jsonMode: boolean = false) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: question
                }, {
                    role: "system",
                    content: systemMessage
                }
            ],
            response_format: jsonMode ? { type: "json_object" } : { type: "text" }

        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error("Błąd podczas komunikacji z OpenAI:", error);
        throw error;
    }
}