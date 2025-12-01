import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { BaseTool } from './base.js';
import type { ToolParameters, ToolResult, ExecutionContext } from '../types.js';

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

export class GrepTool extends BaseTool {
  name = 'grep';
  description = `Search for a pattern in files.
Supports regular expressions. Returns matching lines with file paths and line numbers.
Use the glob parameter to filter which files to search.`;

  parameters: ToolParameters = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regex pattern to search for in file contents',
      },
      glob_pattern: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "**/*.ts"). Defaults to all files.',
      },
      path: {
        type: 'string',
        description: 'Directory to search in. Defaults to current working directory.',
      },
      case_insensitive: {
        type: 'boolean',
        description: 'If true, search is case-insensitive. Default is false.',
      },
      context_lines: {
        type: 'number',
        description: 'Number of context lines to show before and after matches. Default is 0.',
      },
    },
    required: ['pattern'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const pattern = params.pattern as string;
    const globPattern = (params.glob_pattern as string) || '**/*';
    const searchPath = params.path as string | undefined;
    const caseInsensitive = (params.case_insensitive as boolean) || false;
    const contextLines = (params.context_lines as number) || 0;

    try {
      const baseDir = searchPath
        ? path.isAbsolute(searchPath)
          ? searchPath
          : path.resolve(context.workingDirectory, searchPath)
        : context.workingDirectory;

      // Create regex
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, caseInsensitive ? 'gi' : 'g');
      } catch {
        return this.error(`Invalid regex pattern: ${pattern}`);
      }

      // Find files
      const files = await glob(globPattern, {
        cwd: baseDir,
        nodir: true,
        dot: false,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/*.min.js'],
      });

      const matches: GrepMatch[] = [];
      const maxMatches = 200;
      const maxFilesToSearch = 500;

      // Search files
      const filesToSearch = files.slice(0, maxFilesToSearch);

      for (const file of filesToSearch) {
        if (matches.length >= maxMatches) break;

        const filePath = path.join(baseDir, file);

        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= maxMatches) break;

            if (regex.test(lines[i])) {
              // Reset regex state
              regex.lastIndex = 0;

              if (contextLines > 0) {
                // Include context
                const startLine = Math.max(0, i - contextLines);
                const endLine = Math.min(lines.length, i + contextLines + 1);
                const contextContent = lines
                  .slice(startLine, endLine)
                  .map((line, idx) => {
                    const lineNum = startLine + idx + 1;
                    const marker = lineNum === i + 1 ? '>' : ' ';
                    return `${marker}${lineNum}: ${line}`;
                  })
                  .join('\n');

                matches.push({
                  file,
                  line: i + 1,
                  content: contextContent,
                });
              } else {
                matches.push({
                  file,
                  line: i + 1,
                  content: lines[i],
                });
              }
            }
          }
        } catch {
          // Skip files that can't be read (binary, permissions, etc.)
        }
      }

      if (matches.length === 0) {
        return this.success(`No matches found for pattern: ${pattern}`);
      }

      // Format output
      let output = `Found ${matches.length} match(es) for "${pattern}":\n\n`;

      for (const match of matches) {
        if (contextLines > 0) {
          output += `${match.file}:${match.line}\n${match.content}\n\n`;
        } else {
          output += `${match.file}:${match.line}: ${match.content}\n`;
        }
      }

      if (matches.length >= maxMatches) {
        output += `\n... (showing first ${maxMatches} matches)`;
      }

      if (files.length > maxFilesToSearch) {
        output += `\n(searched first ${maxFilesToSearch} of ${files.length} files)`;
      }

      return this.success(output);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Grep search failed: ${message}`);
    }
  }
}
