import Anthropic from '@anthropic-ai/sdk';
import type { Message, ChatOptions, StreamChunk, Tool } from '../types.js';
import { BaseProvider } from './base.js';

export class AnthropicProvider extends BaseProvider {
  name = 'anthropic';
  defaultModel = 'claude-sonnet-4-5-20250929';

  private client: Anthropic;

  constructor(apiKey?: string) {
    super();
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const model = options.model || this.defaultModel;
    const systemPrompt = this.buildSystemPrompt(options.systemPrompt);

    // Convert messages to Anthropic format
    const anthropicMessages = this.convertMessages(messages);

    // Format tools for Anthropic
    const tools = options.tools ? this.formatToolsForAnthropic(options.tools) : undefined;

    try {
      const stream = this.client.messages.stream({
        model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        system: systemPrompt,
        messages: anthropicMessages,
        tools,
      });

      let currentToolUse: { id: string; name: string; input: string } | null = null;

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              input: '',
            };
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield {
              type: 'text',
              content: event.delta.text,
            };
          } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
            currentToolUse.input += event.delta.partial_json;
            yield {
              type: 'tool_call_delta',
              delta: event.delta.partial_json,
            };
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolUse) {
            try {
              const args = JSON.parse(currentToolUse.input || '{}');
              yield {
                type: 'tool_call',
                toolCall: {
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  arguments: args,
                },
              };
            } catch {
              yield {
                type: 'error',
                error: new Error(`Failed to parse tool arguments: ${currentToolUse.input}`),
              };
            }
            currentToolUse = null;
          }
        } else if (event.type === 'message_stop') {
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
    // Anthropic doesn't have a models endpoint, return known models
    return [
      'claude-opus-4-5-20251101',
      'claude-haiku-4-5',
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-1',
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ];
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // System messages are handled separately
        continue;
      }

      if (msg.role === 'user') {
        result.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          // Assistant message with tool calls
          const content: Anthropic.ContentBlockParam[] = [];

          if (msg.content) {
            content.push({ type: 'text', text: msg.content });
          }

          for (const toolCall of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.arguments,
            });
          }

          result.push({
            role: 'assistant',
            content,
          });
        } else {
          result.push({
            role: 'assistant',
            content: msg.content,
          });
        }
      } else if (msg.role === 'tool') {
        // Tool results
        result.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.toolCallId!,
              content: msg.content,
            },
          ],
        });
      }
    }

    return result;
  }

  private formatToolsForAnthropic(tools: Tool[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    }));
  }
}
