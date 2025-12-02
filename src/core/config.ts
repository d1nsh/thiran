import Conf from 'conf';
import * as fs from 'fs';
import * as path from 'path';
import { ThiranConfig, DEFAULT_CONFIG, ApprovalMode } from '../types.js';

const CONFIG_SCHEMA = {
  provider: { type: 'string', default: 'anthropic' },
  model: { type: 'string' },
  anthropicApiKey: { type: 'string' },
  openaiApiKey: { type: 'string' },
  googleApiKey: { type: 'string' },
  ollamaBaseUrl: { type: 'string', default: 'http://localhost:11434' },
  approvalMode: { type: 'string', default: 'suggest' },
  autoCommit: { type: 'boolean', default: false },
  maxContextTokens: { type: 'number', default: 100000 },
  allowedPaths: { type: 'array', default: [] },
  blockedCommands: { type: 'array', default: [] },
  mcpServers: { type: 'array', default: [] },
} as const;

export class ConfigManager {
  private userConfig: Conf<ThiranConfig>;
  private projectConfigPath: string | null = null;

  constructor() {
    this.userConfig = new Conf<ThiranConfig>({
      projectName: 'thiran',
      schema: CONFIG_SCHEMA as any,
    });
  }

  load(workingDirectory: string): ThiranConfig {
    // Start with defaults
    let config: ThiranConfig = { ...DEFAULT_CONFIG };

    // Load user config
    config = this.mergeConfig(config, this.userConfig.store as Partial<ThiranConfig>);

    // Look for project config
    const projectConfig = this.findProjectConfig(workingDirectory);
    if (projectConfig) {
      config = this.mergeConfig(config, projectConfig);
    }

    // Override with environment variables
    config = this.applyEnvVars(config);

    return config;
  }

  private findProjectConfig(dir: string): Partial<ThiranConfig> | null {
    // Check for .thiran/config.json or thiran.config.json
    const configPaths = [
      path.join(dir, '.thiran', 'config.json'),
      path.join(dir, 'thiran.config.json'),
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf-8');
          this.projectConfigPath = configPath;
          return JSON.parse(content);
        } catch {
          // Invalid config, skip
        }
      }
    }

    return null;
  }

  private mergeConfig(
    base: ThiranConfig,
    override: Partial<ThiranConfig>
  ): ThiranConfig {
    return {
      ...base,
      ...override,
      // Merge arrays instead of replacing
      allowedPaths: [
        ...base.allowedPaths,
        ...(override.allowedPaths || []),
      ],
      blockedCommands: [
        ...base.blockedCommands,
        ...(override.blockedCommands || []),
      ],
      // MCP servers from override replace base (project config takes precedence)
      mcpServers: override.mcpServers || base.mcpServers || [],
    };
  }

  private applyEnvVars(config: ThiranConfig): ThiranConfig {
    return {
      ...config,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || config.anthropicApiKey,
      openaiApiKey: process.env.OPENAI_API_KEY || config.openaiApiKey,
      googleApiKey: process.env.GOOGLE_API_KEY || config.googleApiKey,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || config.ollamaBaseUrl,
      provider: process.env.THIRAN_PROVIDER || config.provider,
      model: process.env.THIRAN_MODEL || config.model,
      approvalMode:
        (process.env.THIRAN_APPROVAL_MODE as ApprovalMode) || config.approvalMode,
    };
  }

  set<K extends keyof ThiranConfig>(key: K, value: ThiranConfig[K]): void {
    this.userConfig.set(key, value);
  }

  get<K extends keyof ThiranConfig>(key: K): ThiranConfig[K] {
    return this.userConfig.get(key) as ThiranConfig[K];
  }

  getConfigPath(): string {
    return this.userConfig.path;
  }

  getProjectConfigPath(): string | null {
    return this.projectConfigPath;
  }
}
