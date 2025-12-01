import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GrepTool } from '../../tools/grep.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';

describe('GrepTool', () => {
  const testDir = join(process.cwd(), '__test_temp__');
  const testFile1 = join(testDir, 'file1.ts');
  let grepTool: GrepTool;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });

    writeFileSync(testFile1, `function hello() {
  console.log("Hello World");
  return "world";
}`);

    grepTool = new GrepTool();
  });

  afterEach(() => {
    try {
      unlinkSync(testFile1);
      rmdirSync(testDir);
    } catch {}
  });

  it('should search for pattern in files', async () => {
    const result = await grepTool.execute(
      { pattern: 'hello', output_mode: 'content' },
      { workingDirectory: testDir, permissions: null as any, config: {} as any }
    );

    expect(result.output).toContain('hello');
  });

  it('should have correct tool definition', () => {
    expect(grepTool.name).toBe('grep');
    expect(grepTool.description).toBeDefined();
  });
});
