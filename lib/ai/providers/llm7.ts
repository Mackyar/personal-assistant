import type { AIProvider, AIMessage, StreamChunk, ToolDefinition } from '../client';

// LLM7.io - free, no API key required. Routed through /api/llm7 proxy to avoid CORS.
export class LLM7Provider implements AIProvider {
  private model: string;

  constructor(model = 'gpt-4.1-mini') {
    this.model = model;
  }

  async listModels(): Promise<string[]> {
    return [
      'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini',
      'claude-3-7-sonnet', 'claude-3-5-sonnet-20241022',
      'deepseek-v3-0324', 'deepseek-r1',
      'gemini-2.5-flash', 'gemini-2.0-flash',
      'llama-3.3-70b-instruct', 'mistral-large-2411',
    ];
  }

  private async callProxy(messages: AIMessage[]): Promise<string> {
    const res = await fetch('/api/llm7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages }),
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
