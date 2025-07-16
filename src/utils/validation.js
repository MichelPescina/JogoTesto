/**
 * Input validation utilities for JogoTesto
 * Handles message sanitization and validation
 */

/**
 * Maximum message length constant
 */
const MAX_MESSAGE_LENGTH = 500;

/**
 * Minimum message length constant
 */
const MIN_MESSAGE_LENGTH = 1;

/**
 * Regular expression for basic HTML tag removal
 */
const HTML_TAG_REGEX = /<[^>]*>/g;

/**
 * Regular expression for potentially dangerous characters
 */
const DANGEROUS_CHARS_REGEX = /[<>'"&]/g;

/**
 * Validates and sanitizes a player message
 * @param {Object} data - The message data to validate
 * @param {string} data.text - The message text
 * @param {string} data.timestamp - Optional timestamp
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateMessage(data) {
  // Check if data exists
  if (!data) {
    return {
      isValid: false,
      error: 'Message data is required'
    };
  }

  // Check if text property exists
  if (!data.hasOwnProperty('text')) {
    return {
      isValid: false,
      error: 'Message text is required'
    };
  }

  // Check if text is a string
  if (typeof data.text !== 'string') {
    return {
      isValid: false,
      error: 'Message text must be a string'
    };
  }

  // Check message length limits
  if (data.text.length < MIN_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Message must be at least ${MIN_MESSAGE_LENGTH} character(s) long`
    };
  }

  if (data.text.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`
    };
  }

  // Check for empty or whitespace-only messages
  if (data.text.trim().length === 0) {
    return {
      isValid: false,
      error: 'Message cannot be empty or contain only whitespace'
    };
  }

  return {
    isValid: true,
    sanitizedText: sanitizeText(data.text)
  };
}

/**
 * Sanitizes text by removing HTML tags and escaping dangerous characters
 * @param {string} text - The text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = text.replace(HTML_TAG_REGEX, '');
  
  // Escape dangerous characters
  sanitized = sanitized.replace(DANGEROUS_CHARS_REGEX, (match) => {
    const escapeMap = {
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&#x27;',
      '&': '&amp;'
    };
    return escapeMap[match] || match;
  });

  // Trim whitespace
  return sanitized.trim();
}

/**
 * Validates player ID format
 * @param {string} playerId - The player ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validatePlayerId(playerId) {
  return typeof playerId === 'string' && 
         playerId.length > 0 && 
         playerId.length <= 100;
}

/**
 * Rate limiting check (simple implementation)
 * @param {Map} rateLimitMap - Map to store rate limit data
 * @param {string} playerId - The player ID
 * @param {number} maxMessages - Maximum messages per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} True if under rate limit, false if exceeded
 */
function checkRateLimit(rateLimitMap, playerId, maxMessages = 10, windowMs = 60000) {
  const now = Date.now();
  const playerData = rateLimitMap.get(playerId) || { count: 0, windowStart: now };
  
  // Reset window if enough time has passed
  if (now - playerData.windowStart > windowMs) {
    playerData.count = 0;
    playerData.windowStart = now;
  }
  
  // Increment count
  playerData.count++;
  rateLimitMap.set(playerId, playerData);
  
  return playerData.count <= maxMessages;
}

/**
 * Validates room data structure
 * @param {Object} roomData - Room object to validate
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateRoomData(roomData) {
  if (!roomData || typeof roomData !== 'object') {
    return {
      isValid: false,
      error: 'Room data must be an object'
    };
  }

  // Required fields
  const requiredFields = ['id', 'name', 'description'];
  for (const field of requiredFields) {
    if (!roomData[field] || typeof roomData[field] !== 'string') {
      return {
        isValid: false,
        error: `Room missing required field: ${field}`
      };
    }
  }

  // Validate exits structure if present
  if (roomData.exits) {
    if (typeof roomData.exits !== 'object') {
      return {
        isValid: false,
        error: 'Room exits must be an object'
      };
    }

    for (const [direction, exit] of Object.entries(roomData.exits)) {
      if (!exit.destination || typeof exit.destination !== 'string') {
        return {
          isValid: false,
          error: `Exit ${direction} missing valid destination`
        };
      }

      if (!exit.keywords || !Array.isArray(exit.keywords) || exit.keywords.length === 0) {
        return {
          isValid: false,
          error: `Exit ${direction} missing valid keywords array`
        };
      }

      if (!exit.description || typeof exit.description !== 'string') {
        return {
          isValid: false,
          error: `Exit ${direction} missing description`
        };
      }
    }
  }

  return {
    isValid: true
  };
}

/**
 * Validates a movement command
 * @param {string} playerId - Player identifier
 * @param {string} direction - Direction to move
 * @param {string} currentRoom - Current room identifier
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateMoveCommand(playerId, direction, currentRoom) {
  if (!playerId || typeof playerId !== 'string') {
    return {
      isValid: false,
      error: 'Invalid player ID'
    };
  }

  if (!direction || typeof direction !== 'string') {
    return {
      isValid: false,
      error: 'Invalid direction'
    };
  }

  if (!currentRoom || typeof currentRoom !== 'string') {
    return {
      isValid: false,
      error: 'Invalid current room'
    };
  }

  // Validate direction format (basic check)
  const validDirectionPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  if (!validDirectionPattern.test(direction)) {
    return {
      isValid: false,
      error: 'Direction contains invalid characters'
    };
  }

  return {
    isValid: true
  };
}

/**
 * Validates a chat command message
 * @param {string} chatText - Chat message text
 * @returns {Object} Validation result with isValid boolean and error message
 */
function validateChatCommand(chatText) {
  if (!chatText || typeof chatText !== 'string') {
    return {
      isValid: false,
      error: 'Chat message must be a string'
    };
  }

  if (chatText.trim().length === 0) {
    return {
      isValid: false,
      error: 'Chat message cannot be empty'
    };
  }

  if (chatText.length > MAX_MESSAGE_LENGTH) {
    return {
      isValid: false,
      error: `Chat message cannot exceed ${MAX_MESSAGE_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    sanitizedText: sanitizeText(chatText)
  };
}

module.exports = {
  validateMessage,
  sanitizeText,
  validatePlayerId,
  checkRateLimit,
  validateRoomData,
  validateMoveCommand,
  validateChatCommand,
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH
};