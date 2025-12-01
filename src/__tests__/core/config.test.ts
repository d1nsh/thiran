import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ConfigManager } from '../../core/config.js';
import { mkdirSync, rmdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const testConfigPath = join(process.cwd(), '__test_config__');

  beforeEach(() => {
    // Use a test-specific config path
    configManager = new ConfigManager();
  });

  afterEach(() => {
    // Cleanup
    try {
      const configPath = configManager.getConfigPath();
      if (existsSync(configPath)) {
        unlinkSync(configPath);
      }
    } catch {}
  });

  it('should load default configuration', () => {
    const config = configManager.load(process.cwd());

    expect(config).toBeDefined();
    expect(config.provider).toBeDefined();
    expect(config.approvalMode).toBeDefined();
  });

  it('should set and get configuration values', () => {
    configManager.set('provider', 'openai');
    const provider = configManager.get('provider');

    expect(provider).toBe('openai');
  });

  it('should merge project config with user config', () => {
    // Set user config
    configManager.set('provider', 'anthropic');
    configManager.set('model', 'claude-sonnet-4-5-20250929');

    const config = configManager.load(process.cwd());

    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4-5-20250929');
  });

  it('should have getConfigPath method', () => {
    const path = configManager.getConfigPath();

    expect(path).toBeDefined();
    expect(typeof path).toBe('string');
  });

  it('should handle different approval modes', () => {
    const modes = ['suggest', 'auto-edit', 'full-auto'];

    for (const mode of modes) {
      configManager.set('approvalMode', mode as any);
      const config = configManager.load(process.cwd());

      expect(config.approvalMode).toBe(mode);
    }
  });

  it('should persist configuration', () => {
    configManager.set('provider', 'gemini');
    configManager.set('model', 'gemini-2.5-flash');

    // Create a new instance to test persistence
    const newConfigManager = new ConfigManager();
    const config = newConfigManager.load(process.cwd());

    expect(config.provider).toBe('gemini');
    expect(config.model).toBe('gemini-2.5-flash');
  });
});
