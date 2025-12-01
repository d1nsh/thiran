import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GlobTool } from '../../tools/glob.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';

describe('GlobTool', () => {
  const testDir = join(process.cwd(), '__test_temp__');
  let globTool: GlobTool;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'src'), { recursive: true });

    // Create test files
    writeFileSync(join(testDir, 'file1.ts'), 'content');
    writeFileSync(join(testDir, 'file2.js'), 'content');
    writeFileSync(join(testDir, 'src', 'index.ts'), 'content');

    globTool = new GlobTool();
  });

  afterEach(() => {
    try {
      unlinkSync(join(testDir, 'file1.ts'));
      unlinkSync(join(testDir, 'file2.js'));
      unlinkSync(join(testDir, 'src', 'index.ts'));
      rmdirSync(join(testDir, 'src'));
      rmdirSync(testDir);
    } catch {}
  });

  it('should find files matching pattern', async () => {
    const result = await globTool.execute(
      { pattern: '*.ts' },
      { workingDirectory: testDir, permissions: null as any, config: {} as any }
    );

    expect(result.output).toContain('file1.ts');
    expect(result.output).not.toContain('file2.js');
  });

  it('should have correct tool definition', () => {
    expect(globTool.name).toBe('glob');
    expect(globTool.description).toBeDefined();
  });
});
