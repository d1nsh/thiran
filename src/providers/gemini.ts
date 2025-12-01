import {
  GoogleGenerativeAI,
  Content,
  Part,
  SchemaType,
  type FunctionDeclaration,
  type FunctionDeclarationSchema,
} from '@google/generative-ai';
import type { Message, ChatOptions, StreamChunk, Tool } from '../types.js';
import { BaseProvider } from './base.js';

export class GeminiProvider extends BaseProvider {
  name = 'gemini';
  defaultModel = 'gemini-2.5-flash';

  private client: GoogleGenerativeAI;

  constructor(apiKey?: string) {
    super();
    const key = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Google API key is required (GOOGLE_API_KEY or GEMINI_API_KEY)');
    }
    this.client = new GoogleGenerativeAI(key);
  }

  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const modelName = options.model || this.defaultModel;
    const systemPrompt = this.buildSystemPrompt(options.systemPrompt);

    // Format tools for Gemini
    const tools = options.tools ? this.formatToolsForGemini(options.tools) : undefined;

    const model = this.client.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      tools: tools ? [{ functionDeclarations: tools }] : undefined,
    });

    // Convert messages to Gemini format
    const geminiContents = this.convertMessages(messages);

    try {
      const chat = model.startChat({
        history: geminiContents.slice(0, -1),
      });

      // Get the last message to send
      const lastMessage = geminiContents[geminiContents.length - 1];
      const lastParts = lastMessage?.parts || [{ text: '' }];

      const result = await chat.sendMessageStream(lastParts);

      let functionCalls: { name: string; args: Record<string, unknown> }[] = [];

      for await (const chunk of result.stream) {
        const candidate = chunk.candidates?.[0];
        if (!candidate) continue;

        for (const part of candidate.content.parts) {
          if ('text' in part && part.text) {
            yield {
              type: 'text',
              content: part.text,
            };
          }

          if ('functionCall' in part && part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              args: (part.functionCall.args as Record<string, unknown>) || {},
            });
          }
        }
      }

      // Emit function calls at the end
      for (let i = 0; i < functionCalls.length; i++) {
        const fc = functionCalls[i];
        yield {
          type: 'tool_call',
          toolCall: {
            id: `gemini_${Date.now()}_${i}`,
            name: fc.name,
            arguments: fc.args,
          },
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
    // Gemini doesn't have a simple models list endpoint, return known models
    return [
      'gemini-3-pro',
      'gemini-3-pro-image',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
    ];
  }

  private convertMessages(messages: Message[]): Content[] {
    const contents: Content[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // System messages are handled via systemInstruction
        continue;
      }

      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        const parts: Part[] = [];

        if (msg.content) {
          parts.push({ text: msg.content });
        }

        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const toolCall of msg.toolCalls) {
            parts.push({
              functionCall: {
                name: toolCall.name,
                args: toolCall.arguments,
              },
            });
          }
        }

        if (parts.length > 0) {
          contents.push({
            role: 'model',
            parts,
          });
        }
      } else if (msg.role === 'tool') {
        // Tool results in Gemini are sent as function responses
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: msg.toolCallId || 'unknown',
                response: { result: msg.content },
              },
            },
          ],
        });
      }
    }

    // Ensure we have at least one message
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: '' }],
      });
    }

    return contents;
  }

  private formatToolsForGemini(tools: Tool[]): FunctionDeclaration[] {
    return tools.map(tool => {
      // Build properties with proper schema structure
      const properties: Record<string, object> = {};

      for (const [key, prop] of Object.entries(tool.parameters.properties)) {
        if (prop.enum && prop.enum.length > 0) {
          // Enum string type
          properties[key] = {
            type: SchemaType.STRING,
            format: 'enum',
            enum: prop.enum,
            description: prop.description,
          };
        } else {
          // Regular type
          properties[key] = {
            type: this.mapTypeToGemini(prop.type),
            description: prop.description,
          };
        }
      }

      const parameters: FunctionDeclarationSchema = {
        type: SchemaType.OBJECT,
        properties: properties as FunctionDeclarationSchema['properties'],
        required: tool.parameters.required || [],
      };

      return {
        name: tool.name,
        description: tool.description,
        parameters,
      };
    });
  }

  private mapTypeToGemini(type: string): SchemaType {
    switch (type) {
      case 'string':
        return SchemaType.STRING;
      case 'number':
        return SchemaType.NUMBER;
      case 'boolean':
        return SchemaType.BOOLEAN;
      case 'array':
        return SchemaType.ARRAY;
      case 'object':
        return SchemaType.OBJECT;
      default:
        return SchemaType.STRING;
    }
  }
}
