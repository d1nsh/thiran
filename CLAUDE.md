# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Thiran is an AI-powered terminal coding assistant built with TypeScript. It supports multiple LLM providers (Anthropic, OpenAI, Ollama) and provides a rich terminal UI for interactive coding sessions.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Watch mode for development
npm run dev

# Run the CLI locally (after build)
node dist/cli/index.js

# Run with a prompt
node dist/cli/index.js "your prompt here"

# Run in non-interactive mode
node dist/cli/index.js --non-interactive "your prompt"
```

## Architecture

### Core Components

- **`src/cli/index.ts`**: CLI entry point using Commander.js
- **`src/core/agent.ts`**: Main agent loop with tool execution
- **`src/core/config.ts`**: Configuration management (user + project configs)
- **`src/providers/`**: LLM provider implementations
  - `anthropic.ts`: Claude API integration
  - `openai.ts`: OpenAI/GPT integration
  - `ollama.ts`: Local model support via Ollama
- **`src/tools/`**: Built-in tool implementations
  - `read.ts`, `write.ts`, `edit.ts`: File operations
  - `bash.ts`: Shell command execution
  - `glob.ts`, `grep.ts`: Search tools
- **`src/ui/`**: Terminal UI built with Ink (React for terminals)
- **`src/security/permissions.ts`**: Permission manager with approval modes

### Key Patterns

1. **Streaming Responses**: All LLM providers implement async iterables for streaming
2. **Tool Execution**: Tools receive an `ExecutionContext` with permissions and config
3. **Permission System**: Three modes (suggest, auto-edit, full-auto) control what needs approval

### Adding a New Provider

1. Create `src/providers/newprovider.ts` extending `BaseProvider`
2. Implement `chat()` returning `AsyncIterable<StreamChunk>`
3. Register in `src/providers/index.ts`

### Adding a New Tool

1. Create `src/tools/newtool.ts` extending `BaseTool`
2. Define `name`, `description`, and `parameters` (JSON Schema)
3. Implement `execute()` method
4. Register in `src/tools/index.ts`

## Environment Variables

```bash
ANTHROPIC_API_KEY    # Required for Anthropic provider
OPENAI_API_KEY       # Required for OpenAI provider
OLLAMA_BASE_URL      # Optional, defaults to http://localhost:11434
THIRAN_PROVIDER      # Override default provider
THIRAN_MODEL         # Override default model
```

## Testing

Tests not yet implemented. When adding tests:
- Use Jest with `--experimental-vm-modules` for ESM support
- Mock LLM providers to avoid API calls
- Test tool execution with real filesystem operations in temp directories
