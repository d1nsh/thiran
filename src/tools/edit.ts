import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseTool } from './base.js';
import type { ToolParameters, ToolResult, ExecutionContext } from '../types.js';

export class EditFileTool extends BaseTool {
  name = 'edit_file';
  description = `Edit a file by replacing a specific string with new content.
You MUST read the file first before editing to ensure you have the exact content to match.
The old_string must be unique in the file - if it appears multiple times, the edit will fail.
Use replace_all: true to replace all occurrences.`;

  parameters: ToolParameters = {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute or relative path to the file to edit',
      },
      old_string: {
        type: 'string',
        description: 'The exact string to find and replace. Must match exactly including whitespace.',
      },
      new_string: {
        type: 'string',
        description: 'The string to replace old_string with',
      },
      replace_all: {
        type: 'boolean',
        description: 'If true, replace all occurrences. Default is false (replace first unique occurrence).',
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const filePath = params.file_path as string;
    const oldString = params.old_string as string;
    const newString = params.new_string as string;
    const replaceAll = (params.replace_all as boolean) || false;

    try {
      // Resolve path relative to working directory
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(context.workingDirectory, filePath);

      // Note: Permission is checked by the Agent before tool execution

      // Read current file content
      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        return this.error(`File not found: ${absolutePath}`);
      }

      // Count occurrences
      const occurrences = this.countOccurrences(content, oldString);

      if (occurrences === 0) {
        // Try fuzzy matching to provide helpful feedback
        const fuzzyMatch = this.findFuzzyMatch(content, oldString);
        if (fuzzyMatch) {
          return this.error(
            `String not found in file. Did you mean:\n${fuzzyMatch}\n\nMake sure to read the file first and copy the exact content.`
          );
        }
        return this.error(
          'String not found in file. Make sure to read the file first and use the exact content including whitespace.'
        );
      }

      if (occurrences > 1 && !replaceAll) {
        return this.error(
          `Found ${occurrences} occurrences of the string. Use replace_all: true to replace all, or provide more context to make the match unique.`
        );
      }

      // Perform replacement
      let newContent: string;
      let replacements: number;

      if (replaceAll) {
        newContent = content.split(oldString).join(newString);
        replacements = occurrences;
      } else {
        newContent = content.replace(oldString, newString);
        replacements = 1;
      }

      // Write updated content
      await fs.writeFile(absolutePath, newContent, 'utf-8');

      // Generate diff summary
      const oldLines = oldString.split('\n').length;
      const newLines = newString.split('\n').length;
      const lineDiff = newLines - oldLines;
      const lineDiffStr =
        lineDiff === 0 ? '' : lineDiff > 0 ? ` (+${lineDiff} lines)` : ` (${lineDiff} lines)`;

      return this.success(
        `Edited ${absolutePath}: ${replacements} replacement(s)${lineDiffStr}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to edit file: ${message}`);
    }
  }

  private countOccurrences(str: string, substr: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = str.indexOf(substr, pos)) !== -1) {
      count++;
      pos += substr.length;
    }
    return count;
  }

  private findFuzzyMatch(content: string, searchStr: string): string | null {
    // Simple fuzzy matching: try to find a similar string
    const searchLines = searchStr.trim().split('\n');
    const contentLines = content.split('\n');

    // Look for lines that match the first line of the search string
    const firstLine = searchLines[0].trim();
    if (firstLine.length < 10) return null;

    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i].includes(firstLine)) {
        // Found a potential match, extract context
        const start = Math.max(0, i);
        const end = Math.min(contentLines.length, i + searchLines.length + 2);
        return contentLines.slice(start, end).join('\n');
      }
    }

    return null;
  }
}
