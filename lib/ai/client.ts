import { type AppSettings } from '../db/schema';

export type AIMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export interface StreamChunk {
  type: 'delta' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: string;
}

export interface AIProvider {
  chat(messages: AIMessage[], tools?: ToolDefinition[]): Promise<string>;
  stream(messages: AIMessage[], tools?: ToolDefinition[], onChunk?: (chunk: StreamChunk) => void): Promise<string>;
  embed(text: string): Promise<number[]>;
  listModels?(): Promise<string[]>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export async function getAIProvider(settings: AppSettings): Promise<AIProvider> {
  switch (settings.activeProvider) {
    case 'openai':
      const { OpenAIProvider } = await import('./providers/openai');
      return new OpenAIProvider(settings.openaiKey!, settings.openaiModel);
    case 'gemini':
      const { GeminiProvider } = await import('./providers/gemini');
      return new GeminiProvider(settings.geminiKey!, settings.geminiModel);
    case 'anthropic':
      const { AnthropicProvider } = await import('./providers/anthropic');
      return new AnthropicProvider(settings.anthropicKey!, settings.anthropicModel);
    case 'openrouter':
      const { OpenRouterProvider } = await import('./providers/openrouter');
      return new OpenRouterProvider(settings.openrouterKey!, settings.openrouterModel);
    case 'ollama':
      const { OllamaProvider } = await import('./providers/ollama');
      return new OllamaProvider(settings.ollamaBaseUrl, settings.ollamaModel);
    case 'llm7':
      const { LLM7Provider } = await import('./providers/llm7');
      return new LLM7Provider(settings.llm7Key || '', settings.llm7Model || 'gpt-5.4-mini');
    default:
      throw new Error(`Unknown provider: ${settings.activeProvider}`);
  }
}

export function hasRequiredKey(settings: AppSettings): boolean {
  switch (settings.activeProvider) {
    case 'openai': return !!settings.openaiKey;
    case 'gemini': return !!settings.geminiKey;
    case 'anthropic': return !!settings.anthropicKey;
    case 'openrouter': return !!settings.openrouterKey;
    case 'ollama': return true;
    case 'llm7': return !!settings.llm7Key;
    default: return false;
  }
}
