import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIMessage, StreamChunk, ToolDefinition } from '../client';

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
  }

  async chat(messages: AIMessage[]): Promise<string> {
    const system = messages.find((m) => m.role === 'system')?.content;
    const filtered = messages.filter((m) => m.role !== 'system') as Anthropic.MessageParam[];
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: filtered,
    });
    return res.content[0].type === 'text' ? res.content[0].text : '';
  }

  async stream(
    messages: AIMessage[],
    _tools?: ToolDefinition[],
    onChunk?: (chunk: StreamChunk) => void
  ): Promise<string> {
    const system = messages.find((m) => m.role === 'system')?.content;
    const filtered = messages.filter((m) => m.role !== 'system') as Anthropic.MessageParam[];
    let fullContent = '';

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: filtered,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullContent += event.delta.text;
        onChunk?.({ type: 'delta', content: event.delta.text });
      }
    }

    onChunk?.({ type: 'done' });
    return fullContent;
  }

  async embed(text: string): Promise<number[]> {
    // Anthropic doesn't have an embedding API — fall back to a simple hash-based vector
    // In practice, switch to OpenAI or Gemini for embeddings
    throw new Error('Anthropic does not support embeddings. Please use OpenAI or Gemini for semantic search.');
  }
}
