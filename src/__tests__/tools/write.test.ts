import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WriteFileTool } from '../../tools/write.js';
import { readFileSync, unlinkSync, mkdirSync, rmdirSync, existsSync } from 'fs';
import { join } from 'path';

describe('WriteFileTool', () => {
  const testDir = join(process.cwd(), '__test_temp__');
  const testFile = join(testDir, 'write-test.txt');
  let writeTool: WriteFileTool;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    writeTool = new WriteFileTool();
  });

  afterEach(() => {
    try {
      unlinkSync(testFile);
    } catch {}
    try {
      rmdirSync(testDir);
    } catch {}
  });

  it('should write content to a file', async () => {
    const content = 'Test content\nLine 2';

    const result = await writeTool.execute(
      { file_path: testFile, content },
      { workingDirectory: testDir, permissions: null as any, config: {} as any }
    );

    expect(result.success).toBe(true);
    expect(existsSync(testFile)).toBe(true);

    const fileContent = readFileSync(testFile, 'utf-8');
    expect(fileContent).toBe(content);
  });

  it('should have correct tool definition', () => {
    expect(writeTool.name).toBe('write_file');
    expect(writeTool.description).toBeDefined();
    expect(writeTool.parameters).toBeDefined();
    expect(writeTool.parameters.required).toContain('file_path');
    expect(writeTool.parameters.required).toContain('content');
  });
});
