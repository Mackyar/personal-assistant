import OpenAI from 'openai';
import type { AIProvider, AIMessage, StreamChunk, ToolDefinition } from '../client';

// LLM7.io is OpenAI-compatible: free, no auth needed, supports many models
export class LLM7Provider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(model = 'gpt-4.1-mini') {
    this.client = new OpenAI({
      apiKey: 'not-required', // LLM7 does not require a key
      baseURL: 'https://llm7.io/v1',
      dangerouslyAllowBrowser: true,
    });
    this.model = model;
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await this.client.models.list();
      return res.data.map(m => m.id);
    } catch {
      return ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o', 'claude-3-7-sonnet', 'deepseek-v3-0324', 'gemini-2.5-flash'];
    }
  }

  async chat(messages: AIMessage[], tools?: ToolDefinition[]): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools: tools?.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
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
      tools: tools?.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
    });

    let fullContent = '';
    let toolCallBuffer: { name: string; args: string } | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullContent += delta.content;
        onChunk?.({ type: 'delta', content: delta.content });
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            toolCallBuffer = { name: tc.function.name, args: tc.function.arguments || '' };
          } else if (tc.function?.arguments && toolCallBuffer) {
            toolCallBuffer.args += tc.function.arguments;
          }
        }
      }
      if (chunk.choices[0]?.finish_reason === 'tool_calls' && toolCallBuffer) {
        try {
          const args = JSON.parse(toolCallBuffer.args);
          onChunk?.({ type: 'tool_call', toolName: toolCallBuffer.name, toolArgs: args });
        } catch {}
        toolCallBuffer = null;
      }
    }

    onChunk?.({ type: 'done' });
    return fullContent;
  }

  async embed(_text: string): Promise<number[]> {
    // LLM7 does not have an embeddings endpoint; return empty
    return [];
  }
}
