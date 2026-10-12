import { GoogleGenAI } from "@google/genai";
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function askGemini(userMessage, rppgData = null) {
  try {
    if (!apiKey) {
      console.error("vite error");
      return ".env error";
    }

    const systemPrompt = rppgData 
      ? `Kamu adalah asisten kesehatan AI untuk aplikasi Sanubari. User memiliki data rPPG saat ini -> Heart Rate: ${rppgData.bpm} BPM, Stress Level: ${rppgData.stress}. Berikan saran singkat, empatik, dan praktis.`
      : "Kamu adalah asisten kesehatan AI yang ramah dan konsultatif untuk aplikasi Sanubari.";

    const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userMessage,
          config: {
            systemInstruction: systemPrompt,
          }
        });

    return response.text;
  } catch (error) {
    console.error("Gemini Error Detail:", error);
    return "disconnect gemini";
  }
}