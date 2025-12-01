# Thiran 🤖

**Thiran** (திறன் - Tamil for "skill/ability") is an AI-powered terminal coding assistant that brings the power of multiple LLM providers directly to your command line. Built with TypeScript and featuring a beautiful terminal UI, Thiran helps you code faster with AI assistance from Anthropic Claude, OpenAI GPT, Google Gemini, or local models via Ollama.

## ✨ Features

- 🎯 **Multi-Provider Support**: Choose from Anthropic, OpenAI, Google Gemini, or Ollama
- 🎨 **Beautiful Terminal UI**: Rich, interactive interface built with Ink
- 🛠️ **Built-in Tools**: File operations, shell commands, search capabilities
- 🔒 **Permission System**: Control what the AI can do with configurable approval modes
- 💡 **Daily Wisdom**: Thirukkural-inspired programming quotes to start your day
- ⚡ **Streaming Responses**: Real-time AI responses as they're generated
- 📝 **Interactive Commands**: Slash commands for quick operations

## 🚀 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Install from Source

```bash
# Clone the repository
git clone git@github.com:d1nsh/thiran.git
cd thiran

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Run Locally

```bash
# After building
node dist/cli/index.js

# Or if linked globally
thiran
```

## ⚙️ Configuration

### Provider Setup

Thiran supports multiple LLM providers. You'll need to configure at least one provider with an API key.

#### 1. Anthropic (Claude)

**Get API Key**: https://console.anthropic.com/

```bash
# Set environment variable
export ANTHROPIC_API_KEY="your-api-key-here"

# Or configure via Thiran
thiran config --set anthropicApiKey=your-api-key-here
```

**Supported Models**:
- `claude-3-5-sonnet-20241022` (default)
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`

**Set as default provider**:
```bash
thiran config --set provider=anthropic
thiran config --set model=claude-3-5-sonnet-20241022
```

#### 2. OpenAI (GPT)

**Get API Key**: https://platform.openai.com/api-keys

```bash
# Set environment variable
export OPENAI_API_KEY="your-api-key-here"

# Or configure via Thiran
thiran config --set openaiApiKey=your-api-key-here
```

**Supported Models**:
- `gpt-4o` (default)
- `gpt-4o-mini`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

**Set as default provider**:
```bash
thiran config --set provider=openai
thiran config --set model=gpt-4o
```

#### 3. Google Gemini

**Get API Key**: https://aistudio.google.com/app/apikey

```bash
# Set environment variable (either one works)
export GOOGLE_API_KEY="your-api-key-here"
# OR
export GEMINI_API_KEY="your-api-key-here"

# Or configure via Thiran
thiran config --set googleApiKey=your-api-key-here
```

**Supported Models**:
- `gemini-2.0-flash-exp` (default)
- `gemini-1.5-pro`
- `gemini-1.5-flash`

**Set as default provider**:
```bash
thiran config --set provider=gemini
thiran config --set model=gemini-2.0-flash-exp
```

#### 4. Ollama (Local Models)

**Setup Ollama**: https://ollama.ai/

```bash
# Install Ollama first, then pull a model
ollama pull qwen2.5-coder:7b

# Ollama runs locally - no API key needed!
```

**Default Ollama URL**: `http://localhost:11434`

**Change Ollama URL** (if needed):
```bash
export OLLAMA_BASE_URL="http://your-server:11434"
```

**Recommended Models**:
- `qwen2.5-coder:7b` (best for coding)
- `codellama:13b`
- `deepseek-coder:6.7b`
- Any model available in Ollama library

**Set as default provider**:
```bash
thiran config --set provider=ollama
thiran config --set model=qwen2.5-coder:7b
```

**Interactive model management**:
```bash
# Inside Thiran, search for models
/search coder

# List and select models
/models

# Download models on-the-fly
# (Thiran will prompt to download if model is not available)
```

### Environment Variables

Create a `.env` file in your project or set these globally:

```bash
# Provider API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
GEMINI_API_KEY=...

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434

# Default Provider & Model
THIRAN_PROVIDER=anthropic
THIRAN_MODEL=claude-3-5-sonnet-20241022
```

### Configuration File

Thiran stores configuration in `~/.config/thiran/config.json`

**View current config:**
```bash
thiran config
```

**View config file location:**
```bash
thiran config --path
```

**Set configuration values:**
```bash
thiran config --set provider=anthropic
thiran config --set model=claude-3-5-sonnet-20241022
thiran config --set approvalMode=suggest
```

**Get specific value:**
```bash
thiran config --get provider
```

### Approval Modes

Control what Thiran can do automatically:

- **`suggest`** (default): Ask permission for all operations
- **`auto-edit`**: Auto-approve file edits, ask for commands
- **`full-auto`**: Auto-approve everything (use with caution!)

```bash
thiran config --set approvalMode=suggest
```

## 🎮 Usage

### Interactive Mode

```bash
# Start Thiran
thiran

# Or with initial prompt
thiran "refactor the user authentication code"
```

### Non-Interactive Mode

```bash
thiran --non-interactive "create a README for this project"
```

### Command Line Options

```bash
# Specify provider
thiran -p openai "explain this function"

# Specify model
thiran -m gpt-4o "write unit tests"

# Both
thiran -p anthropic -m claude-3-opus-20240229 "review my code"
```

### Slash Commands

While in interactive mode:

- `/help` - Show available commands
- `/models` - Select a model for current provider
- `/providers` - Switch between providers
- `/search <query>` - Search Ollama models (Ollama only)
- `/clear` - Clear conversation history
- `/exit` or `/quit` - Exit Thiran

### Keyboard Shortcuts

- **Esc** - Cancel current operation
- **Ctrl+C** - Exit (or cancel if operation running)
- **Tab** - Autocomplete (in input)

## 📚 Examples

```bash
# Code review
thiran "review the changes in src/auth.ts"

# Refactoring
thiran "refactor this function to use async/await"

# Bug fixing
thiran "there's a bug in the login flow, help me debug it"

# Code generation
thiran "create a REST API endpoint for user registration"

# Documentation
thiran "add JSDoc comments to all functions in this file"

# Testing
thiran "write unit tests for the UserService class"
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Watch mode (auto-rebuild on changes)
npm run dev

# Build
npm run build

# Run locally
node dist/cli/index.js
```

## 📁 Project Structure

```
thiran/
├── src/
│   ├── cli/          # CLI entry point
│   ├── core/         # Agent loop, config management
│   ├── providers/    # LLM provider implementations
│   ├── tools/        # Built-in tool implementations
│   ├── ui/           # Terminal UI components (Ink)
│   └── security/     # Permission management
├── dist/             # Compiled output
└── package.json
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

## 🙏 Acknowledgments

- Powered by [Anthropic Claude](https://anthropic.com)
- Built with [Ink](https://github.com/vadimdemedes/ink) for terminal UI
- Inspired by [Thirukkural](https://en.wikipedia.org/wiki/Tirukku%E1%B9%9Ba%E1%B8%B7) for daily wisdom

---

**Made with ❤️ by the Thiran team**
