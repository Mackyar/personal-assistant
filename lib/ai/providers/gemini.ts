import type { AIProvider, AIMessage, StreamChunk, ToolDefinition } from '../client';

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private buildBody(messages: AIMessage[]): Record<string, unknown> {
    // Gemini requires strict alternating user/model turns
    // Merge consecutive same-role messages and skip system (handled separately)
    const filtered = messages.filter((m) => m.role !== 'system');
    const contents: { role: string; parts: { text: string }[] }[] = [];

    for (const msg of filtered) {
      const geminiRole = msg.role === 'assistant' ? 'model' : 'user';
      const last = contents[contents.length - 1];
      if (last && last.role === geminiRole) {
        // Merge consecutive same-role messages
        last.parts[0].text += '\n' + msg.content;
      } else {
        contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
      }
    }

    // Gemini requires at least one message and it must end with a user turn
    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      return { contents };
    }

    const body: Record<string, unknown> = { contents };
    const systemText = messages.find((m) => m.role === 'system')?.content;
    if (systemText) {
      body.systemInstruction = { role: 'user', parts: [{ text: systemText }] };
    }

    // Generation config
    body.generationConfig = {
      temperature: 0.7,
      maxOutputTokens: 4096,
    };

    return body;
  }

  async chat(messages: AIMessage[]): Promise<string> {
    const body = this.buildBody(messages);
    const res = await fetch(
      `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Gemini API error ${res.status}: ${errData?.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const reason = data.candidates?.[0]?.finishReason;
      if (reason === 'SAFETY') throw new Error('Response blocked by Gemini safety filters');
      throw new Error('Gemini returned empty response');
    }
    return text;
  }

  async stream(
    messages: AIMessage[],
    _tools?: ToolDefinition[],
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    const body = this.buildBody(messages);
    let fullContent = '';

    try {
      const res = await fetch(
        `${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`Gemini API error ${res.status}: ${errData?.error?.message || res.statusText}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (chunk) {
              fullContent += chunk;
              onChunk?.({ type: 'delta', content: chunk });
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    } catch (err) {
      throw err;
    }

    onChunk?.({ type: 'done' });
    return fullContent;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(
      `${this.baseUrl}/models/text-embedding-004:embedContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini embed error: ${res.status}`);
    const data = await res.json();
    return data.embedding?.values || [];
  }
}
