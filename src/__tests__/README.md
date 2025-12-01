# Thiran Tests

This directory contains unit and integration tests for Thiran.

## Test Structure

```
src/__tests__/
├── tools/           # Unit tests for built-in tools
│   ├── read.test.ts
│   ├── write.test.ts
│   ├── edit.test.ts
│   ├── glob.test.ts
│   └── grep.test.ts
├── core/            # Unit tests for core functionality
│   ├── config.test.ts
│   └── permissions.test.ts
└── integration/     # Integration tests
    └── agent.test.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test read.test.ts
```

## Test Coverage

Current test coverage includes:

### Tools (Unit Tests)
- **ReadFileTool**: File reading with line offset/limit support
- **WriteFileTool**: File creation and writing
- **EditFileTool**: File content replacement
- **GlobTool**: File pattern matching
- **GrepTool**: Content search across files

### Core (Unit Tests)
- **ConfigManager**: Configuration loading and persistence
- **PermissionManager**: Permission system for different approval modes

### Integration Tests
- **Agent**: End-to-end agent workflow testing with mocked LLM provider

## Writing New Tests

### Tool Tests

Tool tests should verify:
1. Successful execution with valid inputs
2. Error handling for invalid inputs
3. Tool definition (name, description, parameters)

Example:
```typescript
import { describe, it, expect } from '@jest/globals';
import { YourTool } from '../../tools/your-tool.js';

describe('YourTool', () => {
  let tool: YourTool;

  beforeEach(() => {
    tool = new YourTool();
  });

  it('should execute successfully', async () => {
    const result = await tool.execute(
      { /* params */ },
      { workingDirectory: process.cwd(), permissions: null as any, config: {} as any }
    );

    expect(result.success).toBe(true);
    expect(result.output).toContain('expected content');
  });
});
```

### Integration Tests

Integration tests should:
1. Test complete workflows end-to-end
2. Use mock providers to avoid API calls
3. Verify callback handling

## Test Utilities

### Temporary Test Files

Tests that need file I/O should:
- Create files in `__test_temp__` directory
- Clean up in `afterEach()` hooks
- Use `process.cwd()` as base path

### Mock LLM Provider

For integration tests, use the `MockProvider` class:

```typescript
class MockProvider implements LLMProvider {
  setResponses(responses: StreamChunk[]) {
    // Set responses to return during test
  }
}
```

## CI/CD Integration

Tests are designed to run in CI environments:
- No external API calls (all mocked)
- Cleanup of temporary files
- Fast execution (< 2 seconds)

## Troubleshooting

### Tests Failing Locally

1. Clear test temp directory: `rm -rf __test_temp__`
2. Rebuild: `npm run build`
3. Clear Jest cache: `npm test -- --clearCache`

### Permission Test Issues

Permission tests require paths within the working directory. Use:
```typescript
const testPath = process.cwd() + '/test/file.txt';
```
