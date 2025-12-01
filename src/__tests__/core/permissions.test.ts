import { describe, it, expect, beforeEach } from '@jest/globals';
import { DefaultPermissionManager } from '../../security/permissions.js';
import type { PermissionAction } from '../../types.js';

describe('DefaultPermissionManager', () => {
  it('should auto-allow in full-auto mode', async () => {
    const mockPrompt = async (action: PermissionAction) => ({
      allow: true,
      remember: false,
    });

    const permissionManager = new DefaultPermissionManager(
      'full-auto' as any,
      process.cwd(),
      mockPrompt
    );

    const action: PermissionAction = {
      type: 'execute',
      command: 'ls',
      toolName: 'bash',
      toolArgs: {},
    };

    const result = await permissionManager.checkPermission(action);
    expect(result.granted).toBe(true);
  });

  it('should have check permission method', () => {
    const mockPrompt = async (action: PermissionAction) => ({
      allow: true,
      remember: false,
    });

    const permissionManager = new DefaultPermissionManager(
      'suggest' as any,
      process.cwd(),
      mockPrompt
    );

    expect(permissionManager.checkPermission).toBeDefined();
    expect(typeof permissionManager.checkPermission).toBe('function');
  });
});
