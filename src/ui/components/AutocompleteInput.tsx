import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

// Slash commands with descriptions for autocomplete
const SLASH_COMMANDS = [
  { command: '/help', description: 'Show available commands' },
  { command: '/models', description: 'Select a model' },
  { command: '/providers', description: 'Select a provider' },
  { command: '/search', description: 'Search for Ollama models' },
  { command: '/clear', description: 'Clear conversation history' },
  { command: '/exit', description: 'Exit Thiran' },
  { command: '/quit', description: 'Exit Thiran' },
];

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = '',
}) => {
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  // Sync cursor position when value changes externally (e.g., cleared after submit)
  useEffect(() => {
    if (value.length < cursorPosition) {
      setCursorPosition(value.length);
    }
  }, [value, cursorPosition]);

  // Get matching suggestions
  const getSuggestions = useCallback(() => {
    if (!value.startsWith('/')) return [];

    const query = value.toLowerCase();
    return SLASH_COMMANDS.filter(cmd =>
      cmd.command.toLowerCase().startsWith(query)
    );
  }, [value]);

  const suggestions = getSuggestions();
  const showSuggestions = value.startsWith('/') && suggestions.length > 0 && value !== suggestions[0]?.command;

  useInput((input, key) => {
    // Handle Tab first - it should never trigger submit or add characters
    if (key.tab) {
      if (showSuggestions) {
        // Autocomplete with selected suggestion
        const suggestion = suggestions[selectedSuggestion];
        if (suggestion) {
          onChange(suggestion.command);
          setCursorPosition(suggestion.command.length);
          setSelectedSuggestion(0);
        }
      }
      // Always return on Tab to prevent any other processing
      return;
    }

    if (key.return) {
      // If suggestions are showing, submit the selected suggestion
      if (showSuggestions && suggestions[selectedSuggestion]) {
        const selectedCommand = suggestions[selectedSuggestion].command;
        onSubmit(selectedCommand);
      } else {
        // Otherwise submit the current value
        onSubmit(value);
      }
      setCursorPosition(0);
      setSelectedSuggestion(0);
      return;
    }

    if (key.upArrow && showSuggestions) {
      // Navigate suggestions up
      setSelectedSuggestion(prev =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
      return;
    }

    if (key.downArrow && showSuggestions) {
      // Navigate suggestions down
      setSelectedSuggestion(prev =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (key.backspace || key.delete) {
      // Delete character
      if (cursorPosition > 0) {
        const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(prev => prev - 1);
        setSelectedSuggestion(0);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPosition(prev => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition(prev => Math.min(value.length, prev + 1));
      return;
    }

    if (key.ctrl && input === 'a') {
      // Move to beginning
      setCursorPosition(0);
      return;
    }

    if (key.ctrl && input === 'e') {
      // Move to end
      setCursorPosition(value.length);
      return;
    }

    if (key.ctrl && input === 'u') {
      // Clear line
      onChange('');
      setCursorPosition(0);
      setSelectedSuggestion(0);
      return;
    }

    if (key.ctrl && input === 'w') {
      // Delete word
      const beforeCursor = value.slice(0, cursorPosition);
      const afterCursor = value.slice(cursorPosition);
      const lastSpace = beforeCursor.lastIndexOf(' ');
      const newBefore = lastSpace === -1 ? '' : beforeCursor.slice(0, lastSpace + 1);
      onChange(newBefore + afterCursor);
      setCursorPosition(newBefore.length);
      setSelectedSuggestion(0);
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
      onChange(newValue);
      setCursorPosition(prev => prev + input.length);
      setSelectedSuggestion(0);
    }
  });

  // Render input with cursor
  const renderInput = () => {
    if (!value && placeholder) {
      return <Text color="gray" dimColor>{placeholder}</Text>;
    }

    const before = value.slice(0, cursorPosition);
    const cursor = value[cursorPosition] || ' ';
    const after = value.slice(cursorPosition + 1);

    return (
      <>
        <Text>{before}</Text>
        <Text backgroundColor="white" color="black">{cursor}</Text>
        <Text>{after}</Text>
      </>
    );
  };

  return (
    <Box flexDirection="column">
      {/* Suggestions dropdown */}
      {showSuggestions && (
        <Box flexDirection="column" marginBottom={1}>
          {suggestions.slice(0, 5).map((suggestion, index) => (
            <Box key={suggestion.command}>
              <Text
                color={index === selectedSuggestion ? 'cyan' : 'gray'}
                bold={index === selectedSuggestion}
              >
                {index === selectedSuggestion ? '❯ ' : '  '}
                {suggestion.command}
              </Text>
              <Text color="gray" dimColor>
                {' '}- {suggestion.description}
              </Text>
            </Box>
          ))}
          <Text color="gray" dimColor>
            Tab to complete, ↑↓ to navigate
          </Text>
        </Box>
      )}

      {/* Input line */}
      <Box>
        <Text color="green" bold>{'> '}</Text>
        {renderInput()}
      </Box>
    </Box>
  );
};
