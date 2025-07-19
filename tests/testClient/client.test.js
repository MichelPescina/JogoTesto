/**
 * Unit tests for TerminalGameClient
 * Tests client initialization, configuration, and basic functionality
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const TerminalGameClient = require('../../src/testClient/client');

describe('TerminalGameClient', () => {
  let client;

  describe('initialization', () => {
    test('should create client with default options', () => {
      client = new TerminalGameClient();
      
      assert.ok(client instanceof TerminalGameClient);
      assert.strictEqual(client.serverUrl, 'http://localhost:3000');
      assert.strictEqual(client.useColors, true);
      assert.strictEqual(client.autoConnect, true);
      assert.strictEqual(client.isRunning, false);
      assert.strictEqual(client.isConnected, false);
      assert.strictEqual(client.batchMode, false);
    });

    test('should create client with custom options', () => {
      const options = {
        serverUrl: 'http://example.com:8080',
        useColors: false,
        autoConnect: false
      };
      
      client = new TerminalGameClient(options);
      
      assert.strictEqual(client.serverUrl, 'http://example.com:8080');
      assert.strictEqual(client.useColors, false);
      assert.strictEqual(client.autoConnect, false);
    });

    test('should initialize all components', () => {
      client = new TerminalGameClient();
      
      assert.ok(client.messageHandler);
      assert.ok(client.inputProcessor);
      assert.ok(client.connectionManager);
    });
  });

  describe('batch mode', () => {
    test('should enable and disable batch mode', () => {
      client = new TerminalGameClient();
      
      assert.strictEqual(client.batchMode, false);
      
      client.setBatchMode(true);
      assert.strictEqual(client.batchMode, true);
      assert.ok(Array.isArray(client.batchCommands));
      assert.ok(Array.isArray(client.batchResults));
      
      client.setBatchMode(false);
      assert.strictEqual(client.batchMode, false);
    });
  });

  describe('status methods', () => {
    test('should return current status', () => {
      client = new TerminalGameClient({ 
        serverUrl: 'http://test.com',
        useColors: false 
      });
      
      const status = client.getStatus();
      
      assert.ok(typeof status === 'object');
      assert.strictEqual(status.isRunning, false);
      assert.strictEqual(status.isConnected, false);
      assert.strictEqual(status.serverUrl, 'http://test.com');
      assert.strictEqual(status.batchMode, false);
      assert.ok(status.connectionStats);
    });

    test('should get available commands', () => {
      client = new TerminalGameClient();
      
      const commands = client.getAvailableCommands();
      
      assert.ok(Array.isArray(commands));
      assert.ok(commands.length > 0);
      assert.ok(commands.includes('/help'));
      assert.ok(commands.includes('/look'));
    });

    test('should get valid directions', () => {
      client = new TerminalGameClient();
      
      const directions = client.getValidDirections();
      
      assert.ok(Array.isArray(directions));
      assert.ok(directions.length > 0);
      assert.ok(directions.includes('north'));
      assert.ok(directions.includes('south'));
    });
  });

  describe('color management', () => {
    test('should set color usage', () => {
      client = new TerminalGameClient({ useColors: true });
      
      client.setColorUsage(false);
      assert.strictEqual(client.useColors, false);
      
      client.setColorUsage(true);
      assert.strictEqual(client.useColors, true);
    });
  });

  describe('message history', () => {
    test('should get message history', () => {
      client = new TerminalGameClient();
      
      const history = client.getMessageHistory();
      assert.ok(Array.isArray(history));
    });

    test('should clear message history', () => {
      client = new TerminalGameClient();
      
      // This should not throw an error
      client.clearHistory();
      
      const history = client.getMessageHistory();
      assert.strictEqual(history.length, 0);
    });
  });

  describe('input handling', () => {
    test('should handle help command', () => {
      client = new TerminalGameClient();
      
      // Mock the messageHandler to capture output
      let helpDisplayed = false;
      client.messageHandler.displayHelp = (text) => {
        helpDisplayed = true;
        assert.ok(text.includes('Available commands'));
      };
      
      client.handleInput('/help');
      assert.strictEqual(helpDisplayed, true);
    });

    test('should handle invalid input', () => {
      client = new TerminalGameClient();
      
      // Mock the messageHandler to capture errors
      let errorDisplayed = false;
      client.messageHandler.displayError = (error) => {
        errorDisplayed = true;
        assert.ok(typeof error === 'string');
      };
      
      client.handleInput(''); // Empty input should trigger error
      assert.strictEqual(errorDisplayed, true);
    });

    test('should handle game commands when not connected', () => {
      client = new TerminalGameClient();
      client.isConnected = false;
      
      // Mock the messageHandler to capture errors
      let errorDisplayed = false;
      client.messageHandler.displayError = (error) => {
        errorDisplayed = true;
        assert.ok(error.includes('Not connected'));
      };
      
      client.handleInput('/look');
      assert.strictEqual(errorDisplayed, true);
    });
  });

  describe('lifecycle methods', () => {
    test('should handle stop method', () => {
      client = new TerminalGameClient();
      client.isRunning = true;
      
      // Mock messageHandler to capture system message
      let systemMessageDisplayed = false;
      client.messageHandler.displaySystemMessage = (message, _type) => {
        if (message.includes('stopped')) {
          systemMessageDisplayed = true;
        }
      };
      
      client.stop();
      
      assert.strictEqual(client.isRunning, false);
      assert.strictEqual(systemMessageDisplayed, true);
    });

    test('should handle disconnect method', () => {
      client = new TerminalGameClient();
      
      // Mock connectionManager disconnect
      let disconnectCalled = false;
      client.connectionManager.disconnect = (graceful) => {
        disconnectCalled = true;
        assert.strictEqual(graceful, true);
      };
      
      // Mock messageHandler to capture system message
      let systemMessageDisplayed = false;
      client.messageHandler.displaySystemMessage = (message, _type) => {
        if (message.includes('Disconnected')) {
          systemMessageDisplayed = true;
        }
      };
      
      client.disconnect();
      
      assert.strictEqual(disconnectCalled, true);
      assert.strictEqual(systemMessageDisplayed, true);
    });
  });

  describe('error handling', () => {
    test('should handle input processing errors gracefully', () => {
      client = new TerminalGameClient();
      
      // Mock inputProcessor to throw an error
      client.inputProcessor.processInput = () => {
        throw new Error('Test processing error');
      };
      
      // Mock messageHandler to capture error
      let errorDisplayed = false;
      client.messageHandler.displayError = (message, error) => {
        errorDisplayed = true;
        assert.ok(message.includes('Error processing input'));
        assert.ok(error instanceof Error);
      };
      
      client.handleInput('test input');
      assert.strictEqual(errorDisplayed, true);
    });
  });

  describe('AI agent integration', () => {
    test('should handle executeCommand for automation', async () => {
      client = new TerminalGameClient();
      
      const result = await client.executeCommand('/help');
      
      assert.ok(typeof result === 'object');
      assert.strictEqual(result.success, true);
      assert.ok(result.result);
    });

    test('should handle executeCommand with invalid input', async () => {
      client = new TerminalGameClient();
      
      const result = await client.executeCommand('');
      
      assert.ok(typeof result === 'object');
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    test('should handle executeBatch for automation', async () => {
      client = new TerminalGameClient();
      
      const commands = ['/help', '/look'];
      const results = await client.executeBatch(commands);
      
      assert.ok(Array.isArray(results));
      assert.strictEqual(results.length, 2);
      
      // Both commands should be processed
      for (const result of results) {
        assert.ok(typeof result === 'object');
        assert.ok('success' in result);
      }
    });
  });
});