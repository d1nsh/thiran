import React from 'react';
import { Box, Text } from 'ink';
import type { ToolCall as ToolCallType } from '../../types.js';
import { Spinner } from './Spinner.js';

interface ToolCallProps {
  toolCall: ToolCallType;
  status: 'running' | 'completed' | 'error';
  result?: string;
}

export const ToolCallDisplay: React.FC<ToolCallProps> = ({
  toolCall,
  status,
  result,
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Spinner />;
      case 'completed':
        return <Text color="green">✓</Text>;
      case 'error':
        return <Text color="red">✗</Text>;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'yellow';
      case 'completed':
        return 'green';
      case 'error':
        return 'red';
    }
  };

  // Format arguments for display
  const formatArgs = (args: Record<string, unknown>): string => {
    const entries = Object.entries(args);
    if (entries.length === 0) return '';

    return entries
      .map(([key, value]) => {
        let displayValue: string;
        if (typeof value === 'string') {
          // Truncate long strings
          displayValue = value.length > 50 ? value.slice(0, 50) + '...' : value;
          // Replace newlines
          displayValue = displayValue.replace(/\n/g, '↵');
        } else {
          displayValue = JSON.stringify(value);
        }
        return `${key}=${displayValue}`;
      })
      .join(', ');
  };

  return (
    <Box flexDirection="column" marginY={0}>
      <Box>
        {getStatusIcon()}
        <Text> </Text>
        <Text color={getStatusColor()} bold>
          {toolCall.name}
        </Text>
        <Text color="gray">({formatArgs(toolCall.arguments)})</Text>
      </Box>

      {result && status === 'completed' && (
        <Box marginLeft={2} marginTop={0}>
          <Text color="gray" dimColor>
            {result.length > 200 ? result.slice(0, 200) + '...' : result}
          </Text>
        </Box>
      )}

      {result && status === 'error' && (
        <Box marginLeft={2} marginTop={0}>
          <Text color="red">{result}</Text>
        </Box>
      )}
    </Box>
  );
};
