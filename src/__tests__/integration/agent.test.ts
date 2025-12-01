import { describe, it, expect, beforeEach } from '@jest/globals';
import { Agent } from '../../core/agent.js';
import { ReadFileTool, WriteFileTool } from '../../tools/index.js';
import type { LLMProvider, ChatOptions, StreamChunk, ThiranConfig } from '../../types.js';
import { DefaultPermissionManager } from '../../security/permissions.js';

// Mock LLM Provider for testing
class MockProvider implements LLMProvider {
  name = 'mock';
  defaultModel = 'mock-model';

  private responses: StreamChunk[] = [];

  setResponses(responses: StreamChunk[]) {
    this.responses = responses;
  }

  async *chat(messages: any[], options: ChatOptions): AsyncIterable<StreamChunk> {
    for (const chunk of this.responses) {
      yield chunk;
    }
  }

  async listModels(): Promise<string[]> {
    return ['mock-model'];
  }

  supportsTools(): boolean {
    return true;
  }
}

describe('Agent Integration Tests', () => {
  let mockProvider: MockProvider;
  let agent: Agent;
  let config: ThiranConfig;

  beforeEach(() => {
    mockProvider = new MockProvider();
    config = {
      provider: 'mock',
      model: 'mock-model',
      approvalMode: 'full-auto' as any,
      autoCommit: false,
      maxContextTokens: 100000,
      allowedPaths: [],
      blockedCommands: [],
    };

    const tools = [new ReadFileTool(), new WriteFileTool()];
    const permissions = new DefaultPermissionManager(
      'full-auto' as any,
      process.cwd(),
      async () => ({ allow: true, remember: false })
    );

    agent = new Agent(mockProvider, tools, config, permissions, process.cwd());
  });

  it('should process text responses', async () => {
    mockProvider.setResponses([
      { type: 'text', content: 'Hello' },
      { type: 'text', content: ' World' },
      { type: 'done' },
    ]);

    let receivedText = '';
    let doneCallbackCalled = false;

    await agent.run('test prompt', {
      onText: (text) => {
        receivedText += text;
      },
      onToolCallStart: () => {},
      onToolCallEnd: () => {},
      onError: () => {},
      onDone: () => {
        doneCallbackCalled = true;
      },
    });

    expect(receivedText).toBe('Hello World');
    expect(doneCallbackCalled).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    mockProvider.setResponses([
      {
        type: 'error',
        error: new Error('Test error'),
      },
    ]);

    let errorCallbackCalled = false;

    await agent.run('test prompt', {
      onText: () => {},
      onToolCallStart: () => {},
      onToolCallEnd: () => {},
      onError: (error) => {
        errorCallbackCalled = true;
        expect(error.message).toBe('Test error');
      },
      onDone: () => {},
    });

    expect(errorCallbackCalled).toBe(true);
  });
});
