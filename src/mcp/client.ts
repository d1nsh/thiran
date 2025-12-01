// MCP Client Manager - handles connections to MCP servers

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig } from '../types.js';
import { MCPConnectionError, MCPToolExecutionError } from './errors.js';

export interface MCPServerStatus {
  name: string;
  connected: boolean;
  error?: string;
  toolCount: number;
  tools: string[];
}

export interface MCPToolDefinition {
  serverName: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface ConnectedServer {
  client: Client;
  transport: StdioClientTransport;
  config: MCPServerConfig;
  tools: MCPToolDefinition[];
  error?: string;
}

export class MCPClientManager {
  private servers: Map<string, ConnectedServer> = new Map();
  private serverConfigs: Map<string, MCPServerConfig> = new Map();

  /**
   * Connect to a single MCP server
   */
  async connectServer(config: MCPServerConfig): Promise<void> {
    if (config.enabled === false) {
      return;
    }

    // Store config for reconnection
    this.serverConfigs.set(config.name, config);

    try {
      // Create transport
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: {
          ...process.env,
          ...config.env,
        } as Record<string, string>,
      });

      // Create client
      const client = new Client(
        {
          name: 'thiran',
          version: '0.1.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect with timeout
      const timeout = config.timeout || 30000;
      await Promise.race([
        client.connect(transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), timeout)
        ),
      ]);

      // Fetch available tools
      const toolsResponse = await client.listTools();
      const tools: MCPToolDefinition[] = (toolsResponse.tools || []).map((tool) => ({
        serverName: config.name,
        name: tool.name,
        description: tool.description || '',
        inputSchema: (tool.inputSchema as Record<string, unknown>) || {},
      }));

      // Store connected server
      this.servers.set(config.name, {
        client,
        transport,
        config,
        tools,
      });
    } catch (error) {
      // Store failed connection info
      this.servers.set(config.name, {
        client: null as any,
        transport: null as any,
        config,
        tools: [],
        error: error instanceof Error ? error.message : String(error),
      });
      throw new MCPConnectionError(config.name, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Connect to all enabled MCP servers
   */
  async connectAll(configs: MCPServerConfig[]): Promise<void> {
    const results = await Promise.allSettled(
      configs.filter((c) => c.enabled !== false).map((config) => this.connectServer(config))
    );

    // Log any failures but don't throw
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(`${failures.length} MCP server(s) failed to connect`);
    }
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (server?.client) {
      try {
        await server.client.close();
      } catch {
        // Ignore close errors
      }
    }
    this.servers.delete(serverName);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.servers.keys()).map((name) =>
      this.disconnectServer(name)
    );
    await Promise.allSettled(disconnectPromises);
  }

  /**
   * Reconnect to a specific server
   */
  async reconnectServer(serverName: string): Promise<void> {
    const config = this.serverConfigs.get(serverName);
    if (!config) {
      throw new Error(`Unknown server: ${serverName}`);
    }

    await this.disconnectServer(serverName);
    await this.connectServer(config);
  }

  /**
   * Reconnect to all servers
   */
  async reconnectAll(): Promise<void> {
    await this.disconnectAll();
    const configs = Array.from(this.serverConfigs.values());
    await this.connectAll(configs);
  }

  /**
   * Get status of a specific server
   */
  getServerStatus(serverName: string): MCPServerStatus | undefined {
    const server = this.servers.get(serverName);
    if (!server) {
      return undefined;
    }

    return {
      name: serverName,
      connected: !!server.client && !server.error,
      error: server.error,
      toolCount: server.tools.length,
      tools: server.tools.map((t) => t.name),
    };
  }

  /**
   * Get status of all servers
   */
  getAllServerStatus(): MCPServerStatus[] {
    return Array.from(this.servers.keys())
      .map((name) => this.getServerStatus(name))
      .filter((s): s is MCPServerStatus => s !== undefined);
  }

  /**
   * Get all available MCP tools
   */
  getMCPTools(): MCPToolDefinition[] {
    const tools: MCPToolDefinition[] = [];
    for (const server of this.servers.values()) {
      if (!server.error) {
        tools.push(...server.tools);
      }
    }
    return tools;
  }

  /**
   * Execute a tool on a specific server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ content: string; isError: boolean }> {
    const server = this.servers.get(serverName);
    if (!server || !server.client) {
      throw new MCPToolExecutionError(serverName, toolName, new Error('Server not connected'));
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args,
      });

      // Extract content from result
      const contentArray = result.content as Array<{ type: string; text?: string }>;
      const content = contentArray
        .map((c: { type: string; text?: string }) => {
          if (c.type === 'text' && c.text) {
            return c.text;
          }
          return JSON.stringify(c);
        })
        .join('\n');

      return {
        content,
        isError: Boolean(result.isError),
      };
    } catch (error) {
      throw new MCPToolExecutionError(
        serverName,
        toolName,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if any servers are configured
   */
  hasServers(): boolean {
    return this.servers.size > 0;
  }

  /**
   * Get count of connected servers
   */
  getConnectedCount(): number {
    return Array.from(this.servers.values()).filter((s) => !s.error).length;
  }
}
