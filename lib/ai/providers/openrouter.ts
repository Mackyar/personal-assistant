import OpenAI from 'openai';
import type { AIProvider, AIMessage, StreamChunk, ToolDefinition } from '../client';

export class OpenRouterProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Personal Assistant',
      },
    });
    this.model = model;
  }

  async chat(messages: AIMessage[]): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
    });
    return res.choices[0]?.message?.content || '';
  }

  async stream(
    messages: AIMessage[],
    tools?: ToolDefinition[],
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        onChunk?.({ type: 'delta', content: delta });
      }
    }
    onChunk?.({ type: 'done' });
    return fullContent;
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: text,
    });
    return res.data[0].embedding;
  }

  async listModels(): Promise<string[]> {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${this.client.apiKey}` },
    });
    const data = await res.json();
    return (data.data || []).map((m: { id: string }) => m.id);
  }
}
