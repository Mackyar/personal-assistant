import OpenAI from 'openai';
import type { AIProvider, AIMessage, StreamChunk, ToolDefinition } from '../client';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    this.model = model;
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

  async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return res.data[0].embedding;
  }
}
