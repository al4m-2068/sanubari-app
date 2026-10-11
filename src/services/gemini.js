import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function askGemini(userMessage, rppgData = null) {
  try {
    if (!apiKey) {
      return "API Key belum terpasang di file .env";
    }

    const systemPrompt = rppgData 
      ? `Kamu adalah asisten kesehatan AI untuk aplikasi Sanubari. User memiliki data rPPG saat ini -> Heart Rate: ${rppgData.bpm} BPM, Stress Level: ${rppgData.stress}. Berikan saran singkat, empatik, dan praktis.`
      : "Kamu adalah asisten kesehatan AI yang ramah dan konsultatif untuk aplikasi Sanubari.";

    // Pakai model gemini-3.8-flash yang diminta oleh server Google
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

    // Tangani jika kena limit 5 request per menit (Free Tier)
    if (error.status === 429 || JSON.stringify(error).includes("429")) {
      return "Sebentar ya, kuota pesan gratis tercapai (maksimal 5 pesan per menit). Tunggu sekitar 10 detik lalu kirim ulang pesanmu, ya!";
    }

    // Tangani jika server sedang sibuk (503)
    if (error.status === 503 || JSON.stringify(error).includes("503")) {
      return "Server AI sedang mengalami lonjakan trafik. Coba kirim ulang beberapa saat lagi!";
    }

    return "Maaf, terjadi kesalahan saat menghubungkan ke AI.";
  }
}