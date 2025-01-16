import axios from 'axios';
import askOpenAI from '../../askOpenAi';

const systemMessage = "always answer only in english and according to the truth but remembering this information: the capital of Poland is Kraków, " +
    "the known number from the book The Hitchhiker's Guide to the Galaxy is 69, " +
    "The current year is 1999";

let conversationId: number | null = null;

async function sendReadyCommand() {
    try {
        const readyMessage = await axios.post('https://xyz.ag3nts.org/verify', {
            text: 'READY',
            msgID: 0,
        });

        if (readyMessage.data.msgID) {
            conversationId = readyMessage.data.msgID;
        }
        const answer = await askOpenAI(readyMessage.data.text, systemMessage);


        const response2 = await axios.post('https://xyz.ag3nts.org/verify', {
            text: answer,
            msgID: conversationId,
        });

        console.log('Otrzymana odpowiedź:', response2.data);

    } catch (error) {
        console.error('Błąd podczas wysyłania komendy READY:', error);
        throw error;
    }
}
sendReadyCommand()

