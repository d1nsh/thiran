import type {
  PermissionManager,
  PermissionAction,
  PermissionResult,
  ApprovalMode,
} from '../types.js';

export type PermissionPromptFn = (action: PermissionAction) => Promise<{
  allow: boolean;
  remember: boolean;
}>;

export class DefaultPermissionManager implements PermissionManager {
  private allowedPaths: Set<string> = new Set();
  private allowedCommands: Set<string> = new Set();
  private allowedUrls: Set<string> = new Set();
  private approvalMode: ApprovalMode;
  private promptFn: PermissionPromptFn;
  private workingDirectory: string;

  constructor(
    approvalMode: ApprovalMode,
    workingDirectory: string,
    promptFn: PermissionPromptFn
  ) {
    this.approvalMode = approvalMode;
    this.workingDirectory = workingDirectory;
    this.promptFn = promptFn;

    // Auto-allow working directory
    this.allowedPaths.add(workingDirectory);
  }

  async checkPermission(action: PermissionAction): Promise<PermissionResult> {
    // Full auto mode allows everything
    if (this.approvalMode === 'full-auto') {
      return { granted: true };
    }

    switch (action.type) {
      case 'file_read':
        return this.checkFileRead(action.path!);

      case 'file_write':
      case 'file_edit':
        return this.checkFileWrite(action.path!);

      case 'bash_execute':
        return this.checkBashExecute(action.command!);

      case 'web_fetch':
        return this.checkWebFetch(action.url!);

      default:
        return { granted: false, reason: 'Unknown action type' };
    }
  }

  addToAllowList(action: PermissionAction): void {
    switch (action.type) {
      case 'file_read':
      case 'file_write':
      case 'file_edit':
        if (action.path) {
          this.allowedPaths.add(action.path);
        }
        break;
      case 'bash_execute':
        if (action.command) {
          // Extract command prefix (first word)
          const prefix = action.command.split(/\s+/)[0];
          this.allowedCommands.add(prefix);
        }
        break;
      case 'web_fetch':
        if (action.url) {
          try {
            const url = new URL(action.url);
            this.allowedUrls.add(url.hostname);
          } catch {
            // Invalid URL, don't add
          }
        }
        break;
    }
  }

  private async checkFileRead(filePath: string): Promise<PermissionResult> {
    // Check if path is within allowed paths
    if (this.isPathAllowed(filePath)) {
      return { granted: true };
    }

    // Prompt user
    const decision = await this.promptFn({
      type: 'file_read',
      path: filePath,
    });

    if (decision.allow && decision.remember) {
      this.allowedPaths.add(filePath);
    }

    return {
      granted: decision.allow,
      reason: decision.allow ? undefined : 'User denied permission',
    };
  }

  private async checkFileWrite(filePath: string): Promise<PermissionResult> {
    // Auto-edit mode allows file writes without prompting
    if (this.approvalMode === 'auto-edit' && this.isPathAllowed(filePath)) {
      return { granted: true };
    }

    // Check if path is within allowed paths
    if (this.isPathAllowed(filePath) && this.approvalMode === 'auto-edit') {
      return { granted: true };
    }

    // Prompt user
    const decision = await this.promptFn({
      type: 'file_write',
      path: filePath,
    });

    if (decision.allow && decision.remember) {
      this.allowedPaths.add(filePath);
    }

    return {
      granted: decision.allow,
      reason: decision.allow ? undefined : 'User denied permission',
    };
  }

  private async checkBashExecute(command: string): Promise<PermissionResult> {
    // Extract command prefix
    const prefix = command.split(/\s+/)[0];

    // Check if command is allowed
    if (this.allowedCommands.has(prefix)) {
      return { granted: true };
    }

    // Safe commands that don't need permission
    const safeCommands = new Set([
      'ls', 'pwd', 'echo', 'cat', 'head', 'tail', 'wc',
      'date', 'whoami', 'which', 'type', 'file',
      'git status', 'git diff', 'git log', 'git branch',
    ]);

    // Check for safe read-only commands
    if (safeCommands.has(prefix) || safeCommands.has(command.split('\n')[0].trim())) {
      return { granted: true };
    }

    // Prompt user
    const decision = await this.promptFn({
      type: 'bash_execute',
      command,
    });

    if (decision.allow && decision.remember) {
      this.allowedCommands.add(prefix);
    }

    return {
      granted: decision.allow,
      reason: decision.allow ? undefined : 'User denied permission',
    };
  }

  private async checkWebFetch(url: string): Promise<PermissionResult> {
    try {
      const urlObj = new URL(url);

      if (this.allowedUrls.has(urlObj.hostname)) {
        return { granted: true };
      }

      // Prompt user
      const decision = await this.promptFn({
        type: 'web_fetch',
        url,
      });

      if (decision.allow && decision.remember) {
        this.allowedUrls.add(urlObj.hostname);
      }

      return {
        granted: decision.allow,
        reason: decision.allow ? undefined : 'User denied permission',
      };
    } catch {
      return { granted: false, reason: 'Invalid URL' };
    }
  }

  private isPathAllowed(filePath: string): boolean {
    // Check exact match
    if (this.allowedPaths.has(filePath)) {
      return true;
    }

    // Check if path is within working directory
    if (filePath.startsWith(this.workingDirectory)) {
      return true;
    }

    // Check if path is within any allowed path
    for (const allowedPath of this.allowedPaths) {
      if (filePath.startsWith(allowedPath + '/')) {
        return true;
      }
    }

    return false;
  }
}
