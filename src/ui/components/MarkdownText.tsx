import React, { useMemo, memo } from 'react';
import { Box, Text } from 'ink';
import { highlight } from 'cli-highlight';

interface MarkdownTextProps {
  children: string;
}

interface TextSegment {
  type: 'text' | 'code' | 'inline-code';
  content: string;
  language?: string;
}

// Parse markdown-like text into segments
function parseText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];

  // Regex to match code blocks: ```language\ncode\n```
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      segments.push(...parseInlineCode(textBefore));
    }

    // Add code block
    segments.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push(...parseInlineCode(text.slice(lastIndex)));
  }

  return segments;
}

// Parse inline code: `code`
function parseInlineCode(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const inlineCodeRegex = /`([^`]+)`/g;

  let lastIndex = 0;
  let match;

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    segments.push({
      type: 'inline-code',
      content: match[1],
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

// Highlight code with cli-highlight
function highlightCode(code: string, language: string): string {
  try {
    return highlight(code, {
      language: language === 'plaintext' ? undefined : language,
      ignoreIllegals: true,
    });
  } catch {
    // Fallback if highlighting fails
    return code;
  }
}

// Memoized to prevent re-renders when children haven't changed
export const MarkdownText: React.FC<MarkdownTextProps> = memo(({ children }) => {
  const segments = useMemo(() => parseText(children || ''), [children]);

  return (
    <Box flexDirection="column">
      {segments.map((segment, index) => {
        if (segment.type === 'code') {
          const highlighted = highlightCode(segment.content, segment.language || 'plaintext');
          return (
            <Box key={index} flexDirection="column" marginY={1}>
              <Box>
                <Text color="gray" dimColor>
                  {'─'.repeat(3)} {segment.language || 'code'} {'─'.repeat(20)}
                </Text>
              </Box>
              <Box paddingLeft={1}>
                <Text>{highlighted}</Text>
              </Box>
              <Box>
                <Text color="gray" dimColor>
                  {'─'.repeat(30)}
                </Text>
              </Box>
            </Box>
          );
        }

        if (segment.type === 'inline-code') {
          return (
            <Text key={index} backgroundColor="gray" color="white">
              {` ${segment.content} `}
            </Text>
          );
        }

        // Regular text
        return <Text key={index}>{segment.content}</Text>;
      })}
    </Box>
  );
});
