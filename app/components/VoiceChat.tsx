"use client"
import { useState, useCallback} from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export const VoiceChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  // Inicjalizacja rozpoznawania mowy
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'pl-PL';
  recognition.continuous = false;  // Czy ma działać ciągle
  recognition.interimResults = false; // Wyłączenie wyników pośrednich, strumieniowani

  if (!apiKey) {
    console.error('Brak klucza API OpenAI');
    return <div>Błąd konfiguracji - brak klucza API</div>;
  }

  // Funkcja do syntezy mowy (odpowiedź asystenta)
  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pl-PL';
    window.speechSynthesis.speak(utterance);
  };

  // Obsługa rozpoznawania mowy
  recognition.onresult = async (event: any) => {
    if (event.results && event.results.length > 0 && event.results[0].length > 0) {
      const userInput = event.results[0][0].transcript;
      await sendMessage(userInput);
    }
  };

  const sendMessage = useCallback(async (userInput: string) => {
    try {
      setIsLoading(true);
      const newMessages = [...messages, { role: 'user' as const, content: userInput }];
      setMessages(newMessages);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: newMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      });

      const data = await response.json();
      
      // Sprawdź czy mamy poprawną odpowiedź
      if (!data || !data.choices || !data.choices[0]?.message?.content) {
        throw new Error('Nieprawidłowa odpowiedź z API');
      }

      const assistantResponse = data.choices[0].message.content;
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantResponse
      }]);

      // Odczytaj odpowiedź na głos
      speak(assistantResponse);

    } catch (error) {
      console.error('Błąd:', error instanceof Error ? error.message : 'Nieznany błąd');
      speak('Przepraszam, wystąpił błąd.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, apiKey]);

  const toggleListening = () => {
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
    setIsListening(!isListening);
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg ${
              message.role === 'user' 
                ? 'bg-blue-100 ml-auto' 
                : 'bg-gray-100 mr-auto'
            }`}
          >
            <div>{message.content}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-4">
        <button
          onClick={toggleListening}
          disabled={isLoading}
          className={`p-4 rounded-full ${
            isListening 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white transition-colors`}
        >
          {isListening ? 'Stop' : 'Start nagrywania'}
        </button>
      </div>
    </div>



  ) 
};