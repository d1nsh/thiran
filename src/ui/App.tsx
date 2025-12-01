import React, { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { Spinner, ToolCallDisplay, PermissionPrompt, MarkdownText, Banner, AutocompleteInput } from './components/index.js';
import type { ToolCall, PermissionAction, ThiranConfig } from '../types.js';
import type { Agent, AgentCallbacks } from '../core/agent.js';
import { listProviders, getProviderModels, OllamaProvider } from '../providers/index.js';

interface AppProps {
  agentRef: { current: Agent };
  initialPrompt?: string;
  config: ThiranConfig;
  onPermissionRequest: (
    action: PermissionAction
  ) => Promise<{ allow: boolean; remember: boolean }>;
  onConfigChange: (newConfig: Partial<ThiranConfig>) => void;
}

interface ToolCallState {
  toolCall: ToolCall;
  status: 'running' | 'completed' | 'error';
  result?: string;
}

interface MessageBlock {
  id: number;
  type: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCallState[];
}

interface SlashCommandResult {
  handled: boolean;
  message?: string;
}

// Memoized message component to prevent unnecessary re-renders
const MessageItem = memo(({ msg }: { msg: MessageBlock }) => (
  <Box flexDirection="column" marginBottom={1}>
    {msg.type === 'user' && (
      <Box>
        <Text color="green" bold>You: </Text>
        <Text>{msg.content}</Text>
      </Box>
    )}

    {msg.type === 'system' && (
      <Box>
        <Text color="yellow">{msg.content}</Text>
      </Box>
    )}

    {msg.type === 'assistant' && (
      <Box flexDirection="column">
        <Box>
          <Text color="blue" bold>Thiran: </Text>
        </Box>
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <Box flexDirection="column" marginLeft={2} marginBottom={1}>
            {msg.toolCalls.map((tc, tcIdx) => (
              <ToolCallDisplay
                key={tcIdx}
                toolCall={tc.toolCall}
                status={tc.status}
                result={tc.result}
              />
            ))}
          </Box>
        )}
        {msg.content && (
          <Box marginLeft={2}>
            <MarkdownText>{msg.content}</MarkdownText>
          </Box>
        )}
      </Box>
    )}
  </Box>
));

export const App: React.FC<AppProps> = ({
  agentRef,
  initialPrompt,
  config,
  onPermissionRequest,
  onConfigChange,
}) => {
  const { exit } = useApp();
  const { write } = useStdout();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MessageBlock[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [currentProvider, setCurrentProvider] = useState(config.provider);
  const [currentModel, setCurrentModel] = useState(config.model || '');
  const [pendingPermission, setPendingPermission] = useState<{
    action: PermissionAction;
    resolve: (decision: { allow: boolean; remember: boolean }) => void;
  } | null>(null);

  // Model selection state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);

  // Provider selection state
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [selectedProviderIndex, setSelectedProviderIndex] = useState(0);

  // Model download state (for Ollama)
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  const [modelToDownload, setModelToDownload] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');

  // Streaming response state (for live display)
  const [streamingText, setStreamingText] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCallState[]>([]);

  // Use refs to track current response state (avoids stale closure issues)
  const currentTextRef = useRef('');
  const currentToolCallsRef = useRef<ToolCallState[]>([]);
  const cancelledRef = useRef(false);

  // Message ID counter for Static component
  const messageIdRef = useRef(0);

  // Helper to add message with auto-incrementing ID
  const addMessage = useCallback((msg: Omit<MessageBlock, 'id'>) => {
    messageIdRef.current += 1;
    setMessages(prev => [...prev, { ...msg, id: messageIdRef.current }]);
  }, []);

  // Handle slash commands
  const handleSlashCommand = useCallback((command: string): SlashCommandResult => {
    const parts = command.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return {
          handled: true,
          message: `Available commands:
  /help              - Show this help message
  /models            - Select a model for current provider
  /providers         - Select a provider
  /search <query>    - Search for Ollama models (e.g., /search coder)
  /clear             - Clear conversation history
  /exit, /quit       - Exit Thiran`,
        };

      case 'models':
        // For Ollama, fetch local models and merge with suggested models
        if (currentProvider === 'ollama') {
          setShowInput(false);
          const ollama = new OllamaProvider();
          ollama.listLocalModels().then(localModels => {
            const suggestedModels = getProviderModels(currentProvider);
            // Combine local and suggested, removing duplicates
            const allModels = [...new Set([...localModels, ...suggestedModels])];
            if (allModels.length === 0) {
              addMessage({ type: 'system', content: 'No models available. Select a model to download it.' });
              setAvailableModels(suggestedModels);
            } else {
              setAvailableModels(allModels);
            }
            const currentIdx = allModels.indexOf(currentModel);
            setSelectedModelIndex(currentIdx >= 0 ? currentIdx : 0);
            setShowModelSelector(true);
          });
          return { handled: true };
        }

        const models = getProviderModels(currentProvider);
        if (models.length === 0) {
          return {
            handled: true,
            message: `No models available for ${currentProvider}`,
          };
        }
        // Show interactive model selector
        setAvailableModels(models);
        const currentIdx = models.indexOf(currentModel);
        setSelectedModelIndex(currentIdx >= 0 ? currentIdx : 0);
        setShowModelSelector(true);
        setShowInput(false);
        return { handled: true };

      case 'providers':
        const providers = listProviders();
        // Show interactive provider selector
        setAvailableProviders(providers);
        const currentProviderIdx = providers.indexOf(currentProvider);
        setSelectedProviderIndex(currentProviderIdx >= 0 ? currentProviderIdx : 0);
        setShowProviderSelector(true);
        setShowInput(false);
        return { handled: true };

      case 'search':
        if (currentProvider !== 'ollama') {
          return {
            handled: true,
            message: 'Search is only available for Ollama provider. Switch to Ollama first with /providers',
          };
        }
        if (args.length === 0) {
          return {
            handled: true,
            message: 'Usage: /search <query>\nExample: /search coder',
          };
        }
        const searchQuery = args.join(' ');
        setShowInput(false);
        addMessage({ type: 'system', content: `Searching for "${searchQuery}"...` });
        const ollamaSearch = new OllamaProvider();
        ollamaSearch.searchModels(searchQuery).then(searchResults => {
          if (searchResults.length === 0) {
            addMessage({ type: 'system', content: 'No models found. Try a different search term.' });
            setShowInput(true);
          } else {
            setAvailableModels(searchResults);
            setSelectedModelIndex(0);
            setShowModelSelector(true);
          }
        }).catch(() => {
          addMessage({ type: 'system', content: 'Search failed. Please try again.' });
          setShowInput(true);
        });
        return { handled: true };

      case 'clear':
        agentRef.current.clearHistory();
        setMessages([]);
        return {
          handled: true,
          message: 'Conversation history cleared',
        };

      case 'exit':
      case 'quit':
        exit();
        return { handled: true };

      default:
        return {
          handled: false,
          message: `Unknown command: /${cmd}\nType /help for available commands`,
        };
    }
  }, [currentProvider, currentModel, agentRef, exit, onConfigChange]);

  const handleSubmit = useCallback(
    async (query: string) => {
      if (!query.trim() || isProcessing) return;

      // Check for exit commands (without slash)
      if (query.trim().toLowerCase() === 'exit' || query.trim().toLowerCase() === 'quit') {
        exit();
        return;
      }

      // Handle slash commands
      if (query.startsWith('/')) {
        setInput('');
        const result = handleSlashCommand(query);
        if (result.message) {
          addMessage({ type: 'system', content: result.message! });
        }
        return;
      }

      setInput('');
      setIsProcessing(true);
      setIsThinking(true);
      setShowInput(false);

      // Reset refs and state
      currentTextRef.current = '';
      currentToolCallsRef.current = [];
      cancelledRef.current = false;
      setStreamingText('');
      setStreamingToolCalls([]);

      // Add user message
      addMessage({ type: 'user', content: query });

      const callbacks: AgentCallbacks = {
        onText: (text: string) => {
          if (cancelledRef.current) return;
          setIsThinking(false);
          currentTextRef.current += text;
          setStreamingText(prev => prev + text);
        },
        onToolCallStart: (toolCall: ToolCall) => {
          if (cancelledRef.current) return;
          setIsThinking(false);
          const newToolCall = { toolCall, status: 'running' as const };
          currentToolCallsRef.current = [...currentToolCallsRef.current, newToolCall];
          setStreamingToolCalls(prev => [...prev, newToolCall]);
        },
        onToolCallEnd: (toolCall: ToolCall, result: string) => {
          if (cancelledRef.current) return;
          const isError = result.startsWith('Error') || result.startsWith('Tool execution denied');
          currentToolCallsRef.current = currentToolCallsRef.current.map(tc =>
            tc.toolCall.id === toolCall.id
              ? { ...tc, status: (isError ? 'error' : 'completed') as 'error' | 'completed', result }
              : tc
          );
          setStreamingToolCalls(prev =>
            prev.map(tc =>
              tc.toolCall.id === toolCall.id
                ? { ...tc, status: (isError ? 'error' : 'completed') as 'error' | 'completed', result }
                : tc
            )
          );
        },
        onError: (error: Error) => {
          if (cancelledRef.current) return;
          setStreamingText(prev => prev + `\n\nError: ${error.message}`);
          setIsThinking(false);
          setShowInput(true);
          setIsProcessing(false);
        },
        onDone: () => {
          if (cancelledRef.current) return;

          // Save to message history
          const finalText = currentTextRef.current;
          const finalToolCalls = currentToolCallsRef.current;

          if (finalText || finalToolCalls.length > 0) {
            addMessage({
              type: 'assistant',
              content: finalText,
              toolCalls: finalToolCalls.length > 0 ? [...finalToolCalls] : undefined,
            });
          }

          // Clear streaming state
          setStreamingText('');
          setStreamingToolCalls([]);
          setIsThinking(false);
          setShowInput(true);
          setIsProcessing(false);
        },
        onPermissionRequest: (toolCall: ToolCall) => {
          return new Promise((resolve) => {
            // Show permission UI
            const action: PermissionAction = {
              type: toolCall.name === 'bash' ? 'execute' : 'write',
              path: toolCall.arguments.path as string | undefined,
              command: toolCall.arguments.command as string | undefined,
              toolName: toolCall.name,
              toolArgs: toolCall.arguments,
            };
            // Use queueMicrotask to ensure state update happens promptly
            queueMicrotask(() => {
              setPendingPermission({ action, resolve });
            });
          });
        },
      };

      try {
        await agentRef.current.run(query, callbacks);
      } catch (error) {
        if (!cancelledRef.current) {
          addMessage({
            type: 'assistant',
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
        setIsProcessing(false);
      }
    },
    [agentRef, isProcessing, exit, handleSlashCommand, addMessage]
  );

  // Handle initial prompt
  useEffect(() => {
    if (initialPrompt) {
      handleSubmit(initialPrompt);
    }
  }, []);

  // Handle cancel operation
  const cancelOperation = useCallback(() => {
    if (isProcessing) {
      cancelledRef.current = true;

      // Write cancellation message directly
      write('\n\x1b[33m(cancelled)\x1b[0m\n\n');

      // Save any partial response
      const partialText = currentTextRef.current;
      const partialToolCalls = currentToolCallsRef.current;

      if (partialText || partialToolCalls.length > 0) {
        addMessage({
          type: 'assistant',
          content: partialText + '\n\n(cancelled)',
          toolCalls: partialToolCalls.length > 0 ? [...partialToolCalls] : undefined,
        });
      }

      setIsThinking(false);
      setShowInput(true);
      setIsProcessing(false);
    }
  }, [isProcessing, addMessage, write]);

  // Handle Escape and Ctrl+C, and selector navigation
  useInput((input, key) => {
    // Model selector navigation
    if (showModelSelector) {
      if (key.escape) {
        setShowModelSelector(false);
        setShowInput(true);
        return;
      }
      if (key.upArrow) {
        setSelectedModelIndex(prev =>
          prev > 0 ? prev - 1 : availableModels.length - 1
        );
        return;
      }
      if (key.downArrow) {
        setSelectedModelIndex(prev =>
          prev < availableModels.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (key.return) {
        const selectedModel = availableModels[selectedModelIndex];

        // For Ollama, check if model is available locally
        if (currentProvider === 'ollama') {
          setShowModelSelector(false);
          // Check model availability asynchronously
          const ollama = new OllamaProvider();
          ollama.isModelAvailable(selectedModel).then(isAvailable => {
            if (isAvailable) {
              setCurrentModel(selectedModel);
              onConfigChange({ model: selectedModel });
              setShowInput(true);
              addMessage({ type: 'system', content: `Switched to model: ${selectedModel}` });
            } else {
              // Show download prompt
              setModelToDownload(selectedModel);
              setShowDownloadPrompt(true);
            }
          });
          return;
        }

        setCurrentModel(selectedModel);
        onConfigChange({ model: selectedModel });
        setShowModelSelector(false);
        setShowInput(true);
        addMessage({ type: 'system', content: `Switched to model: ${selectedModel}` });
        return;
      }
      return; // Don't process other keys when selector is open
    }

    // Download prompt navigation
    if (showDownloadPrompt) {
      if (key.escape) {
        setShowDownloadPrompt(false);
        setModelToDownload('');
        setShowInput(true);
        return;
      }
      if (key.return || input === 'y' || input === 'Y') {
        // Start downloading
        setShowDownloadPrompt(false);
        setIsDownloading(true);
        setDownloadProgress('Starting download...');

        const ollama = new OllamaProvider();
        ollama.pullModel(modelToDownload, (status, completed, total) => {
          if (total && completed) {
            const percent = Math.round((completed / total) * 100);
            setDownloadProgress(`${status}: ${percent}%`);
          } else {
            setDownloadProgress(status);
          }
        }).then(() => {
          setIsDownloading(false);
          setDownloadProgress('');
          setCurrentModel(modelToDownload);
          onConfigChange({ model: modelToDownload });
          setModelToDownload('');
          setShowInput(true);
          addMessage({ type: 'system', content: `Downloaded and switched to model: ${modelToDownload}` });
        }).catch(error => {
          setIsDownloading(false);
          setDownloadProgress('');
          setModelToDownload('');
          setShowInput(true);
          addMessage({ type: 'system', content: `Failed to download model: ${error.message}` });
        });
        return;
      }
      if (input === 'n' || input === 'N') {
        setShowDownloadPrompt(false);
        setModelToDownload('');
        setShowInput(true);
        return;
      }
      return;
    }

    // Provider selector navigation
    if (showProviderSelector) {
      if (key.escape) {
        setShowProviderSelector(false);
        setShowInput(true);
        return;
      }
      if (key.upArrow) {
        setSelectedProviderIndex(prev =>
          prev > 0 ? prev - 1 : availableProviders.length - 1
        );
        return;
      }
      if (key.downArrow) {
        setSelectedProviderIndex(prev =>
          prev < availableProviders.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (key.return) {
        const selectedProvider = availableProviders[selectedProviderIndex];
        setCurrentProvider(selectedProvider);
        setCurrentModel(''); // Reset model when changing provider
        onConfigChange({ provider: selectedProvider, model: undefined });
        setShowProviderSelector(false);
        setShowInput(true);
        addMessage({ type: 'system', content: `Switched to provider: ${selectedProvider}\nUse /models to select a model` });
        return;
      }
      return; // Don't process other keys when selector is open
    }

    // Escape key to cancel
    if (key.escape) {
      if (isProcessing) {
        cancelOperation();
      }
      return;
    }

    // Ctrl+C
    if (key.ctrl && input === 'c') {
      if (isProcessing) {
        cancelOperation();
      } else {
        exit();
      }
    }
  });

  const handlePermissionDecision = (allow: boolean, remember: boolean) => {
    if (pendingPermission) {
      pendingPermission.resolve({ allow, remember });
      setPendingPermission(null);
    }
  };

  // Only show banner on first render (before any messages)
  const showBanner = messages.length === 0 && !isProcessing;

  return (
    <Box flexDirection="column" padding={1}>
      {/* Banner - only shown initially */}
      {showBanner && <Banner />}

      {/* Compact header when banner is hidden */}
      {!showBanner && (
        <Box marginBottom={1}>
          <Text color="cyan" bold>
            Thiran
          </Text>
          <Text color="gray" dimColor>
            {' '}
            [{currentModel || `${currentProvider} (default)`}]
          </Text>
          {isProcessing && (
            <Text color="yellow" dimColor>
              {' '}
              (Esc to cancel)
            </Text>
          )}
        </Box>
      )}

      {/* All messages rendered with memoization to prevent unnecessary re-renders */}
      <Box flexDirection="column">
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} />
        ))}

        {/* Processing indicator - shown while thinking */}
        {isThinking && (
          <Box marginBottom={1}>
            <Spinner label="Thinking..." />
          </Box>
        )}

        {/* Streaming response - shown while processing */}
        {isProcessing && !isThinking && (streamingText || streamingToolCalls.length > 0) && (
          <Box flexDirection="column" marginBottom={1}>
            <Box>
              <Text color="blue" bold>Thiran: </Text>
            </Box>
            {/* Show tool calls */}
            {streamingToolCalls.length > 0 && (
              <Box flexDirection="column" marginLeft={2} marginBottom={1}>
                {streamingToolCalls.map((tc, idx) => {
                  const args = tc.toolCall.arguments as Record<string, string | undefined>;
                  const cmdStr = args.command ? String(args.command) : '';
                  return (
                    <Box key={tc.toolCall.id || idx}>
                      <Text color="yellow">⚡ {tc.toolCall.name}</Text>
                      {args.command && (
                        <Text color="gray"> {cmdStr.slice(0, 50)}{cmdStr.length > 50 ? '...' : ''}</Text>
                      )}
                      {args.pattern && (
                        <Text color="gray"> {args.pattern}</Text>
                      )}
                      {(args.path || args.file_path) && (
                        <Text color="gray"> {args.path || args.file_path}</Text>
                      )}
                      <Text> </Text>
                      {tc.status === 'running' && <Spinner />}
                      {tc.status === 'completed' && <Text color="green">✓</Text>}
                      {tc.status === 'error' && <Text color="red">✗</Text>}
                    </Box>
                  );
                })}
              </Box>
            )}
            {/* Show streaming text */}
            {streamingText && (
              <Box marginLeft={2}>
                <Text>{streamingText}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Permission prompt */}
      {pendingPermission && (
        <PermissionPrompt
          action={pendingPermission.action}
          onDecision={handlePermissionDecision}
        />
      )}

      {/* Model selector */}
      {showModelSelector && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="cyan" bold>Select a model for {currentProvider}:</Text>
          <Box flexDirection="column" marginTop={1}>
            {availableModels.map((model, index) => (
              <Box key={model}>
                <Text
                  color={index === selectedModelIndex ? 'cyan' : 'gray'}
                  bold={index === selectedModelIndex}
                >
                  {index === selectedModelIndex ? '❯ ' : '  '}
                  {model}
                </Text>
                {model === currentModel && (
                  <Text color="green" dimColor> (current)</Text>
                )}
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              ↑↓ to navigate, Enter to select, Esc to cancel
            </Text>
          </Box>
        </Box>
      )}

      {/* Provider selector */}
      {showProviderSelector && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="cyan" bold>Select a provider:</Text>
          <Box flexDirection="column" marginTop={1}>
            {availableProviders.map((provider, index) => (
              <Box key={provider}>
                <Text
                  color={index === selectedProviderIndex ? 'cyan' : 'gray'}
                  bold={index === selectedProviderIndex}
                >
                  {index === selectedProviderIndex ? '❯ ' : '  '}
                  {provider}
                </Text>
                {provider === currentProvider && (
                  <Text color="green" dimColor> (current)</Text>
                )}
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              ↑↓ to navigate, Enter to select, Esc to cancel
            </Text>
          </Box>
        </Box>
      )}

      {/* Download prompt for Ollama models */}
      {showDownloadPrompt && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="yellow" bold>
            Model "{modelToDownload}" is not installed locally.
          </Text>
          <Box marginTop={1}>
            <Text>Would you like to download it? </Text>
            <Text color="cyan" bold>(Y/n)</Text>
          </Box>
        </Box>
      )}

      {/* Download progress */}
      {isDownloading && (
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Spinner label={`Downloading ${modelToDownload}...`} />
          </Box>
          <Box marginTop={1}>
            <Text color="gray">{downloadProgress}</Text>
          </Box>
        </Box>
      )}

      {/* Input */}
      {showInput && !pendingPermission && !showModelSelector && !showProviderSelector && !showDownloadPrompt && !isDownloading && (
        <AutocompleteInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Enter your request or /help for commands..."
        />
      )}
    </Box>
  );
};
