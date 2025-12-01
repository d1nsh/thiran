import { glob } from 'glob';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { ToolParameters, ToolResult, ExecutionContext } from '../types.js';

export class GlobTool extends BaseTool {
  name = 'glob';
  description = `Find files matching a glob pattern.
Use patterns like "**/*.ts" to find all TypeScript files, or "src/**/*.js" for JS files in src.
Returns matching file paths sorted by modification time (most recent first).`;

  parameters: ToolParameters = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The glob pattern to match files against (e.g., "**/*.ts", "src/**/*.js")',
      },
      path: {
        type: 'string',
        description: 'The directory to search in. Defaults to current working directory.',
      },
    },
    required: ['pattern'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const pattern = params.pattern as string;
    const searchPath = params.path as string | undefined;

    try {
      const baseDir = searchPath
        ? path.isAbsolute(searchPath)
          ? searchPath
          : path.resolve(context.workingDirectory, searchPath)
        : context.workingDirectory;

      // Execute glob
      const files = await glob(pattern, {
        cwd: baseDir,
        nodir: true,
        dot: false,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      });

      if (files.length === 0) {
        return this.success(`No files found matching pattern: ${pattern}`);
      }

      // Sort by name for consistency
      files.sort();

      // Limit output to prevent overwhelming context
      const maxFiles = 100;
      const truncated = files.length > maxFiles;
      const displayFiles = truncated ? files.slice(0, maxFiles) : files;

      let output = `Found ${files.length} file(s) matching "${pattern}":\n\n`;
      output += displayFiles.join('\n');

      if (truncated) {
        output += `\n\n... and ${files.length - maxFiles} more files (showing first ${maxFiles})`;
      }

      return this.success(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Glob search failed: ${message}`);
    }
  }
}
