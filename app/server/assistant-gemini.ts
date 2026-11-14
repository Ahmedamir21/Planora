import { ASSISTANT_RESPONSE_SCHEMA } from './assistant-schema';

export type GeminiResult = { parsed: any } | { status: number; error: string };

// Asks Gemini and returns the parsed JSON answer, or a status and message to send back.
export async function askGemini(apiKey: string, system: string, safeHistory: any[], message: string): Promise<GeminiResult> {
  const model = 'gemini-3.5-flash-lite';
  // Share one deadline between the first answer and a malformed-JSON retry.
  const signal = AbortSignal.timeout(24_000);
  let parsed: any = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [...safeHistory, { role: 'user', parts: [{ text: message }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingLevel: 'minimal' },
            responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: ASSISTANT_RESPONSE_SCHEMA } },
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error', response.status);
      const geminiMessage = String(data?.error?.message || '');
      const status = response.status;

      if (status === 429) {
        return { status: 429, error: 'The Gemini quota is busy right now. Please try again shortly.' };
      }

      if (status === 401 || status === 403) {
        return { status: 502, error: 'Gemini rejected the API key or this project does not have access to the selected model.' };
      }

      if (status === 400 || status === 404) {
        return { status: 502, error: 'Gemini rejected the model/request configuration. The server is using gemini-3.5-flash-lite.' };
      }

      return { status: 502, error: geminiMessage
          ? `Gemini API error (${status}).`
          : 'The assistant could not answer right now.' };
    }

    const parts = data?.candidates?.[0]?.content?.parts;
    const rawText = Array.isArray(parts)
      ? parts.filter((p) => !p?.thought && typeof p?.text === 'string').map((p) => p.text).join('').trim()
      : '';

    const finishReason = data?.candidates?.[0]?.finishReason;
    let valid = false;
    try {
      const cleaned = rawText.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '');
      parsed = JSON.parse(cleaned);
      valid = parsed && typeof parsed === 'object' && typeof parsed.text === 'string' && parsed.text.trim().length > 0;
    } catch { /* Retry a malformed response once. */ }
    if (valid) break;

    // Keep student messages and model output out of server logs.
    console.error('Gemini returned invalid JSON', {
      finishReason,
      outputTokens: data?.usageMetadata?.candidatesTokenCount,
      textLength: rawText.length,
      partCount: Array.isArray(parts) ? parts.length : 0,
      thoughtParts: Array.isArray(parts) ? parts.filter((p) => p?.thought).length : 0,
      attempt: attempt + 1,
    });
    if (attempt === 1) return { status: 502, error: 'The assistant returned an invalid response. Please try again.' };
  }
  return { parsed };
}
