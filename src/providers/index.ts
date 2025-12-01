import type { LLMProvider, ThiranConfig } from '../types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import { GeminiProvider } from './gemini.js';

export type ProviderName = 'anthropic' | 'openai' | 'ollama' | 'gemini';

export function createProvider(config: ThiranConfig): LLMProvider {
  const providerName = config.provider as ProviderName;

  switch (providerName) {
    case 'anthropic':
      return new AnthropicProvider(config.anthropicApiKey);
    case 'openai':
      return new OpenAIProvider(config.openaiApiKey);
    case 'ollama':
      return new OllamaProvider(config.ollamaBaseUrl);
    case 'gemini':
      return new GeminiProvider(config.googleApiKey);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function listProviders(): string[] {
  return ['anthropic', 'openai', 'gemini', 'ollama'];
}

export function getProviderModels(provider: string): string[] {
  switch (provider) {
    case 'anthropic':
      return [
        'claude-sonnet-4-5-20250929',
        'claude-opus-4-5-20251101',
        'claude-haiku-4-5-20250929',
        'claude-sonnet-4-20250514',
        'claude-opus-4-20250514',
      ];
    case 'openai':
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
    case 'gemini':
      return [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
      ];
    case 'ollama':
      return [
        'kimi-k2:latest',
        'qwen3:latest',
        'qwen2.5-coder:latest',
        'llama3.3:latest',
        'llama3.2:latest',
        'gemma3:latest',
        'phi4:latest',
        'deepseek-r1:latest',
        'deepseek-coder-v2:latest',
        'mistral:latest',
        'codellama:latest',
        'starcoder2:latest',
      ];
    default:
      return [];
  }
}

export { AnthropicProvider } from './anthropic.js';
export { OpenAIProvider } from './openai.js';
export { OllamaProvider, type PullProgressCallback } from './ollama.js';
export { GeminiProvider } from './gemini.js';
export { BaseProvider } from './base.js';
