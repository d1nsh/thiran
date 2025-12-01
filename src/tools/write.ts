import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { ToolParameters, ToolResult, ExecutionContext } from '../types.js';

export class WriteFileTool extends BaseTool {
  name = 'write_file';
  description =
    'Write content to a file. Creates the file if it does not exist, or overwrites if it does. Use edit_file for modifying existing files.';

  parameters: ToolParameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute or relative path to the file to write',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
    },
    required: ['file_path', 'content'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const filePath = params.file_path as string;
    const content = params.content as string;

    try {
      // Resolve path relative to working directory
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(context.workingDirectory, filePath);

      // Note: Permission is checked by the Agent before tool execution

      // Create directory if it doesn't exist
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });

      // Check if file exists (for reporting)
      let existed = false;
      try {
        await fs.access(absolutePath);
        existed = true;
      } catch {
        // File doesn't exist, that's fine
      }

      // Write file
      await fs.writeFile(absolutePath, content, 'utf-8');

      const lines = content.split('\n').length;
      const action = existed ? 'Updated' : 'Created';

      return this.success(`${action} ${absolutePath} (${lines} lines)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to write file: ${message}`);
    }
  }
}
