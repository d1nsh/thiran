import { BaseTool } from './base.js';
import type { ToolParameters, ToolResult, ExecutionContext } from '../types.js';

const MAX_CONTENT_SIZE = 100 * 1024; // 100KB max content
const DEFAULT_TIMEOUT = 30000; // 30 seconds

export class WebFetchTool extends BaseTool {
  name = 'web_fetch';
  description = `Fetch content from a URL and return the text content. Useful for reading web pages, API responses, documentation, etc. HTML is converted to readable text. Large responses are truncated to ${MAX_CONTENT_SIZE / 1024}KB.`;

  parameters: ToolParameters = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch (must be http:// or https://)',
      },
      timeout: {
        type: 'number',
        description: `Timeout in milliseconds (default: ${DEFAULT_TIMEOUT}, max: 60000)`,
      },
      raw: {
        type: 'boolean',
        description: 'If true, return raw content without HTML-to-text conversion (default: false)',
      },
    },
    required: ['url'],
  };

  async execute(
    params: Record<string, unknown>,
    _context: ExecutionContext
  ): Promise<ToolResult> {
    const url = params.url as string;
    const timeout = Math.min((params.timeout as number) || DEFAULT_TIMEOUT, 60000);
    const raw = (params.raw as boolean) || false;

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return this.error('URL must use http:// or https:// protocol');
      }
    } catch {
      return this.error(`Invalid URL: ${url}`);
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Thiran/1.0 (AI Coding Assistant)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content type
      const contentType = response.headers.get('content-type') || '';

      // Read response with size limit
      const reader = response.body?.getReader();
      if (!reader) {
        return this.error('Failed to read response body');
      }

      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      let truncated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (totalSize + value.length > MAX_CONTENT_SIZE) {
          // Take only what we can fit
          const remaining = MAX_CONTENT_SIZE - totalSize;
          if (remaining > 0) {
            chunks.push(value.slice(0, remaining));
          }
          truncated = true;
          reader.cancel();
          break;
        }

        chunks.push(value);
        totalSize += value.length;
      }

      // Combine chunks into text
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const rawContent = decoder.decode(Buffer.concat(chunks.map(c => Buffer.from(c))));

      // Convert HTML to text if needed
      let content: string;
      const isHtml = contentType.includes('text/html') || rawContent.trim().startsWith('<!') || rawContent.trim().startsWith('<html');

      if (!raw && isHtml) {
        content = this.htmlToText(rawContent);
      } else {
        content = rawContent;
      }

      // Build output
      let output = `URL: ${url}\n`;
      output += `Content-Type: ${contentType}\n`;
      output += `Size: ${totalSize} bytes${truncated ? ' (truncated)' : ''}\n`;
      output += '---\n';
      output += content;

      if (truncated) {
        output += '\n\n[Content truncated at 100KB]';
      }

      return this.success(output);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return this.error(`Request timed out after ${timeout}ms`);
        }
        return this.error(`Fetch failed: ${err.message}`);
      }
      return this.error(`Fetch failed: ${String(err)}`);
    }
  }

  /**
   * Simple HTML to text conversion
   * Removes scripts, styles, and tags while preserving structure
   */
  private htmlToText(html: string): string {
    let text = html;

    // Remove scripts and styles
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

    // Convert common elements to text equivalents
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<\/tr>/gi, '\n');
    text = text.replace(/<td[^>]*>/gi, '\t');
    text = text.replace(/<th[^>]*>/gi, '\t');

    // Extract href from links
    text = text.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, '$2 [$1]');

    // Remove remaining tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = this.decodeHtmlEntities(text);

    // Clean up whitespace
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n[ \t]+/g, '\n');
    text = text.replace(/[ \t]+\n/g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }

  /**
   * Decode common HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&mdash;': '\u2014',
      '&ndash;': '\u2013',
      '&hellip;': '\u2026',
      '&copy;': '\u00A9',
      '&reg;': '\u00AE',
      '&trade;': '\u2122',
      '&bull;': '\u2022',
      '&lsquo;': '\u2018',
      '&rsquo;': '\u2019',
      '&ldquo;': '\u201C',
      '&rdquo;': '\u201D',
    };

    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, 'gi'), char);
    }

    // Decode numeric entities
    result = result.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    return result;
  }
}
