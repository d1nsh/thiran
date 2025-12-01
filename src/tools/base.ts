import type { Tool, ToolParameters, ToolResult, ExecutionContext } from '../types.js';

export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: ToolParameters;

  abstract execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult>;

  protected success(output: string): ToolResult {
    return { success: true, output };
  }

  protected error(message: string): ToolResult {
    return { success: false, output: '', error: message };
  }
}
