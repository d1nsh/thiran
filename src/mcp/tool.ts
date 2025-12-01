// MCP Tool Wrapper - adapts MCP tools to Thiran's Tool interface

import { BaseTool } from '../tools/base.js';
import type { ToolParameters, ToolResult, ExecutionContext, ParameterProperty } from '../types.js';
import type { MCPClientManager, MCPToolDefinition } from './client.js';

export class MCPToolWrapper extends BaseTool {
  name: string;
  description: string;
  parameters: ToolParameters;

  private mcpManager: MCPClientManager;
  private serverName: string;
  private originalToolName: string;

  constructor(toolDef: MCPToolDefinition, mcpManager: MCPClientManager) {
    super();

    // Prefix tool name to avoid collisions: mcp__{serverName}__{toolName}
    this.name = `mcp__${toolDef.serverName}__${toolDef.name}`;
    this.description = `[MCP: ${toolDef.serverName}] ${toolDef.description}`;
    this.parameters = this.convertSchema(toolDef.inputSchema);

    this.mcpManager = mcpManager;
    this.serverName = toolDef.serverName;
    this.originalToolName = toolDef.name;
  }

  async execute(
    params: Record<string, unknown>,
    _context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      const result = await this.mcpManager.callTool(
        this.serverName,
        this.originalToolName,
        params
      );

      if (result.isError) {
        return this.error(result.content);
      }

      return this.success(result.content);
    } catch (error) {
      return this.error(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Convert MCP JSON Schema to Thiran ToolParameters format
   */
  private convertSchema(mcpSchema: Record<string, unknown>): ToolParameters {
    const properties: Record<string, ParameterProperty> = {};
    const schemaProperties = (mcpSchema.properties as Record<string, unknown>) || {};

    for (const [key, value] of Object.entries(schemaProperties)) {
      const prop = value as Record<string, unknown>;
      properties[key] = this.convertProperty(prop);
    }

    return {
      type: 'object',
      properties,
      required: (mcpSchema.required as string[]) || [],
    };
  }

  /**
   * Convert a single property from MCP schema to Thiran format
   */
  private convertProperty(prop: Record<string, unknown>): ParameterProperty {
    const type = prop.type as string;

    // Map JSON Schema types to Thiran parameter types
    let thiranType: ParameterProperty['type'] = 'string';
    if (type === 'integer' || type === 'number') {
      thiranType = 'number';
    } else if (type === 'boolean') {
      thiranType = 'boolean';
    } else if (type === 'array') {
      thiranType = 'array';
    } else if (type === 'object') {
      thiranType = 'object';
    }

    const result: ParameterProperty = {
      type: thiranType,
      description: (prop.description as string) || '',
    };

    // Handle enum
    if (prop.enum) {
      result.enum = prop.enum as string[];
    }

    // Handle default
    if (prop.default !== undefined) {
      result.default = prop.default;
    }

    // Handle array items
    if (type === 'array' && prop.items) {
      result.items = this.convertProperty(prop.items as Record<string, unknown>);
    }

    return result;
  }
}

/**
 * Create MCP tool wrappers for all available MCP tools
 */
export function createMCPTools(mcpManager: MCPClientManager): MCPToolWrapper[] {
  return mcpManager.getMCPTools().map((toolDef) => new MCPToolWrapper(toolDef, mcpManager));
}
