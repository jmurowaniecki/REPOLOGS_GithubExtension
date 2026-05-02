import { buildSystemPrompt, buildUserPrompt } from './prompt';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
function parseGeminiResult(raw) {
    const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed.score !== 'number') {
            throw new Error('JSON sem campo score');
        }
        return parsed;
    }
    catch (e) {
        throw new Error(`Falha ao parsear resposta do Gemini: ${e.message}`);
    }
}
export async function analyzeWithGemini(apiKey, owner, repo, files) {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(owner, repo, files);
    const body = {
        system_instruction: {
            parts: [{ text: systemPrompt }],
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: userPrompt }],
            },
        ],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
        },
    };
    const res = await fetch(`${API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) {
        if (data.error.code === 429) {
            throw new Error('Rate limit do Gemini atingido. Aguarde alguns minutos.');
        }
        if (data.error.code === 400 && data.error.message.includes('API_KEY')) {
            throw new Error('API key inválida. Verifique nas configurações da extensão.');
        }
        throw new Error(`Gemini API: ${data.error.message}`);
    }
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Resposta vazia do Gemini');
    }
    const rawText = data.candidates[0].content.parts[0].text;
    return parseGeminiResult(rawText);
}
