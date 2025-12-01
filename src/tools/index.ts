import type { Tool } from '../types.js';
import { ReadFileTool } from './read.js';
import { WriteFileTool } from './write.js';
import { EditFileTool } from './edit.js';
import { BashTool } from './bash.js';
import { GlobTool } from './glob.js';
import { GrepTool } from './grep.js';
import type { MCPClientManager } from '../mcp/index.js';
import { createMCPTools } from '../mcp/index.js';

export function createTools(): Tool[] {
  return [
    new ReadFileTool(),
    new WriteFileTool(),
    new EditFileTool(),
    new BashTool(),
    new GlobTool(),
    new GrepTool(),
  ];
}

/**
 * Create tools including MCP tools from connected servers
 */
export function createToolsWithMCP(mcpManager: MCPClientManager): Tool[] {
  const builtInTools = createTools();
  const mcpTools = createMCPTools(mcpManager);
  return [...builtInTools, ...mcpTools];
}

export { ReadFileTool } from './read.js';
export { WriteFileTool } from './write.js';
export { EditFileTool } from './edit.js';
export { BashTool } from './bash.js';
export { GlobTool } from './glob.js';
export { GrepTool } from './grep.js';
