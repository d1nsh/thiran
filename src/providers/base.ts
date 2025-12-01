import type { LLMProvider, Message, ChatOptions, StreamChunk, Tool } from '../types.js';

export abstract class BaseProvider implements LLMProvider {
  abstract name: string;
  abstract defaultModel: string;

  abstract chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk>;
  abstract listModels(): Promise<string[]>;

  supportsTools(): boolean {
    return true;
  }

  protected formatToolsForProvider(tools: Tool[]): unknown[] {
    // Override in subclasses for provider-specific formatting
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  protected buildSystemPrompt(customPrompt?: string): string {
    const basePrompt = `You are Thiran, an AI-powered coding assistant running in the terminal.
You help users with software engineering tasks including writing code, debugging, refactoring, and explaining code.

Guidelines:
- Be concise and direct in your responses
- Use the available tools to read, write, and edit files
- Always read a file before attempting to edit it
- Ask for clarification when requirements are ambiguous
- Prefer editing existing files over creating new ones
- Be careful with destructive operations`;

    return customPrompt ? `${basePrompt}\n\n${customPrompt}` : basePrompt;
  }
}
