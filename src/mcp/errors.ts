// MCP-specific error classes

export class MCPError extends Error {
  constructor(
    message: string,
    public serverName: string,
    public code?: string
  ) {
    super(`[MCP ${serverName}] ${message}`);
    this.name = 'MCPError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(serverName: string, cause?: Error) {
    super(
      `Failed to connect: ${cause?.message || 'Unknown error'}`,
      serverName,
      'CONNECTION_ERROR'
    );
    this.name = 'MCPConnectionError';
  }
}

export class MCPToolExecutionError extends MCPError {
  constructor(serverName: string, toolName: string, cause?: Error) {
    super(
      `Tool ${toolName} failed: ${cause?.message || 'Unknown error'}`,
      serverName,
      'TOOL_ERROR'
    );
    this.name = 'MCPToolExecutionError';
  }
}

export class MCPTimeoutError extends MCPError {
  constructor(serverName: string, operation: string) {
    super(`Timeout during ${operation}`, serverName, 'TIMEOUT');
    this.name = 'MCPTimeoutError';
  }
}
