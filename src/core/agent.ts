import type {
  Message,
  Tool,
  ToolCall,
  StreamChunk,
  LLMProvider,
  ThiranConfig,
  ExecutionContext,
  PermissionManager,
} from '../types.js';

export interface AgentCallbacks {
  onText: (text: string) => void;
  onToolCallStart: (toolCall: ToolCall) => void;
  onToolCallEnd: (toolCall: ToolCall, result: string) => void;
  onError: (error: Error) => void;
  onDone: () => void;
  onPermissionRequest?: (toolCall: ToolCall) => Promise<{ allow: boolean; remember: boolean }>;
}

export class Agent {
  private provider: LLMProvider;
  private tools: Tool[];
  private config: ThiranConfig;
  private messages: Message[] = [];
  private permissions: PermissionManager;
  private workingDirectory: string;

  constructor(
    provider: LLMProvider,
    tools: Tool[],
    config: ThiranConfig,
    permissions: PermissionManager,
    workingDirectory: string
  ) {
    this.provider = provider;
    this.tools = tools;
    this.config = config;
    this.permissions = permissions;
    this.workingDirectory = workingDirectory;
  }

  async run(userMessage: string, callbacks: AgentCallbacks): Promise<void> {
    // Add user message to history
    this.messages.push({
      role: 'user',
      content: userMessage,
    });

    // Agent loop
    let iterations = 0;
    const maxIterations = 20; // Prevent infinite loops

    while (iterations < maxIterations) {
      iterations++;

      try {
        const response = await this.getCompletion(callbacks);

        if (response.done) {
          callbacks.onDone();
          break;
        }

        if (response.toolCalls.length > 0) {
          // Execute tool calls
          await this.executeToolCalls(response.toolCalls, callbacks);
        } else {
          // No tool calls and response is done
          callbacks.onDone();
          break;
        }
      } catch (error) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        break;
      }
    }

    if (iterations >= maxIterations) {
      callbacks.onError(new Error('Max iterations reached'));
    }
  }

  private buildSystemPrompt(): string {
    return `You are Thiran, an AI-powered coding assistant running in the terminal.
You help users with software engineering tasks including writing code, debugging, refactoring, and explaining code.

Current working directory: ${this.workingDirectory}

IMPORTANT: You have access to tools to interact with the file system. When the user asks about files, code, or the project:
1. Use the read_file tool to read files
2. Use the glob tool to find files by pattern
3. Use the grep tool to search for content
4. Use the bash tool to run commands
5. Use the write_file or edit_file tools to modify files

DO NOT ask the user to provide file paths or content - use your tools to explore and read the file system yourself.

Guidelines:
- Be concise and direct in your responses
- Always read a file before attempting to edit it
- Ask for clarification only when requirements are truly ambiguous
- Prefer editing existing files over creating new ones
- Be careful with destructive operations`;
  }

  private async getCompletion(
    callbacks: AgentCallbacks
  ): Promise<{ done: boolean; toolCalls: ToolCall[] }> {
    const stream = await this.provider.chat(this.messages, {
      model: this.config.model,
      tools: this.tools,
      systemPrompt: this.buildSystemPrompt(),
    });

    let textContent = '';
    const toolCalls: ToolCall[] = [];

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'text':
          if (chunk.content) {
            textContent += chunk.content;
            callbacks.onText(chunk.content);
          }
          break;

        case 'tool_call':
          if (chunk.toolCall) {
            toolCalls.push(chunk.toolCall);
            callbacks.onToolCallStart(chunk.toolCall);
          }
          break;

        case 'error':
          if (chunk.error) {
            throw chunk.error;
          }
          break;

        case 'done':
          // Add assistant message to history
          if (textContent || toolCalls.length > 0) {
            this.messages.push({
              role: 'assistant',
              content: textContent,
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            });
          }
          break;
      }
    }

    return {
      done: toolCalls.length === 0,
      toolCalls,
    };
  }

  private async executeToolCalls(
    toolCalls: ToolCall[],
    callbacks: AgentCallbacks
  ): Promise<void> {
    const context: ExecutionContext = {
      workingDirectory: this.workingDirectory,
      permissions: this.permissions,
      config: this.config,
    };

    for (const toolCall of toolCalls) {
      const tool = this.tools.find(t => t.name === toolCall.name);

      if (!tool) {
        const errorResult = `Tool not found: ${toolCall.name}`;
        this.messages.push({
          role: 'tool',
          content: errorResult,
          toolCallId: toolCall.id,
        });
        callbacks.onToolCallEnd(toolCall, errorResult);
        continue;
      }

      // Check permissions before executing tool
      if (callbacks.onPermissionRequest && this.config.approvalMode !== 'full-auto') {
        // Determine if this tool needs approval
        const needsApproval = this.toolNeedsApproval(tool.name, toolCall.arguments);

        if (needsApproval) {
          const decision = await callbacks.onPermissionRequest(toolCall);

          if (!decision.allow) {
            const deniedResult = 'Tool execution denied by user';
            this.messages.push({
              role: 'tool',
              content: deniedResult,
              toolCallId: toolCall.id,
            });
            callbacks.onToolCallEnd(toolCall, deniedResult);
            continue;
          }
        }
      }

      try {
        const result = await tool.execute(toolCall.arguments, context);

        const resultContent = result.success
          ? result.output
          : `Error: ${result.error}\n${result.output}`;

        this.messages.push({
          role: 'tool',
          content: resultContent,
          toolCallId: toolCall.id,
        });

        callbacks.onToolCallEnd(toolCall, resultContent);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorResult = `Tool execution failed: ${errorMessage}`;

        this.messages.push({
          role: 'tool',
          content: errorResult,
          toolCallId: toolCall.id,
        });

        callbacks.onToolCallEnd(toolCall, errorResult);
      }
    }
  }

  private toolNeedsApproval(toolName: string, args: Record<string, unknown>): boolean {
    // Read operations don't need approval in 'suggest' mode
    if (this.config.approvalMode === 'suggest') {
      const readOnlyTools = ['read_file', 'glob', 'grep'];
      if (readOnlyTools.includes(toolName)) {
        return false;
      }
    }

    // Write and execute operations always need approval unless in full-auto
    const dangerousTools = ['write_file', 'edit_file', 'bash'];
    if (dangerousTools.includes(toolName)) {
      return true;
    }

    return false;
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clearHistory(): void {
    this.messages = [];
  }

  setSystemPrompt(prompt: string): void {
    // Remove existing system message if present
    this.messages = this.messages.filter(m => m.role !== 'system');

    // Add new system message at the beginning
    this.messages.unshift({
      role: 'system',
      content: prompt,
    });
  }
}
