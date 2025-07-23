const { DIRECTIONS } = require('./constants');
const Player = require('../game/Player');

/**
 * Validates player join match request
 * @param {Object} data - Request data
 * @returns {Object} Validation result
 */
function validateJoinMatch(data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Invalid request format'
    };
  }

  const { playerName } = data;

  if (!playerName) {
    return {
      valid: false,
      error: 'Player name is required'
    };
  }

  if (typeof playerName !== 'string') {
    return {
      valid: false,
      error: 'Player name must be a string'
    };
  }

  const trimmedName = playerName.trim();

  if (!Player.isValidName(trimmedName)) {
    return {
      valid: false,
      error: 'Invalid player name. Use 1-20 characters, letters, numbers, spaces, and basic punctuation only.'
    };
  }

  return {
    valid: true,
    data: {
      playerName: trimmedName
    }
  };
}

/**
 * Validates player movement request
 * @param {Object} data - Request data
 * @returns {Object} Validation result
 */
function validateMove(data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Invalid request format'
    };
  }

  const { direction } = data;

  if (!direction) {
    return {
      valid: false,
      error: 'Direction is required'
    };
  }

  if (typeof direction !== 'string') {
    return {
      valid: false,
      error: 'Direction must be a string'
    };
  }

  const normalizedDirection = direction.toLowerCase().trim();

  if (!DIRECTIONS[normalizedDirection]) {
    return {
      valid: false,
      error: 'Invalid direction. Use: w/north, a/west, s/south, d/east'
    };
  }

  return {
    valid: true,
    data: {
      direction: normalizedDirection
    }
  };
}

/**
 * Validates attack request
 * @param {Object} data - Request data
 * @returns {Object} Validation result
 */
function validateAttack(data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Invalid request format'
    };
  }

  const { targetPlayerId } = data;

  if (!targetPlayerId) {
    return {
      valid: false,
      error: 'Target player ID is required'
    };
  }

  if (typeof targetPlayerId !== 'string') {
    return {
      valid: false,
      error: 'Target player ID must be a string'
    };
  }

  const trimmedId = targetPlayerId.trim();

  if (!/^player_\d+_[a-z0-9]+$/.test(trimmedId)) {
    return {
      valid: false,
      error: 'Invalid player ID format'
    };
  }

  return {
    valid: true,
    data: {
      targetPlayerId: trimmedId
    }
  };
}

/**
 * Validates and sanitizes generic string input
 * @param {string} input - Input string
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateString(input, options = {}) {
  const {
    minLength = 0,
    maxLength = 1000,
    allowEmpty = false,
    pattern = null,
    patternError = 'Invalid format'
  } = options;

  if (input === null || input === undefined) {
    if (allowEmpty) {
      return { valid: true, data: '' };
    }
    return { valid: false, error: 'Input is required' };
  }

  if (typeof input !== 'string') {
    return { valid: false, error: 'Input must be a string' };
  }

  const trimmed = input.trim();

  if (!allowEmpty && trimmed.length === 0) {
    return { valid: false, error: 'Input cannot be empty' };
  }

  if (trimmed.length < minLength) {
    return { valid: false, error: `Input must be at least ${minLength} characters` };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `Input must be no more than ${maxLength} characters` };
  }

  if (pattern && !pattern.test(trimmed)) {
    return { valid: false, error: patternError };
  }

  return { valid: true, data: trimmed };
}

/**
 * Validates numeric input
 * @param {any} input - Input value
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
function validateNumber(input, options = {}) {
  const {
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    integer = false
  } = options;

  if (input === null || input === undefined) {
    return { valid: false, error: 'Number is required' };
  }

  const num = Number(input);

  if (isNaN(num)) {
    return { valid: false, error: 'Invalid number' };
  }

  if (integer && !Number.isInteger(num)) {
    return { valid: false, error: 'Number must be an integer' };
  }

  if (num < min) {
    return { valid: false, error: `Number must be at least ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `Number must be no more than ${max}` };
  }

  return { valid: true, data: num };
}

/**
 * Sanitizes user input by removing potentially dangerous characters
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters except whitespace
    .replace(/[\x00-\x08\x0E-\x1F\x7F]/g, '')
    // Limit to reasonable character set
    .replace(/[^\x20-\x7E\xA0-\uFFFF]/g, '')
    // Remove excessive whitespace
    .replace(/\s+/g, ' ');
}

/**
 * Validates HTML/script content to prevent XSS
 * @param {string} input - Input string
 * @returns {Object} Validation result
 */
function validateSafeContent(input) {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Content must be a string' };
  }

  const dangerous = [
    /<script/i,
    /<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i
  ];

  for (const pattern of dangerous) {
    if (pattern.test(input)) {
      return { valid: false, error: 'Content contains potentially dangerous elements' };
    }
  }

  return { valid: true, data: sanitizeInput(input) };
}

/**
 * Rate limiting helper - checks if an action is within rate limits
 * @param {string} identifier - Unique identifier (e.g., socket ID)
 * @param {string} action - Action type
 * @param {number} limit - Max actions per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} Rate limit check result
 */
const rateLimitStore = new Map();

function checkRateLimit(identifier, action, limit = 10, windowMs = 60000) {
  const key = `${identifier}:${action}`;
  const now = Date.now();

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  const record = rateLimitStore.get(key);

  if (now > record.resetTime) {
    // Reset window
    record.count = 1;
    record.resetTime = now + windowMs;
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: limit - record.count
  };
}

/**
 * Cleans up old rate limit records
 */
function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup rate limits every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

module.exports = {
  validateJoinMatch,
  validateMove,
  validateAttack,
  validateString,
  validateNumber,
  sanitizeInput,
  validateSafeContent,
  checkRateLimit
};