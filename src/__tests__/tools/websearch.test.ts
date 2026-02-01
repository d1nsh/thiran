import { describe, it, expect, beforeEach } from '@jest/globals';
import { WebSearchTool } from '../../tools/websearch.js';
import type { ExecutionContext } from '../../types.js';

describe('WebSearchTool', () => {
  let tool: WebSearchTool;
  let context: ExecutionContext;

  beforeEach(() => {
    tool = new WebSearchTool();
    context = {
      workingDirectory: process.cwd(),
      permissions: null as any,
      config: {} as any,
    };
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('web_search');
    });

    it('should have a description', () => {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    });

    it('should have required query parameter', () => {
      expect(tool.parameters.required).toContain('query');
    });

    it('should have optional max_results parameter', () => {
      expect(tool.parameters.properties.max_results).toBeDefined();
    });
  });

  describe('query validation', () => {
    it('should reject empty queries', async () => {
      const result = await tool.execute({ query: '' }, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only queries', async () => {
      const result = await tool.execute({ query: '   ' }, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('max_results handling', () => {
    it('should limit results to MAX_RESULTS', () => {
      // The tool should cap results at 10 (MAX_RESULTS constant)
      expect(tool.parameters.properties.max_results.description).toContain('max: 10');
    });
  });
});
