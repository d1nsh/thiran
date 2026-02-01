import { describe, it, expect, beforeEach } from '@jest/globals';
import { WebFetchTool } from '../../tools/webfetch.js';
import type { ExecutionContext } from '../../types.js';

describe('WebFetchTool', () => {
  let tool: WebFetchTool;
  let context: ExecutionContext;

  beforeEach(() => {
    tool = new WebFetchTool();
    context = {
      workingDirectory: process.cwd(),
      permissions: null as any,
      config: {} as any,
    };
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('web_fetch');
    });

    it('should have a description', () => {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    });

    it('should have required url parameter', () => {
      expect(tool.parameters.required).toContain('url');
    });

    it('should have optional timeout and raw parameters', () => {
      expect(tool.parameters.properties.timeout).toBeDefined();
      expect(tool.parameters.properties.raw).toBeDefined();
    });
  });

  describe('URL validation', () => {
    it('should reject invalid URLs', async () => {
      const result = await tool.execute({ url: 'not-a-url' }, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should reject non-http protocols', async () => {
      const result = await tool.execute({ url: 'ftp://example.com' }, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('http:// or https://');
    });

    it('should reject file:// protocol', async () => {
      const result = await tool.execute({ url: 'file:///etc/passwd' }, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('http:// or https://');
    });
  });

  describe('HTML to text conversion', () => {
    it('should have html conversion capability noted in description', () => {
      expect(tool.description).toContain('HTML');
    });
  });
});
