/**
 * Unit tests for JogoTesto server
 * Tests validation utilities and core server functionality
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// Import modules to test
const { 
  validateMessage, 
  sanitizeText, 
  validatePlayerId, 
  checkRateLimit,
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH 
} = require('../src/utils/validation');

describe('Validation Utils', () => {
  
  describe('validateMessage', () => {
    test('should validate correct message', () => {
      const data = { text: 'Hello world!' };
      const result = validateMessage(data);
      
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.sanitizedText, 'Hello world!');
    });

    test('should reject null/undefined data', () => {
      const result1 = validateMessage(null);
      const result2 = validateMessage(undefined);
      
      assert.strictEqual(result1.isValid, false);
      assert.strictEqual(result2.isValid, false);
      assert.match(result1.error, /required/i);
    });

    test('should reject data without text property', () => {
      const data = { message: 'Hello' };
      const result = validateMessage(data);
      
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /text.*required/i);
    });

    test('should reject non-string text', () => {
      const data = { text: 123 };
      const result = validateMessage(data);
      
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /string/i);
    });

    test('should reject empty or whitespace-only messages', () => {
      const emptyData = { text: '' };
      const whitespaceData = { text: '   \n\t  ' };
      
      const result1 = validateMessage(emptyData);
      const result2 = validateMessage(whitespaceData);
      
      assert.strictEqual(result1.isValid, false);
      assert.strictEqual(result2.isValid, false);
      assert.match(result1.error, /at least.*character/i);
      assert.match(result2.error, /empty.*whitespace/i);
    });

    test('should reject messages that are too long', () => {
      const longText = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);
      const data = { text: longText };
      const result = validateMessage(data);
      
      assert.strictEqual(result.isValid, false);
      assert.match(result.error, /exceed.*characters/i);
    });

    test('should accept messages at maximum length', () => {
      const maxText = 'a'.repeat(MAX_MESSAGE_LENGTH);
      const data = { text: maxText };
      const result = validateMessage(data);
      
      assert.strictEqual(result.isValid, true);
    });
  });

  describe('sanitizeText', () => {
    test('should remove HTML tags', () => {
      const text = '<script>alert("xss")</script>Hello <b>world</b>!';
      const result = sanitizeText(text);
      
      assert.strictEqual(result, 'alert(&quot;xss&quot;)Hello world!');
    });

    test('should escape dangerous characters', () => {
      const text = 'Hello " \' & world';
      const result = sanitizeText(text);
      
      assert.strictEqual(result, 'Hello &quot; &#x27; &amp; world');
    });

    test('should handle non-string input', () => {
      const result1 = sanitizeText(null);
      const result2 = sanitizeText(123);
      const result3 = sanitizeText(undefined);
      
      assert.strictEqual(result1, '');
      assert.strictEqual(result2, '');
      assert.strictEqual(result3, '');
    });

    test('should trim whitespace', () => {
      const text = '  Hello world!  \n\t';
      const result = sanitizeText(text);
      
      assert.strictEqual(result, 'Hello world!');
    });
  });

  describe('validatePlayerId', () => {
    test('should validate correct player ID', () => {
      const result = validatePlayerId('player123');
      assert.strictEqual(result, true);
    });

    test('should reject empty player ID', () => {
      const result = validatePlayerId('');
      assert.strictEqual(result, false);
    });

    test('should reject non-string player ID', () => {
      const result1 = validatePlayerId(123);
      const result2 = validatePlayerId(null);
      
      assert.strictEqual(result1, false);
      assert.strictEqual(result2, false);
    });

    test('should reject too long player ID', () => {
      const longId = 'a'.repeat(101);
      const result = validatePlayerId(longId);
      
      assert.strictEqual(result, false);
    });
  });

  describe('checkRateLimit', () => {
    test('should allow messages under rate limit', () => {
      const rateLimitMap = new Map();
      const playerId = 'test-player';
      
      // Send 5 messages (under limit of 10)
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit(rateLimitMap, playerId);
        assert.strictEqual(result, true);
      }
    });

    test('should block messages over rate limit', () => {
      const rateLimitMap = new Map();
      const playerId = 'test-player';
      const maxMessages = 3;
      
      // Send up to limit
      for (let i = 0; i < maxMessages; i++) {
        const result = checkRateLimit(rateLimitMap, playerId, maxMessages);
        assert.strictEqual(result, true);
      }
      
      // Next message should be blocked
      const result = checkRateLimit(rateLimitMap, playerId, maxMessages);
      assert.strictEqual(result, false);
    });

    test('should reset window after time expires', () => {
      const rateLimitMap = new Map();
      const playerId = 'test-player';
      const maxMessages = 2;
      const windowMs = 1; // Very short window for testing
      
      // Fill up the limit
      checkRateLimit(rateLimitMap, playerId, maxMessages, windowMs);
      checkRateLimit(rateLimitMap, playerId, maxMessages, windowMs);
      
      // Should be blocked
      let result = checkRateLimit(rateLimitMap, playerId, maxMessages, windowMs);
      assert.strictEqual(result, false);
      
      // Wait for window to reset
      setTimeout(() => {
        result = checkRateLimit(rateLimitMap, playerId, maxMessages, windowMs);
        assert.strictEqual(result, true);
      }, windowMs + 1);
    });
  });
});

describe('Socket Configuration', () => {
  test('should load socket configuration', () => {
    const socketConfig = require('../src/config/socket');
    
    assert.strictEqual(typeof socketConfig, 'object');
    assert.strictEqual(socketConfig.pingInterval, 10000);
    assert.strictEqual(socketConfig.pingTimeout, 5000);
    assert.strictEqual(socketConfig.maxHttpBufferSize, 1e6);
    assert.strictEqual(socketConfig.compression, true);
  });
});

describe('Constants', () => {
  test('should have correct message length constants', () => {
    assert.strictEqual(MAX_MESSAGE_LENGTH, 500);
    assert.strictEqual(MIN_MESSAGE_LENGTH, 1);
  });
});