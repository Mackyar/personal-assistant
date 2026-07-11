import type { AIProvider, AIMessage, StreamChunk, ToolDefinition } from '../client';

// LLM7.io - free, no API key required. Routed through /api/llm7 proxy to avoid CORS.
export class LLM7Provider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-5.4-mini') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async listModels(): Promise<string[]> {
    return [
      'gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5', 'gpt-5.6-terra',
      'claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5',
      'codestral-latest', 'deepseek-v4-flash', 'devstral-small-2:24b',
      'kimi-k2.6', 'minimax-m2.7'
    ];
  }

  private async callProxy(messages: AIMessage[]): Promise<string> {
    const res = await fetch('/api/llm7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey, model: this.model, messages }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async chat(messages: AIMessage[], _tools?: ToolDefinition[]): Promise<string> {
    return this.callProxy(messages);
  }

  async stream(
    messages: AIMessage[],
    _tools?: ToolDefinition[],
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    // Proxy doesn't support streaming yet; use non-streaming and emit as single chunk
    const content = await this.callProxy(messages);
    onChunk?.({ type: 'delta', content });
    onChunk?.({ type: 'done' });
    return content;
  }

  async embed(_text: string): Promise<number[]> {
    return [];
  }
}
