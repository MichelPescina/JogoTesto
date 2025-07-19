/**
 * Unit tests for MessageHandler
 * Tests message formatting, display, and history functionality
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const MessageHandler = require('../../src/testClient/messageHandler');

describe('MessageHandler', () => {
  let handler;
  let originalLog;
  let originalError;
  let logOutput;
  let errorOutput;

  // Mock console.log and console.error to capture output
  function setupMocks() {
    logOutput = [];
    errorOutput = [];
    
    originalLog = console.log;
    originalError = console.error;
    
    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };
    
    console.error = (...args) => {
      errorOutput.push(args.join(' '));
    };
  }

  function teardownMocks() {
    console.log = originalLog;
    console.error = originalError;
  }

  test('setup', () => {
    setupMocks();
    handler = new MessageHandler({ useColors: false }); // Disable colors for easier testing
    assert.ok(handler instanceof MessageHandler);
  });

  describe('displayPlayerMessage', () => {
    test('should display player message with proper formatting', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      const messageData = {
        playerId: 'test123456789',
        text: 'Hello world!',
        timestamp: '2024-01-01T12:00:00.000Z'
      };
      
      handler.displayPlayerMessage(messageData, 'currentPlayer123');
      
      assert.strictEqual(logOutput.length, 1);
      assert.ok(logOutput[0].includes('Player test1234'));
      assert.ok(logOutput[0].includes('Hello world!'));
      assert.ok(logOutput[0].includes('12:00'));
      
      teardownMocks();
    });

    test('should identify own messages', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      const messageData = {
        playerId: 'currentPlayer123',
        text: 'My message',
        timestamp: '2024-01-01T12:00:00.000Z'
      };
      
      handler.displayPlayerMessage(messageData, 'currentPlayer123');
      
      assert.strictEqual(logOutput.length, 1);
      assert.ok(logOutput[0].includes('You'));
      assert.ok(logOutput[0].includes('My message'));
      
      teardownMocks();
    });

    test('should handle invalid message data', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      handler.displayPlayerMessage(null, 'currentPlayer123');
      
      assert.strictEqual(errorOutput.length, 1);
      assert.ok(errorOutput[0].includes('Invalid player message data'));
      
      teardownMocks();
    });
  });

  describe('displaySystemMessage', () => {
    test('should display system message with proper formatting', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      handler.displaySystemMessage('Server starting up', 'system');
      
      assert.strictEqual(logOutput.length, 1);
      assert.ok(logOutput[0].includes('[SYSTEM]'));
      assert.ok(logOutput[0].includes('Server starting up'));
      
      teardownMocks();
    });

    test('should handle different message types', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      const types = ['system', 'error', 'join', 'leave', 'connection'];
      
      for (const type of types) {
        handler.displaySystemMessage(`Test ${type} message`, type);
      }
      
      assert.strictEqual(logOutput.length, types.length);
      for (let i = 0; i < types.length; i++) {
        assert.ok(logOutput[i].includes('[SYSTEM]'));
        assert.ok(logOutput[i].includes(`Test ${types[i]} message`));
      }
      
      teardownMocks();
    });

    test('should handle empty text', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      handler.displaySystemMessage('');
      
      assert.strictEqual(logOutput.length, 0);
      
      teardownMocks();
    });
  });

  describe('displayGameMasterMessage', () => {
    test('should display GM message with proper formatting', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      const gmData = {
        text: 'Welcome to the dungeon!',
        timestamp: '2024-01-01T12:00:00.000Z'
      };
      
      handler.displayGameMasterMessage(gmData);
      
      assert.strictEqual(logOutput.length, 1);
      assert.ok(logOutput[0].includes('[GAME MASTER]'));
      assert.ok(logOutput[0].includes('Welcome to the dungeon!'));
      assert.ok(logOutput[0].includes('12:00'));
      
      teardownMocks();
    });

    test('should handle invalid GM message data', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      handler.displayGameMasterMessage({ timestamp: '2024-01-01T12:00:00.000Z' });
      
      assert.strictEqual(errorOutput.length, 1);
      assert.ok(errorOutput[0].includes('Invalid Game Master message data'));
      
      teardownMocks();
    });
  });

  describe('displayRoomChatMessage', () => {
    test('should display room chat message', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      const chatData = {
        text: 'You say: "Hello room!"',
        timestamp: '2024-01-01T12:00:00.000Z',
        isSelf: true
      };
      
      handler.displayRoomChatMessage(chatData);
      
      assert.strictEqual(logOutput.length, 1);
      assert.ok(logOutput[0].includes('[ROOM CHAT]'));
      assert.ok(logOutput[0].includes('You say: "Hello room!"'));
      
      teardownMocks();
    });
  });

  describe('displayConnectionStatus', () => {
    test('should display different connection statuses', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      const statuses = ['connected', 'connecting', 'disconnected', 'reconnecting'];
      
      for (const status of statuses) {
        handler.displayConnectionStatus(status, 'test details');
      }
      
      assert.strictEqual(logOutput.length, statuses.length);
      
      teardownMocks();
    });
  });

  describe('displayError', () => {
    test('should display error messages', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      handler.displayError('Test error message');
      
      assert.strictEqual(errorOutput.length, 1);
      assert.ok(errorOutput[0].includes('[ERROR]'));
      assert.ok(errorOutput[0].includes('Test error message'));
      
      teardownMocks();
    });

    test('should include error details when provided', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      const error = new Error('Detailed error info');
      handler.displayError('Something went wrong', error);
      
      assert.strictEqual(errorOutput.length, 1);
      assert.ok(errorOutput[0].includes('Something went wrong'));
      assert.ok(errorOutput[0].includes('Detailed error info'));
      
      teardownMocks();
    });
  });

  describe('displayPlayerCount', () => {
    test('should display player count', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      handler.displayPlayerCount({ count: 5 });
      
      assert.strictEqual(logOutput.length, 1);
      assert.ok(logOutput[0].includes('Players online: 5'));
      
      teardownMocks();
    });

    test('should handle invalid player count data', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      handler.displayPlayerCount({ count: 'invalid' });
      
      assert.strictEqual(logOutput.length, 0);
      
      teardownMocks();
    });
  });

  describe('formatTimestamp', () => {
    test('should format valid timestamps', () => {
      handler = new MessageHandler({ useColors: false });
      
      const timestamp = '2024-01-01T15:30:45.000Z';
      const result = handler.formatTimestamp(timestamp);
      
      // Should be a non-empty string that represents time
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
      assert.notStrictEqual(result, 'N/A');
    });

    test('should handle invalid timestamps', () => {
      handler = new MessageHandler({ useColors: false });
      
      const result = handler.formatTimestamp('invalid-timestamp');
      
      // Should return something that indicates an error/fallback
      assert.ok(typeof result === 'string');
    });
  });

  describe('message history', () => {
    test('should track message history', () => {
      handler = new MessageHandler({ useColors: false, maxHistory: 3 });
      setupMocks();
      
      handler.displaySystemMessage('Message 1');
      handler.displaySystemMessage('Message 2');
      handler.displaySystemMessage('Message 3');
      
      const history = handler.getMessageHistory();
      assert.strictEqual(history.length, 3);
      
      teardownMocks();
    });

    test('should limit history size', () => {
      handler = new MessageHandler({ useColors: false, maxHistory: 2 });
      setupMocks();
      
      handler.displaySystemMessage('Message 1');
      handler.displaySystemMessage('Message 2');
      handler.displaySystemMessage('Message 3');
      
      const history = handler.getMessageHistory();
      assert.strictEqual(history.length, 2);
      
      // Should keep the most recent messages
      assert.ok(history[0].message.includes('Message 2'));
      assert.ok(history[1].message.includes('Message 3'));
      
      teardownMocks();
    });

    test('should clear history', () => {
      handler = new MessageHandler({ useColors: false });
      setupMocks();
      
      handler.displaySystemMessage('Test message');
      assert.strictEqual(handler.getMessageHistory().length, 1);
      
      handler.clearHistory();
      assert.strictEqual(handler.getMessageHistory().length, 0);
      
      teardownMocks();
    });
  });

  describe('color management', () => {
    test('should set color usage', () => {
      handler = new MessageHandler({ useColors: true });
      
      handler.setColorUsage(false);
      assert.strictEqual(handler.useColors, false);
      
      handler.setColorUsage(true);
      assert.strictEqual(handler.useColors, true);
    });
  });

  describe('utility methods', () => {
    test('clearScreen should call console.clear', () => {
      handler = new MessageHandler({ useColors: false });
      
      let clearCalled = false;
      const originalClear = console.clear;
      console.clear = () => { clearCalled = true; };
      
      handler.clearScreen();
      
      assert.strictEqual(clearCalled, true);
      console.clear = originalClear;
    });
  });
});