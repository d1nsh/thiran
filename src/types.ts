// Core types for Thiran

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute(params: Record<string, unknown>, context: ExecutionContext): Promise<ToolResult>;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ParameterProperty>;
  required?: string[];
}

export interface ParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ParameterProperty;
  default?: unknown;
}

export interface ExecutionContext {
  workingDirectory: string;
  permissions: PermissionManager;
  config: ThiranConfig;
}

export interface PermissionManager {
  checkPermission(action: PermissionAction): Promise<PermissionResult>;
  addToAllowList(action: PermissionAction): void;
}

export interface PermissionAction {
  type: 'read' | 'write' | 'execute' | 'file_read' | 'file_write' | 'file_edit' | 'bash_execute' | 'web_fetch';
  path?: string;
  command?: string;
  url?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

export interface PermissionResult {
  granted: boolean;
  reason?: string;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_call_delta' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  delta?: string;
  error?: Error;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  systemPrompt?: string;
  stream?: boolean;
}

export interface LLMProvider {
  name: string;
  defaultModel: string;

  chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk>;
  listModels(): Promise<string[]>;
  supportsTools(): boolean;
}

// MCP Server configuration
export interface MCPServerConfig {
  name: string;                    // Unique identifier for the server
  command: string;                 // Command to run (for stdio transport)
  args?: string[];                 // Command arguments
  env?: Record<string, string>;    // Environment variables for the process
  transport: 'stdio';              // Transport type (stdio only for now)
  enabled?: boolean;               // Whether server is enabled (default: true)
  timeout?: number;                // Connection timeout in ms (default: 30000)
}

export interface ThiranConfig {
  provider: string;
  model?: string;

  // API keys (prefer environment variables)
  anthropicApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
  ollamaBaseUrl?: string;

  // Behavior
  approvalMode: ApprovalMode;
  autoCommit: boolean;

  // Context
  maxContextTokens: number;

  // Security
  allowedPaths: string[];
  blockedCommands: string[];

  // MCP Servers
  mcpServers?: MCPServerConfig[];
}

export enum ApprovalMode {
  SUGGEST = 'suggest',       // Approval for all changes
  AUTO_EDIT = 'auto-edit',   // Auto-approve file edits, prompt for bash
  FULL_AUTO = 'full-auto',   // Fully autonomous (use with caution)
}

export const DEFAULT_CONFIG: ThiranConfig = {
  provider: 'anthropic',
  approvalMode: ApprovalMode.SUGGEST,
  autoCommit: false,
  maxContextTokens: 100000,
  allowedPaths: [],
  blockedCommands: ['rm -rf /', 'mkfs', 'dd if=', ':(){:|:&};:'],
};
