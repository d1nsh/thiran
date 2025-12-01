import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { ToolParameters, ToolResult, ExecutionContext } from '../types.js';

export class ReadFileTool extends BaseTool {
  name = 'read_file';
  description =
    'Read the contents of a file. Returns the file contents with line numbers. Use this before editing a file.';

  parameters: ToolParameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute or relative path to the file to read',
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-indexed). Optional.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read. Optional.',
      },
    },
    required: ['file_path'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const filePath = params.file_path as string;
    const offset = (params.offset as number) || 1;
    const limit = params.limit as number | undefined;

    try {
      // Resolve path relative to working directory
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(context.workingDirectory, filePath);

      // Note: Permission is checked by the Agent before tool execution

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch {
        return this.error(`File not found: ${absolutePath}`);
      }

      // Read file
      const content = await fs.readFile(absolutePath, 'utf-8');
      const lines = content.split('\n');

      // Apply offset and limit
      const startLine = Math.max(1, offset) - 1;
      const endLine = limit ? startLine + limit : lines.length;
      const selectedLines = lines.slice(startLine, endLine);

      // Format with line numbers
      const numberedLines = selectedLines.map((line, idx) => {
        const lineNum = startLine + idx + 1;
        const padding = String(endLine).length;
        return `${String(lineNum).padStart(padding, ' ')}\t${line}`;
      });

      const output = numberedLines.join('\n');
      const totalLines = lines.length;

      let header = `File: ${absolutePath}\n`;
      if (offset > 1 || limit) {
        header += `Lines ${startLine + 1}-${Math.min(endLine, totalLines)} of ${totalLines}\n`;
      } else {
        header += `Total lines: ${totalLines}\n`;
      }
      header += '---\n';

      return this.success(header + output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to read file: ${message}`);
    }
  }
}
