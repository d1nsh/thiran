import { BaseTool } from './base.js';
import type { ToolParameters, ToolResult, ExecutionContext } from '../types.js';

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RESULTS = 10;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class WebSearchTool extends BaseTool {
  name = 'web_search';
  description = `Search the web for information. Returns a list of search results with titles, URLs, and snippets. Useful for finding current information, documentation, tutorials, and more. Uses DuckDuckGo search.`;

  parameters: ToolParameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      max_results: {
        type: 'number',
        description: `Maximum number of results to return (default: 5, max: ${MAX_RESULTS})`,
      },
    },
    required: ['query'],
  };

  async execute(
    params: Record<string, unknown>,
    _context: ExecutionContext
  ): Promise<ToolResult> {
    const query = params.query as string;
    const maxResults = Math.min((params.max_results as number) || 5, MAX_RESULTS);

    if (!query.trim()) {
      return this.error('Search query cannot be empty');
    }

    try {
      const results = await this.searchDuckDuckGo(query, maxResults);

      if (results.length === 0) {
        return this.success(`No results found for: "${query}"`);
      }

      // Format results
      let output = `Search results for: "${query}"\n`;
      output += `Found ${results.length} result(s)\n`;
      output += '---\n\n';

      results.forEach((result, index) => {
        output += `${index + 1}. ${result.title}\n`;
        output += `   URL: ${result.url}\n`;
        output += `   ${result.snippet}\n\n`;
      });

      return this.success(output.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Search failed: ${message}`);
    }
  }

  /**
   * Search using DuckDuckGo HTML page
   * Parses the HTML results page to extract search results
   */
  private async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      // Use DuckDuckGo HTML search
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Thiran/1.0; AI Coding Assistant)',
          'Accept': 'text/html',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseDuckDuckGoResults(html, maxResults);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Search request timed out');
      }
      throw err;
    }
  }

  /**
   * Parse DuckDuckGo HTML results page
   */
  private parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    // DuckDuckGo HTML results are in <div class="result"> elements
    // Each result has:
    // - <a class="result__a"> with the title and href
    // - <a class="result__snippet"> with the description

    // Match result blocks
    const resultRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    const titleRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i;
    const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i;

    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
      const block = match[1];

      const titleMatch = titleRegex.exec(block);
      const snippetMatch = snippetRegex.exec(block);

      if (titleMatch) {
        let url = titleMatch[1];
        const title = this.stripTags(titleMatch[2]).trim();
        const snippet = snippetMatch ? this.stripTags(snippetMatch[1]).trim() : '';

        // DuckDuckGo wraps URLs in a redirect, extract actual URL
        if (url.includes('uddg=')) {
          const uddgMatch = url.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
          }
        }

        // Skip ads and non-results
        if (title && url && url.startsWith('http')) {
          results.push({ title, url, snippet });
        }
      }
    }

    // Fallback: try alternative parsing if no results found
    if (results.length === 0) {
      return this.parseDuckDuckGoResultsAlt(html, maxResults);
    }

    return results;
  }

  /**
   * Alternative parsing for DuckDuckGo results
   */
  private parseDuckDuckGoResultsAlt(html: string, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    // Try to find links with result__url class
    const linkRegex = /<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]*)"[^>]*>/gi;
    const urls: string[] = [];

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let url = match[1];
      if (url.includes('uddg=')) {
        const uddgMatch = url.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }
      }
      if (url.startsWith('http')) {
        urls.push(url);
      }
    }

    // For each URL, try to find associated title
    for (const url of urls.slice(0, maxResults)) {
      // Extract domain as fallback title
      try {
        const domain = new URL(url).hostname;
        results.push({
          title: domain,
          url,
          snippet: '',
        });
      } catch {
        // Skip invalid URLs
      }
    }

    return results;
  }

  /**
   * Remove HTML tags from text
   */
  private stripTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
