import OpenAI from 'openai';
import type { Message, ChatOptions, StreamChunk, Tool } from '../types.js';
import { BaseProvider } from './base.js';

export class OpenAIProvider extends BaseProvider {
  name = 'openai';
  defaultModel = 'gpt-5';

  private client: OpenAI;

  constructor(apiKey?: string, baseUrl?: string) {
    super();
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      baseURL: baseUrl,
    });
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const model = options.model || this.defaultModel;
    const systemPrompt = this.buildSystemPrompt(options.systemPrompt);

    // Convert messages to OpenAI format
    const openaiMessages = this.convertMessages(messages, systemPrompt);

    // Format tools for OpenAI
    const tools = options.tools ? this.formatToolsForOpenAI(options.tools) : undefined;

    try {
      const stream = await this.client.chat.completions.create({
        model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        messages: openaiMessages,
        tools,
        stream: true,
      });

      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (!delta) continue;

        // Handle text content
        if (delta.content) {
          yield {
            type: 'text',
            content: delta.content,
          };
        }

        // Handle tool calls
        if (delta.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index;

            if (!toolCalls.has(index)) {
              toolCalls.set(index, {
                id: toolCallDelta.id || '',
                name: toolCallDelta.function?.name || '',
                arguments: '',
              });
            }

            const toolCall = toolCalls.get(index)!;

            if (toolCallDelta.id) {
              toolCall.id = toolCallDelta.id;
            }
            if (toolCallDelta.function?.name) {
              toolCall.name = toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              toolCall.arguments += toolCallDelta.function.arguments;
              yield {
                type: 'tool_call_delta',
                delta: toolCallDelta.function.arguments,
              };
            }
          }
        }

        // Check if stream is done
        if (chunk.choices[0]?.finish_reason) {
          // Emit completed tool calls
          for (const toolCall of toolCalls.values()) {
            try {
              const args = JSON.parse(toolCall.arguments || '{}');
              yield {
                type: 'tool_call',
                toolCall: {
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: args,
                },
              };
            } catch {
              yield {
                type: 'error',
                error: new Error(`Failed to parse tool arguments: ${toolCall.arguments}`),
              };
            }
          }
          yield { type: 'done' };
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data
        .filter(m => m.id.includes('gpt'))
        .map(m => m.id)
        .sort();
    } catch {
      // Return known models if API call fails
      return [
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
        'gpt-5.1',
        'gpt-5.1-mini',
        'gpt-5.1-nano',
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
      ];
    }
  }

  private convertMessages(
    messages: Message[],
    systemPrompt: string
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of messages) {
      if (msg.role === 'system') {
        continue; // Already handled
      }

      if (msg.role === 'user') {
        result.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          result.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          });
        } else {
          result.push({
            role: 'assistant',
            content: msg.content,
          });
        }
      } else if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          tool_call_id: msg.toolCallId!,
          content: msg.content,
        });
      }
    }

    return result;
  }

  private formatToolsForOpenAI(tools: Tool[]): OpenAI.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      },
    }));
  }
}
