/**
 * Input Processor for Terminal Game Client
 * Handles command parsing, validation, and routing for user input
 */

const { 
  MESSAGE_CONFIG, 
  TERMINAL_CONFIG, 
  GAME_COMMANDS, 
  HELP_TEXT 
} = require('./config');

/**
 * Input processing result object
 * @typedef {Object} InputResult
 * @property {boolean} isValid - Whether the input is valid
 * @property {string} type - Type of input (command, chat, help, exit)
 * @property {string} command - Parsed command name (for commands)
 * @property {string} args - Command arguments (for commands)
 * @property {string} text - Processed text (for chat messages)
 * @property {string} error - Error message if invalid
 */

/**
 * InputProcessor class handles parsing and validation of user input
 */
class InputProcessor {
  /**
   * Initialize the input processor
   */
  constructor() {
    // No state needed for input processing
  }

  /**
   * Process user input and return structured result
   * @param {string} input - Raw input from user
   * @returns {InputResult} Processed input result
   */
  processInput(input) {
    // Handle null/undefined input
    if (input === null || input === undefined) {
      return {
        isValid: false,
        type: 'invalid',
        error: 'Input is required'
      };
    }

    // Trim input and handle empty strings
    const trimmedInput = input.trim();
    if (trimmedInput.length === 0) {
      return {
        isValid: false,
        type: 'invalid',
        error: 'Cannot send empty message'
      };
    }

    // Check message length limits
    if (trimmedInput.length > MESSAGE_CONFIG.MAX_MESSAGE_LENGTH) {
      return {
        isValid: false,
        type: 'invalid',
        error: `Message too long (max ${MESSAGE_CONFIG.MAX_MESSAGE_LENGTH} characters)`
      };
    }

    // Check for commands (start with /)
    if (trimmedInput.startsWith('/')) {
      return this.processCommand(trimmedInput);
    }

    // Default: treat as chat message
    return this.processChatMessage(trimmedInput);
  }

  /**
   * Process command input (starts with /)
   * @param {string} input - Command input starting with /
   * @returns {InputResult} Processed command result
   */
  processCommand(input) {
    const parts = input.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ').trim();

    // Help command
    if (command === TERMINAL_CONFIG.HELP_COMMAND) {
      return {
        isValid: true,
        type: 'help',
        command: 'help',
        text: HELP_TEXT
      };
    }

    // Exit commands
    if (TERMINAL_CONFIG.EXIT_COMMANDS.includes(command)) {
      return {
        isValid: true,
        type: 'exit',
        command: 'exit'
      };
    }

    // Look command
    if (GAME_COMMANDS.LOOK_COMMANDS.includes(command)) {
      return {
        isValid: true,
        type: 'command',
        command: 'look',
        gameCommand: 'look'
      };
    }

    // Go command
    if (command === GAME_COMMANDS.GO_COMMAND) {
      return this.processGoCommand(args);
    }

    // Unknown command
    return {
      isValid: false,
      type: 'invalid',
      error: `Unknown command: ${command}. Type /help for available commands.`
    };
  }

  /**
   * Process movement command (/go <direction>)
   * @param {string} direction - Direction argument
   * @returns {InputResult} Processed go command result
   */
  processGoCommand(direction) {
    if (!direction || direction.length === 0) {
      return {
        isValid: false,
        type: 'invalid',
        error: 'Go where? Please specify a direction (e.g., "/go north").'
      };
    }

    const normalizedDirection = direction.toLowerCase().trim();

    // Validate direction against known directions
    if (!GAME_COMMANDS.DIRECTIONS.includes(normalizedDirection)) {
      return {
        isValid: false,
        type: 'invalid',
        error: `Invalid direction: ${direction}. Valid directions: ${GAME_COMMANDS.DIRECTIONS.join(', ')}`
      };
    }

    return {
      isValid: true,
      type: 'command',
      command: 'go',
      gameCommand: 'go',
      args: normalizedDirection,
      direction: normalizedDirection
    };
  }

  /**
   * Process chat message (non-command input)
   * @param {string} text - Chat message text
   * @returns {InputResult} Processed chat message result
   */
  processChatMessage(text) {
    // Validate message length (already checked in processInput, but double-check)
    if (text.length > MESSAGE_CONFIG.MAX_MESSAGE_LENGTH) {
      return {
        isValid: false,
        type: 'invalid',
        error: `Message too long (max ${MESSAGE_CONFIG.MAX_MESSAGE_LENGTH} characters)`
      };
    }

    // Sanitize text (basic sanitization - remove dangerous characters)
    const sanitizedText = this.sanitizeText(text);

    return {
      isValid: true,
      type: 'chat',
      text: sanitizedText
    };
  }

  /**
   * Sanitize text input to prevent issues
   * Replicates the escapeHtml functionality from web client for safety
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Basic sanitization - remove control characters except newlines/tabs
    // This matches the basic validation done by the server
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Validate that input meets basic requirements
   * @param {string} input - Input to validate
   * @returns {Object} Validation result with isValid and error properties
   */
  validateInput(input) {
    if (input === null || input === undefined) {
      return { isValid: false, error: 'Input is required' };
    }

    if (typeof input !== 'string') {
      return { isValid: false, error: 'Input must be a string' };
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return { isValid: false, error: 'Cannot send empty message' };
    }

    if (trimmed.length > MESSAGE_CONFIG.MAX_MESSAGE_LENGTH) {
      return { isValid: false, error: `Message too long (max ${MESSAGE_CONFIG.MAX_MESSAGE_LENGTH} characters)` };
    }

    if (trimmed.length < MESSAGE_CONFIG.MIN_MESSAGE_LENGTH) {
      return { isValid: false, error: `Message too short (min ${MESSAGE_CONFIG.MIN_MESSAGE_LENGTH} character)` };
    }

    return { isValid: true };
  }

  /**
   * Check if input is a command (starts with /)
   * @param {string} input - Input to check
   * @returns {boolean} True if input is a command
   */
  isCommand(input) {
    return typeof input === 'string' && input.trim().startsWith('/');
  }

  /**
   * Get list of available commands for help
   * @returns {Array<string>} Array of available command names
   */
  getAvailableCommands() {
    return [
      '/help',
      '/look',
      '/l',
      '/go <direction>',
      ...TERMINAL_CONFIG.EXIT_COMMANDS
    ];
  }

  /**
   * Get list of valid directions for movement
   * @returns {Array<string>} Array of valid direction names
   */
  getValidDirections() {
    return [...GAME_COMMANDS.DIRECTIONS];
  }

  /**
   * Format input for sending to server
   * Creates the message object structure expected by the server
   * @param {string} text - Text to format
   * @returns {Object} Formatted message object
   */
  formatForServer(text) {
    return {
      text: this.sanitizeText(text),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Parse command and arguments from input
   * @param {string} input - Command input
   * @returns {Object} Object with command and args properties
   */
  parseCommand(input) {
    if (!input || !input.startsWith('/')) {
      return { command: null, args: null };
    }

    const parts = input.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ').trim();

    return { command, args };
  }
}

module.exports = InputProcessor;