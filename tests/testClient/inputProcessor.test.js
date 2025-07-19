/**
 * Unit tests for InputProcessor
 * Tests command parsing, validation, and input processing functionality
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const InputProcessor = require('../../src/testClient/inputProcessor');

describe('InputProcessor', () => {
  let processor;

  // Set up a fresh processor for each test
  test('setup', () => {
    processor = new InputProcessor();
    assert.ok(processor instanceof InputProcessor);
  });

  describe('processInput', () => {
    test('should handle null/undefined input', () => {
      processor = new InputProcessor();
      
      const result1 = processor.processInput(null);
      assert.strictEqual(result1.isValid, false);
      assert.match(result1.error, /required/i);

      const result2 = processor.processInput(undefined);
      assert.strictEqual(result2.isValid, false);
      assert.match(result2.error, /required/i);
    });

    test('should handle empty input', () => {
      processor = new InputProcessor();
      
      const result1 = processor.processInput('');
      assert.strictEqual(result1.isValid, false);
      assert.match(result1.error, /empty/i);

      const result2 = processor.processInput('   ');
      assert.strictEqual(result2.isValid, false);
      assert.match(result2.error, /empty/i);
    });

    test('should handle message length limits', () => {
      processor = new InputProcessor();
      
      // Message too long (over 500 characters)
      const longMessage = 'a'.repeat(501);
      const result = processor.processInput(longMessage);
      
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /too long/i);
      assert.match(result.error, /500/);
    });

    test('should process valid chat messages', () => {
      processor = new InputProcessor();
      
      const result = processor.processInput('Hello world!');
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.type, 'chat');
      assert.strictEqual(result.text, 'Hello world!');
    });

    test('should identify commands starting with /', () => {
      processor = new InputProcessor();
      
      const result = processor.processInput('/help');
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.type, 'help');
    });
  });

  describe('processCommand', () => {
    test('should handle help command', () => {
      processor = new InputProcessor();
      
      const result = processor.processCommand('/help');
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.type, 'help');
      assert.strictEqual(result.command, 'help');
      assert.ok(result.text.includes('Available commands'));
    });

    test('should handle exit commands', () => {
      processor = new InputProcessor();
      
      const exitCommands = ['/exit', '/quit', '/q'];
      
      for (const cmd of exitCommands) {
        const result = processor.processCommand(cmd);
        
        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.type, 'exit');
        assert.strictEqual(result.command, 'exit');
      }
    });

    test('should handle look commands', () => {
      processor = new InputProcessor();
      
      const lookCommands = ['/look', '/l'];
      
      for (const cmd of lookCommands) {
        const result = processor.processCommand(cmd);
        
        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.type, 'command');
        assert.strictEqual(result.command, 'look');
        assert.strictEqual(result.gameCommand, 'look');
      }
    });

    test('should handle unknown commands', () => {
      processor = new InputProcessor();
      
      const result = processor.processCommand('/unknown');
      
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /unknown command/i);
    });
  });

  describe('processGoCommand', () => {
    test('should validate go command with valid directions', () => {
      processor = new InputProcessor();
      
      const validDirections = ['north', 'south', 'east', 'west', 'n', 's', 'e', 'w'];
      
      for (const direction of validDirections) {
        const result = processor.processGoCommand(direction);
        
        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.type, 'command');
        assert.strictEqual(result.command, 'go');
        assert.strictEqual(result.gameCommand, 'go');
        assert.strictEqual(result.direction, direction.toLowerCase());
      }
    });

    test('should reject go command without direction', () => {
      processor = new InputProcessor();
      
      const result = processor.processGoCommand('');
      
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /go where/i);
    });

    test('should reject go command with invalid direction', () => {
      processor = new InputProcessor();
      
      const result = processor.processGoCommand('invalidDirection');
      
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /invalid direction/i);
    });

    test('should normalize direction case', () => {
      processor = new InputProcessor();
      
      const result = processor.processGoCommand('NORTH');
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.direction, 'north');
    });
  });

  describe('processChatMessage', () => {
    test('should process valid chat messages', () => {
      processor = new InputProcessor();
      
      const result = processor.processChatMessage('Hello everyone!');
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.type, 'chat');
      assert.strictEqual(result.text, 'Hello everyone!');
    });

    test('should sanitize text input', () => {
      processor = new InputProcessor();
      
      // Text with control characters that should be removed
      const textWithControlChars = 'Hello\x00\x01world\x1F!';
      const result = processor.processChatMessage(textWithControlChars);
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.text, 'Helloworld!');
    });
  });

  describe('validateInput', () => {
    test('should validate input types', () => {
      processor = new InputProcessor();
      
      const result1 = processor.validateInput(123);
      assert.strictEqual(result1.isValid, false);
      assert.match(result1.error, /string/i);

      const result2 = processor.validateInput('valid string');
      assert.strictEqual(result2.isValid, true);
    });

    test('should check message length limits', () => {
      processor = new InputProcessor();
      
      const longMessage = 'a'.repeat(501);
      const result = processor.validateInput(longMessage);
      
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /too long/i);
    });
  });

  describe('utility methods', () => {
    test('isCommand should identify commands', () => {
      processor = new InputProcessor();
      
      assert.strictEqual(processor.isCommand('/help'), true);
      assert.strictEqual(processor.isCommand('hello'), false);
      assert.strictEqual(processor.isCommand(''), false);
      assert.strictEqual(processor.isCommand(null), false);
    });

    test('getAvailableCommands should return command list', () => {
      processor = new InputProcessor();
      
      const commands = processor.getAvailableCommands();
      
      assert.ok(Array.isArray(commands));
      assert.ok(commands.includes('/help'));
      assert.ok(commands.includes('/look'));
      assert.ok(commands.includes('/go <direction>'));
    });

    test('getValidDirections should return direction list', () => {
      processor = new InputProcessor();
      
      const directions = processor.getValidDirections();
      
      assert.ok(Array.isArray(directions));
      assert.ok(directions.includes('north'));
      assert.ok(directions.includes('south'));
      assert.ok(directions.includes('n'));
      assert.ok(directions.includes('s'));
    });

    test('formatForServer should create proper message object', () => {
      processor = new InputProcessor();
      
      const result = processor.formatForServer('test message');
      
      assert.ok(typeof result === 'object');
      assert.strictEqual(result.text, 'test message');
      assert.ok(result.timestamp);
      assert.ok(new Date(result.timestamp).getTime() > 0);
    });

    test('parseCommand should parse command and arguments', () => {
      processor = new InputProcessor();
      
      const result1 = processor.parseCommand('/go north');
      assert.strictEqual(result1.command, '/go');
      assert.strictEqual(result1.args, 'north');

      const result2 = processor.parseCommand('/look');
      assert.strictEqual(result2.command, '/look');
      assert.strictEqual(result2.args, '');

      const result3 = processor.parseCommand('not a command');
      assert.strictEqual(result3.command, null);
      assert.strictEqual(result3.args, null);
    });
  });

  describe('sanitizeText', () => {
    test('should handle null/undefined input', () => {
      processor = new InputProcessor();
      
      assert.strictEqual(processor.sanitizeText(null), '');
      assert.strictEqual(processor.sanitizeText(undefined), '');
    });

    test('should remove control characters', () => {
      processor = new InputProcessor();
      
      const input = 'Hello\x00\x01\x1F world!';
      const result = processor.sanitizeText(input);
      
      assert.strictEqual(result, 'Hello world!');
    });

    test('should preserve normal text', () => {
      processor = new InputProcessor();
      
      const input = 'Hello world! How are you?';
      const result = processor.sanitizeText(input);
      
      assert.strictEqual(result, input);
    });
  });
});