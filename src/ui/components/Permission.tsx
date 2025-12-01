import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { PermissionAction } from '../../types.js';

interface PermissionPromptProps {
  action: PermissionAction;
  onDecision: (allow: boolean, remember: boolean) => void;
}

export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
  action,
  onDecision,
}) => {
  const [selectedOption, setSelectedOption] = useState(0);

  const options = [
    { label: 'Allow once', allow: true, remember: false },
    { label: 'Allow always', allow: true, remember: true },
    { label: 'Deny', allow: false, remember: false },
  ];

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedOption(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedOption(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return || input === ' ') {
      const option = options[selectedOption];
      onDecision(option.allow, option.remember);
    } else if (input === 'y' || input === 'Y') {
      onDecision(true, false);
    } else if (input === 'n' || input === 'N') {
      onDecision(false, false);
    } else if (input === 'a' || input === 'A') {
      onDecision(true, true);
    }
  });

  const getActionDescription = () => {
    // Use toolName and toolArgs if available for more detailed info
    if (action.toolName && action.toolArgs) {
      switch (action.toolName) {
        case 'write_file':
          return `Create/Write file: ${action.toolArgs.path}`;
        case 'edit_file':
          return `Edit file: ${action.toolArgs.path}`;
        case 'bash':
          return `Execute: ${action.toolArgs.command}`;
        case 'read_file':
          return `Read file: ${action.toolArgs.path}`;
        default:
          return `${action.toolName}: ${JSON.stringify(action.toolArgs).slice(0, 100)}`;
      }
    }

    // Fallback to original logic
    switch (action.type) {
      case 'read':
      case 'file_read':
        return `Read file: ${action.path}`;
      case 'write':
      case 'file_write':
        return `Write file: ${action.path}`;
      case 'file_edit':
        return `Edit file: ${action.path}`;
      case 'execute':
      case 'bash_execute':
        return `Execute command: ${action.command}`;
      case 'web_fetch':
        return `Fetch URL: ${action.url}`;
      default:
        return 'Unknown action';
    }
  };

  const getActionColor = () => {
    // Color based on tool name or action type
    const toolName = action.toolName || '';
    if (toolName === 'bash' || action.type === 'execute' || action.type === 'bash_execute') {
      return 'red';
    }
    if (toolName === 'write_file' || toolName === 'edit_file' ||
        action.type === 'write' || action.type === 'file_write' || action.type === 'file_edit') {
      return 'yellow';
    }
    if (toolName === 'read_file' || action.type === 'read' || action.type === 'file_read') {
      return 'blue';
    }
    if (action.type === 'web_fetch') {
      return 'magenta';
    }
    return 'white';
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginY={1}
    >
      <Text color="yellow" bold>
        Permission Required
      </Text>

      <Box marginY={1}>
        <Text color={getActionColor()}>{getActionDescription()}</Text>
      </Box>

      <Box flexDirection="column">
        {options.map((option, index) => (
          <Box key={option.label}>
            <Text color={selectedOption === index ? 'cyan' : 'white'}>
              {selectedOption === index ? '❯ ' : '  '}
              {option.label}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          [y] Allow once  [a] Allow always  [n] Deny  [↑↓] Navigate  [Enter] Select
        </Text>
      </Box>
    </Box>
  );
};
