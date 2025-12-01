import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EditFileTool } from '../../tools/edit.js';
import { writeFileSync, readFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';

describe('EditFileTool', () => {
  const testDir = join(process.cwd(), '__test_temp__');
  const testFile = join(testDir, 'edit-test.txt');
  let editTool: EditFileTool;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    editTool = new EditFileTool();
  });

  afterEach(() => {
    try {
      unlinkSync(testFile);
    } catch {}
    try {
      rmdirSync(testDir);
    } catch {}
  });

  it('should replace text in a file', async () => {
    const originalContent = 'Hello World\nThis is a test';
    writeFileSync(testFile, originalContent);

    const result = await editTool.execute(
      {
        file_path: testFile,
        old_string: 'World',
        new_string: 'Universe',
      },
      { workingDirectory: testDir, permissions: null as any, config: {} as any }
    );

    expect(result.success).toBe(true);

    const newContent = readFileSync(testFile, 'utf-8');
    expect(newContent).toContain('Hello Universe');
  });

  it('should have correct tool definition', () => {
    expect(editTool.name).toBe('edit_file');
    expect(editTool.description).toBeDefined();
    expect(editTool.parameters).toBeDefined();
  });
});
