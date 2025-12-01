import { spawn } from 'child_process';
import { BaseTool } from './base.js';
import type { ToolParameters, ToolResult, ExecutionContext } from '../types.js';

export class BashTool extends BaseTool {
  name = 'bash';
  description = `Execute a bash command in the shell.
Use this for running builds, tests, git commands, and other terminal operations.
Do NOT use this for file operations like reading or writing files - use the dedicated tools instead.
Commands run in the current working directory.`;

  parameters: ToolParameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds. Default is 60000 (1 minute). Max is 300000 (5 minutes).',
      },
    },
    required: ['command'],
  };

  private blockedPatterns = [
    /rm\s+-rf\s+\/(?!\w)/,        // rm -rf /
    /rm\s+-rf\s+~\//,             // rm -rf ~/
    /mkfs\./,                      // mkfs.* (format disk)
    /dd\s+if=.*of=\/dev/,         // dd to device
    /:\(\)\{\s*:\|:\&\s*\};:/,    // Fork bomb
    /chmod\s+-R\s+777\s+\//,      // chmod -R 777 /
    />\s*\/dev\/sd[a-z]/,         // Write to disk device
  ];

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const command = params.command as string;
    const timeout = Math.min((params.timeout as number) || 60000, 300000);

    try {
      // Check for blocked commands
      for (const pattern of this.blockedPatterns) {
        if (pattern.test(command)) {
          return this.error(`Command blocked for safety: ${command}`);
        }
      }

      // Also check config blocked commands
      for (const blocked of context.config.blockedCommands) {
        if (command.includes(blocked)) {
          return this.error(`Command blocked by configuration: ${command}`);
        }
      }

      // Note: Permission is checked by the Agent before tool execution
      // Execute command
      const result = await this.runCommand(command, context.workingDirectory, timeout);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to execute command: ${message}`);
    }
  }

  private runCommand(
    command: string,
    cwd: string,
    timeout: number
  ): Promise<ToolResult> {
    return new Promise((resolve) => {
      const proc = spawn('bash', ['-c', command], {
        cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 5000);
      }, timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        // Truncate if too long
        if (stdout.length > 50000) {
          stdout = stdout.slice(0, 50000) + '\n... (output truncated)';
        }
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        if (stderr.length > 50000) {
          stderr = stderr.slice(0, 50000) + '\n... (output truncated)';
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timer);

        if (killed) {
          resolve(this.error(`Command timed out after ${timeout}ms`));
          return;
        }

        let output = '';
        if (stdout) {
          output += stdout;
        }
        if (stderr) {
          output += (output ? '\n\nSTDERR:\n' : 'STDERR:\n') + stderr;
        }

        if (code === 0) {
          resolve(this.success(output || '(no output)'));
        } else {
          resolve({
            success: false,
            output: output || '(no output)',
            error: `Command exited with code ${code}`,
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve(this.error(`Failed to spawn process: ${err.message}`));
      });
    });
  }
}
