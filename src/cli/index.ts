#!/usr/bin/env node

import { program } from 'commander';
import { render } from 'ink';
import React from 'react';
import { App } from '../ui/App.js';
import { Agent } from '../core/agent.js';
import { ConfigManager } from '../core/config.js';
import { createProvider, listProviders } from '../providers/index.js';
import { createTools, createToolsWithMCP } from '../tools/index.js';
import { DefaultPermissionManager } from '../security/permissions.js';
import { MCPClientManager } from '../mcp/index.js';
import type { PermissionAction, ThiranConfig, LLMProvider } from '../types.js';

const VERSION = '0.1.0';

async function main() {
  program
    .name('thiran')
    .description('AI-powered terminal coding assistant')
    .version(VERSION)
    .enablePositionalOptions();

  // Config subcommand - define first for proper parsing
  program
    .command('config')
    .description('Manage configuration')
    .option('--path', 'Show config file path')
    .option('--set <key=value>', 'Set a configuration value')
    .option('--get <key>', 'Get a configuration value')
    .action((options) => {
      const configManager = new ConfigManager();

      if (options.path) {
        console.log('User config:', configManager.getConfigPath());
        return;
      }

      if (options.set) {
        const [key, value] = options.set.split('=');
        if (!key || value === undefined) {
          console.error('Invalid format. Use: --set key=value');
          process.exit(1);
        }
        configManager.set(key as any, value);
        console.log(`Set ${key} = ${value}`);
        return;
      }

      if (options.get) {
        const value = configManager.get(options.get as any);
        console.log(value);
        return;
      }

      // Show all config
      const config = configManager.load(process.cwd());
      console.log('Current configuration:');
      console.log(JSON.stringify(config, null, 2));
    });

  // Models subcommand
  program
    .command('models')
    .description('List available models')
    .option('-p, --provider <provider>', 'Provider to list models for')
    .action(async (options) => {
      const configManager = new ConfigManager();
      const config = configManager.load(process.cwd());

      if (options.provider) {
        config.provider = options.provider;
      }

      try {
        const provider = createProvider(config);
        const models = await provider.listModels();
        console.log(`Available models for ${config.provider}:`);
        models.forEach(m => console.log(`  - ${m}`));
      } catch (error) {
        console.error(`Failed to list models: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  // Main command (default)
  program
    .option('-p, --provider <provider>', 'LLM provider (anthropic, openai, gemini, ollama)')
    .option('-m, --model <model>', 'Model to use')
    .option('--non-interactive', 'Run in non-interactive mode with a single prompt')
    .argument('[prompt]', 'Initial prompt to send')
    .action(async (initialPrompt, options) => {
      const cwd = process.cwd();

      // Load configuration
      const configManager = new ConfigManager();
      let config = configManager.load(cwd);

      // Override with CLI options
      if (options.provider) {
        config.provider = options.provider;
      }
      if (options.model) {
        config.model = options.model;
      }

      // Validate provider
      const validProviders = listProviders();
      if (!validProviders.includes(config.provider)) {
        console.error(
          `Invalid provider: ${config.provider}. Valid options: ${validProviders.join(', ')}`
        );
        process.exit(1);
      }

      // Check for API key based on provider
      const apiKeyChecks: Record<string, { envVars: string[]; configKey: keyof ThiranConfig }> = {
        anthropic: { envVars: ['ANTHROPIC_API_KEY'], configKey: 'anthropicApiKey' },
        openai: { envVars: ['OPENAI_API_KEY'], configKey: 'openaiApiKey' },
        gemini: { envVars: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'], configKey: 'googleApiKey' },
      };

      const check = apiKeyChecks[config.provider];
      if (check) {
        const hasKey = config[check.configKey] || check.envVars.some(v => process.env[v]);
        if (!hasKey) {
          console.error(`${check.envVars[0]} environment variable is required for ${config.provider}`);
          process.exit(1);
        }
      }

      // Create provider
      let provider: LLMProvider;
      try {
        provider = createProvider(config);
      } catch (error) {
        console.error(`Failed to create provider: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }

      // Initialize MCP client manager
      const mcpManager = new MCPClientManager();

      // Connect to MCP servers if configured
      if (config.mcpServers && config.mcpServers.length > 0) {
        const enabledServers = config.mcpServers.filter(s => s.enabled !== false);
        if (enabledServers.length > 0) {
          if (!options.nonInteractive) {
            console.log(`Connecting to ${enabledServers.length} MCP server(s)...`);
          }
          try {
            await mcpManager.connectAll(config.mcpServers);
            const connectedCount = mcpManager.getConnectedCount();
            if (!options.nonInteractive && connectedCount > 0) {
              console.log(`Connected to ${connectedCount} MCP server(s)`);
            }
          } catch {
            // Errors are logged by MCPClientManager, continue with available servers
          }
        }
      }

      // Create tools (including MCP tools if any)
      const tools = mcpManager.hasServers()
        ? createToolsWithMCP(mcpManager)
        : createTools();

      // Permission prompt handler
      const permissionPrompt = async (
        action: PermissionAction
      ): Promise<{ allow: boolean; remember: boolean }> => {
        // In non-interactive mode, allow everything with a warning
        if (options.nonInteractive) {
          console.log(`[Auto-allowing] ${action.type}: ${action.path || action.command || action.url}`);
          return { allow: true, remember: false };
        }

        // For interactive mode, we'll handle this through the UI
        return new Promise(resolve => {
          // The UI will handle the prompt and call the resolver
        });
      };

      // Create permission manager
      const permissions = new DefaultPermissionManager(
        config.approvalMode,
        cwd,
        permissionPrompt
      );

      // Create agent - use object wrapper so UI can access updated agent
      const agentRef = { current: new Agent(provider, tools, config, permissions, cwd) };

      // Non-interactive mode
      if (options.nonInteractive && initialPrompt) {
        console.log(`Thiran v${VERSION} - Running in non-interactive mode`);
        console.log(`Provider: ${config.provider}, Model: ${config.model || provider.defaultModel}`);
        console.log('---');

        await agentRef.current.run(initialPrompt, {
          onText: (text) => {
            process.stdout.write(text);
          },
          onToolCallStart: (toolCall) => {
            console.log(`\n[Tool] ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
          },
          onToolCallEnd: (toolCall, result) => {
            const preview = result.length > 200 ? result.slice(0, 200) + '...' : result;
            console.log(`[Result] ${preview}\n`);
          },
          onError: (error) => {
            console.error(`\n[Error] ${error.message}`);
            process.exit(1);
          },
          onDone: () => {
            console.log('\n');
          },
        });

        return;
      }

      // Handler for config changes from UI (like /model or /provider commands)
      const handleConfigChange = (newConfig: Partial<ThiranConfig>) => {
        config = { ...config, ...newConfig };

        // Recreate provider if needed
        if (newConfig.provider || newConfig.model) {
          try {
            provider = createProvider(config);
            agentRef.current = new Agent(provider, tools, config, permissions, cwd);
          } catch (error) {
            console.error(`Failed to switch provider/model: ${error instanceof Error ? error.message : error}`);
          }
        }
      };

      // Interactive mode with Ink UI
      const onPermissionRequest = async (
        action: PermissionAction
      ): Promise<{ allow: boolean; remember: boolean }> => {
        return permissionPrompt(action);
      };

      const { waitUntilExit } = render(
        React.createElement(App, {
          agentRef,
          initialPrompt,
          config,
          onPermissionRequest,
          onConfigChange: handleConfigChange,
          mcpManager: mcpManager.hasServers() ? mcpManager : undefined,
        }),
        {
          // Reduce flickering by patching console and optimizing output
          patchConsole: false,
        }
      );

      await waitUntilExit();

      // Graceful shutdown: disconnect MCP servers
      await mcpManager.disconnectAll();
    });

  await program.parseAsync();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
