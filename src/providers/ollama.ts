import type { Message, ChatOptions, StreamChunk, Tool } from '../types.js';
import { BaseProvider } from './base.js';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaStreamResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

interface OllamaPullResponse {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export interface PullProgressCallback {
  (status: string, completed?: number, total?: number): void;
}

export class OllamaProvider extends BaseProvider {
  name = 'ollama';
  defaultModel = 'llama3.2';

  private baseUrl: string;

  constructor(baseUrl?: string) {
    super();
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const model = options.model || this.defaultModel;

    // Note: Ollama's tool support is limited, we'll use prompt-based approach
    const toolsPrompt = options.tools ? this.formatToolsAsPrompt(options.tools) : '';

    // Build system prompt with tools included
    const systemPrompt = this.buildSystemPrompt(options.systemPrompt) + (toolsPrompt ? `\n\n${toolsPrompt}` : '');

    // Convert messages to Ollama format
    const ollamaMessages = this.convertMessages(messages, systemPrompt);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature: options.temperature,
            num_predict: options.maxTokens || 4096,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete JSON lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data: OllamaStreamResponse = JSON.parse(line);

            if (data.message?.content) {
              const content = data.message.content;
              fullResponse += content;

              // Clean the content before displaying (remove tool tokens but keep text)
              const cleanContent = this.cleanStreamContent(content);
              if (cleanContent) {
                yield {
                  type: 'text',
                  content: cleanContent,
                };
              }
            }

          } catch {
            // Ignore malformed JSON
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.trim()) {
        try {
          const data: OllamaStreamResponse = JSON.parse(buffer);
          if (data.message?.content) {
            fullResponse += data.message.content;
            const cleanContent = this.cleanStreamContent(data.message.content);
            if (cleanContent) {
              yield {
                type: 'text',
                content: cleanContent,
              };
            }
          }
        } catch {
          // Ignore malformed JSON
        }
      }

      // Extract tool calls and emit done
      const toolCalls = this.extractToolCalls(fullResponse, options.tools || []);
      for (const toolCall of toolCalls) {
        yield {
          type: 'tool_call',
          toolCall,
        };
      }
      yield { type: 'done' };
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = (await response.json()) as { models: OllamaModel[] };
      return data.models.map(m => m.name);
    } catch {
      return ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'deepseek-coder'];
    }
  }

  /**
   * List locally installed models
   */
  async listLocalModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as { models: OllamaModel[] };
      return data.models.map(m => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Check if a model is available locally
   */
  async isModelAvailable(model: string): Promise<boolean> {
    const localModels = await this.listLocalModels();
    // Check for exact match or match without tag
    return localModels.some(m =>
      m === model ||
      m.split(':')[0] === model ||
      model.split(':')[0] === m.split(':')[0]
    );
  }

  /**
   * Pull/download a model from Ollama registry
   */
  async pullModel(model: string, onProgress?: PullProgressCallback): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: model,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data: OllamaPullResponse = JSON.parse(line);

          if (onProgress) {
            onProgress(data.status, data.completed, data.total);
          }

          if (data.status === 'success') {
            return;
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    }
  }

  /**
   * Check if Ollama server is running
   */
  async isServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Search for models in the Ollama library
   * Note: Ollama doesn't have a direct search API, so we fetch from ollama.com
   */
  async searchModels(query: string): Promise<string[]> {
    try {
      // Ollama library page - we'll scrape popular models
      const response = await fetch(`https://ollama.com/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        return this.getPopularModels().filter(m =>
          m.toLowerCase().includes(query.toLowerCase())
        );
      }

      const html = await response.text();
      // Extract model names from the search results
      const modelRegex = /href="\/library\/([^"]+)"/g;
      const models: string[] = [];
      let match;

      while ((match = modelRegex.exec(html)) !== null) {
        const modelName = match[1];
        if (!models.includes(modelName)) {
          models.push(modelName);
        }
      }

      return models.length > 0 ? models.slice(0, 20) : this.getPopularModels().filter(m =>
        m.toLowerCase().includes(query.toLowerCase())
      );
    } catch {
      // Fallback to filtering popular models
      return this.getPopularModels().filter(m =>
        m.toLowerCase().includes(query.toLowerCase())
      );
    }
  }

  /**
   * Get list of popular/recommended models
   */
  getPopularModels(): string[] {
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
      'nomic-embed-text:latest',
      'llava:latest',
      'granite-code:latest',
      'dolphin-mixtral:latest',
    ];
  }

  supportsTools(): boolean {
    // Ollama has limited native tool support, we use prompt-based extraction
    return true;
  }

  private convertMessages(messages: Message[], systemPrompt: string): OllamaMessage[] {
    const result: OllamaMessage[] = [{ role: 'system', content: systemPrompt }];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (msg.role === 'user' || msg.role === 'tool') {
        result.push({
          role: 'user',
          content: msg.role === 'tool' ? `Tool result: ${msg.content}` : msg.content,
        });
      } else if (msg.role === 'assistant') {
        result.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    }

    return result;
  }

  private formatToolsAsPrompt(tools: Tool[]): string {
    const toolDescriptions = tools
      .map(tool => {
        const params = Object.entries(tool.parameters.properties)
          .map(([name, prop]) => {
            const required = tool.parameters.required?.includes(name) ? ' (required)' : '';
            return `    - ${name}${required}: ${prop.description}`;
          })
          .join('\n');
        return `  ${tool.name}: ${tool.description}\n${params}`;
      })
      .join('\n\n');

    return `
=== AVAILABLE TOOLS ===
You MUST use these tools to interact with the file system. Do NOT ask the user for file contents.

${toolDescriptions}

=== HOW TO USE TOOLS ===
To use a tool, include a JSON block in EXACTLY this format:

\`\`\`tool
{"tool": "tool_name", "arguments": {"param1": "value1"}}
\`\`\`

EXAMPLES:
To read a file:
\`\`\`tool
{"tool": "read_file", "arguments": {"file_path": "src/index.ts"}}
\`\`\`

To list files:
\`\`\`tool
{"tool": "glob", "arguments": {"pattern": "**/*.ts"}}
\`\`\`

To search for content:
\`\`\`tool
{"tool": "grep", "arguments": {"pattern": "function", "path": "src"}}
\`\`\`

To run a command:
\`\`\`tool
{"tool": "bash", "arguments": {"command": "ls -la"}}
\`\`\`

IMPORTANT: Start by using tools to explore the codebase. Do NOT ask the user to provide file paths or content.`;
  }

  private extractToolCalls(
    response: string,
    tools: Tool[]
  ): { id: string; name: string; arguments: Record<string, unknown> }[] {
    const toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];
    const toolNames = new Set(tools.map(t => t.name));

    // Try multiple formats for tool extraction

    // Format 1: Our custom ```tool format
    const toolBlockRegex = /```tool\s*([\s\S]*?)```/g;
    let match;

    while ((match = toolBlockRegex.exec(response)) !== null) {
      try {
        const toolData = JSON.parse(match[1].trim());
        if (toolData.tool && toolNames.has(toolData.tool)) {
          toolCalls.push({
            id: `ollama_${Date.now()}_${toolCalls.length}`,
            name: toolData.tool,
            arguments: toolData.arguments || {},
          });
        }
      } catch {
        // Ignore malformed tool blocks
      }
    }

    // Format 2: DeepSeek style <｜tool▁call▁begin｜>function<｜tool▁sep｜>name format
    const deepseekRegex = /<｜tool▁call▁begin｜>function<｜tool▁sep｜>(\w+)\s*[\s\S]*?```(?:json)?\s*([\s\S]*?)```[\s\S]*?<｜tool▁call▁end｜>/g;

    while ((match = deepseekRegex.exec(response)) !== null) {
      try {
        const toolName = match[1].trim();
        const argsJson = match[2].trim();
        const args = JSON.parse(argsJson);

        if (toolNames.has(toolName)) {
          toolCalls.push({
            id: `ollama_${Date.now()}_${toolCalls.length}`,
            name: toolName,
            arguments: args,
          });
        }
      } catch {
        // Ignore malformed tool blocks
      }
    }

    // Format 3: Simple function call format (some models)
    const simpleFuncRegex = /<function=(\w+)>([\s\S]*?)<\/function>/g;

    while ((match = simpleFuncRegex.exec(response)) !== null) {
      try {
        const toolName = match[1].trim();
        const argsJson = match[2].trim();
        const args = JSON.parse(argsJson);

        if (toolNames.has(toolName)) {
          toolCalls.push({
            id: `ollama_${Date.now()}_${toolCalls.length}`,
            name: toolName,
            arguments: args,
          });
        }
      } catch {
        // Ignore malformed tool blocks
      }
    }

    return toolCalls;
  }

  /**
   * Clean streaming content - removes special tokens but keeps readable text
   */
  private cleanStreamContent(content: string): string {
    // Remove special tokens but keep the actual content
    let cleaned = content
      // DeepSeek tool tokens
      .replace(/<｜tool▁calls▁begin｜>/g, '\n')
      .replace(/<｜tool▁calls▁end｜>/g, '\n')
      .replace(/<｜tool▁call▁begin｜>/g, '')
      .replace(/<｜tool▁call▁end｜>/g, '\n')
      .replace(/<｜tool▁outputs▁begin｜>/g, '')
      .replace(/<｜tool▁outputs▁end｜>/g, '\n')
      .replace(/<｜tool▁output▁begin｜>/g, '')
      .replace(/<｜tool▁output▁end｜>/g, '')
      .replace(/<｜tool▁sep｜>/g, ': ')
      // Thinking tokens - add visual separators
      .replace(/<think>/g, '\n💭 Thinking...\n')
      .replace(/<\/think>/g, '\n───────────────\n')
      .replace(/<｜begin▁of▁thought｜>/g, '\n💭 Thinking...\n')
      .replace(/<｜end▁of▁thought｜>/g, '\n───────────────\n');

    return cleaned;
  }

  /**
   * Clean response text by removing tool call tokens and formatting
   */
  cleanResponseText(text: string): string {
    // Remove DeepSeek style tool tokens
    let cleaned = text
      .replace(/<｜tool▁calls▁begin｜>/g, '')
      .replace(/<｜tool▁calls▁end｜>/g, '')
      .replace(/<｜tool▁call▁begin｜>[\s\S]*?<｜tool▁call▁end｜>/g, '')
      .replace(/<｜tool▁outputs▁begin｜>[\s\S]*?<｜tool▁outputs▁end｜>/g, '')
      .replace(/<｜tool▁sep｜>/g, '')
      .replace(/<function=\w+>[\s\S]*?<\/function>/g, '')
      .replace(/```tool[\s\S]*?```/g, '')
      // Remove thinking blocks
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/<｜begin▁of▁thought｜>[\s\S]*?<｜end▁of▁thought｜>/g, '');

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    return cleaned;
  }
}
