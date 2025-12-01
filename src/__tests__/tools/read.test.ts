import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ReadFileTool } from '../../tools/read.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';

describe('ReadFileTool', () => {
  const testDir = join(process.cwd(), '__test_temp__');
  const testFile = join(testDir, 'test.txt');
  let readTool: ReadFileTool;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    readTool = new ReadFileTool();
  });

  afterEach(() => {
    try {
      unlinkSync(testFile);
    } catch {}
    try {
      rmdirSync(testDir);
    } catch {}
  });

  it('should read a file successfully', async () => {
    const content = 'Hello, World!\nLine 2\nLine 3';
    writeFileSync(testFile, content);

    const result = await readTool.execute(
      { file_path: testFile },
      { workingDirectory: testDir, permissions: null as any, config: {} as any }
    );

    expect(result.output).toContain('Hello, World!');
    expect(result.output).toContain('Line 2');
    expect(result.output).toContain('Line 3');
  });

  it('should handle line offset and limit', async () => {
    const content = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    writeFileSync(testFile, content);

    const result = await readTool.execute(
      { file_path: testFile, offset: 10, limit: 5 },
      { workingDirectory: testDir, permissions: null as any, config: {} as any }
    );

    expect(result.output).toContain('Line 10');
    expect(result.output).toContain('Line 14');
    expect(result.success).toBe(true);
  });

  it('should return error for non-existent file', async () => {
    const result = await readTool.execute(
      { file_path: join(testDir, 'nonexistent.txt') },
      { workingDirectory: testDir, permissions: null as any, config: {} as any }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should have correct tool definition', () => {
    expect(readTool.name).toBe('read_file');
    expect(readTool.description).toBeDefined();
    expect(readTool.parameters).toBeDefined();
    expect(readTool.parameters.required).toContain('file_path');
  });
});
