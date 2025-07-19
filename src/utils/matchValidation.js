/**
 * Match-specific validation utilities for JogoTesto
 * Validates match-related data and operations
 */

const { validateIdFormat } = require('./idGenerator');

/**
 * Validate match creation data
 * @param {Array<Object>} players - Array of player objects
 * @returns {Object} Validation result
 */
function validateMatchPlayers(players) {
  if (!Array.isArray(players)) {
    return {
      isValid: false,
      error: 'Players must be an array'
    };
  }
  
  if (players.length < 1) {
    return {
      isValid: false,
      error: 'At least one player is required for a match'
    };
  }
  
  if (players.length > 50) {
    return {
      isValid: false,
      error: 'Maximum 50 players allowed per match'
    };
  }
  
  // Validate each player object
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    
    if (!player || typeof player !== 'object') {
      return {
        isValid: false,
        error: `Player at index ${i} is not a valid object`
      };
    }
    
    if (!player.playerID || !validateIdFormat(player.playerID, 'player')) {
      return {
        isValid: false,
        error: `Player at index ${i} has invalid playerID: ${player.playerID}`
      };
    }
    
    if (!player.username || typeof player.username !== 'string' || player.username.trim().length === 0) {
      return {
        isValid: false,
        error: `Player at index ${i} has invalid username: ${player.username}`
      };
    }
    
    if (player.username.trim().length > 20) {
      return {
        isValid: false,
        error: `Player at index ${i} username too long (max 20 characters): ${player.username}`
      };
    }
  }
  
  // Check for duplicate player IDs
  const playerIds = players.map(p => p.playerID);
  const uniquePlayerIds = new Set(playerIds);
  
  if (playerIds.length !== uniquePlayerIds.size) {
    return {
      isValid: false,
      error: 'Duplicate player IDs found in match players'
    };
  }
  
  return {
    isValid: true,
    playerCount: players.length
  };
}

/**
 * Validate match movement command
 * @param {string} direction - Movement direction
 * @returns {Object} Validation result
 */
function validateMovementDirection(direction) {
  if (!direction || typeof direction !== 'string') {
    return {
      isValid: false,
      error: 'Direction must be a non-empty string'
    };
  }
  
  const trimmedDirection = direction.trim().toLowerCase();
  
  if (trimmedDirection.length === 0) {
    return {
      isValid: false,
      error: 'Direction cannot be empty'
    };
  }
  
  if (trimmedDirection.length > 20) {
    return {
      isValid: false,
      error: 'Direction too long (max 20 characters)'
    };
  }
  
  // Common valid directions (room system will handle specific validation)
  const commonDirections = [
    'north', 'south', 'east', 'west', 'up', 'down',
    'northeast', 'northwest', 'southeast', 'southwest',
    'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
  ];
  
  return {
    isValid: true,
    direction: trimmedDirection,
    isCommonDirection: commonDirections.includes(trimmedDirection)
  };
}

/**
 * Validate chat message for match context
 * @param {string} message - Chat message
 * @returns {Object} Validation result
 */
function validateMatchChatMessage(message) {
  if (!message || typeof message !== 'string') {
    return {
      isValid: false,
      error: 'Message must be a non-empty string'
    };
  }
  
  const trimmedMessage = message.trim();
  
  if (trimmedMessage.length === 0) {
    return {
      isValid: false,
      error: 'Message cannot be empty'
    };
  }
  
  if (trimmedMessage.length > 500) {
    return {
      isValid: false,
      error: 'Message too long (max 500 characters)'
    };
  }
  
  // Check for potentially harmful content
  const forbiddenPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i
  ];
  
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(trimmedMessage)) {
      return {
        isValid: false,
        error: 'Message contains forbidden content'
      };
    }
  }
  
  return {
    isValid: true,
    message: trimmedMessage
  };
}

/**
 * Validate match ID format
 * @param {string} matchId - Match identifier
 * @returns {Object} Validation result
 */
function validateMatchId(matchId) {
  if (!matchId || typeof matchId !== 'string') {
    return {
      isValid: false,
      error: 'Match ID must be a non-empty string'
    };
  }
  
  // Match IDs can be either generated format or custom format
  const generatedFormat = /^match_[a-f0-9]{12}$/;
  const customFormat = /^match_\d+_\d+$/; // match_counter_timestamp
  
  if (!generatedFormat.test(matchId) && !customFormat.test(matchId)) {
    return {
      isValid: false,
      error: 'Invalid match ID format'
    };
  }
  
  return {
    isValid: true,
    matchId: matchId
  };
}

/**
 * Validate player status for match operations
 * @param {string} status - Player status
 * @returns {Object} Validation result
 */
function validatePlayerStatus(status) {
  const validStatuses = ['active', 'forfeited', 'disconnected', 'eliminated'];
  
  if (!status || typeof status !== 'string') {
    return {
      isValid: false,
      error: 'Status must be a non-empty string'
    };
  }
  
  if (!validStatuses.includes(status)) {
    return {
      isValid: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    };
  }
  
  return {
    isValid: true,
    status: status
  };
}

/**
 * Validate match state transition
 * @param {string} currentStatus - Current match status
 * @param {string} newStatus - New match status
 * @returns {Object} Validation result
 */
function validateMatchStatusTransition(currentStatus, newStatus) {
  const validStatuses = ['starting', 'active', 'finished', 'failed'];
  const validTransitions = {
    'starting': ['active', 'failed'],
    'active': ['finished'],
    'finished': [], // No transitions from finished
    'failed': []    // No transitions from failed
  };
  
  if (!validStatuses.includes(currentStatus)) {
    return {
      isValid: false,
      error: `Invalid current status: ${currentStatus}`
    };
  }
  
  if (!validStatuses.includes(newStatus)) {
    return {
      isValid: false,
      error: `Invalid new status: ${newStatus}`
    };
  }
  
  if (!validTransitions[currentStatus].includes(newStatus)) {
    return {
      isValid: false,
      error: `Invalid status transition from ${currentStatus} to ${newStatus}`
    };
  }
  
  return {
    isValid: true,
    transition: `${currentStatus} -> ${newStatus}`
  };
}

/**
 * Validate queue player data
 * @param {Object} queuedPlayer - Queued player object
 * @returns {Object} Validation result
 */
function validateQueuedPlayer(queuedPlayer) {
  if (!queuedPlayer || typeof queuedPlayer !== 'object') {
    return {
      isValid: false,
      error: 'Queued player must be an object'
    };
  }
  
  const { playerID, username, queuedAt, priority } = queuedPlayer;
  
  if (!playerID || !validateIdFormat(playerID, 'player')) {
    return {
      isValid: false,
      error: 'Invalid playerID in queued player'
    };
  }
  
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return {
      isValid: false,
      error: 'Invalid username in queued player'
    };
  }
  
  if (!queuedAt || typeof queuedAt !== 'number' || queuedAt <= 0) {
    return {
      isValid: false,
      error: 'Invalid queuedAt timestamp in queued player'
    };
  }
  
  if (priority !== undefined && (typeof priority !== 'number' || priority < 0)) {
    return {
      isValid: false,
      error: 'Invalid priority in queued player'
    };
  }
  
  return {
    isValid: true,
    queuedPlayer: queuedPlayer
  };
}

/**
 * Sanitize username for display
 * @param {string} username - Raw username
 * @returns {string} Sanitized username
 */
function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') {
    return 'Anonymous';
  }
  
  return username
    .trim()
    .substring(0, 20) // Max 20 characters
    .replace(/[<>\"'&]/g, '') // Remove potentially harmful characters
    .trim();
}

/**
 * Validate match configuration
 * @param {Object} config - Match configuration object
 * @returns {Object} Validation result
 */
function validateMatchConfig(config) {
  if (!config || typeof config !== 'object') {
    return {
      isValid: false,
      error: 'Match config must be an object'
    };
  }
  
  const { minPlayers, maxPlayers, maxDuration } = config;
  
  if (minPlayers !== undefined) {
    if (typeof minPlayers !== 'number' || minPlayers < 1 || minPlayers > 50) {
      return {
        isValid: false,
        error: 'minPlayers must be a number between 1 and 50'
      };
    }
  }
  
  if (maxPlayers !== undefined) {
    if (typeof maxPlayers !== 'number' || maxPlayers < 1 || maxPlayers > 50) {
      return {
        isValid: false,
        error: 'maxPlayers must be a number between 1 and 50'
      };
    }
    
    if (minPlayers !== undefined && maxPlayers < minPlayers) {
      return {
        isValid: false,
        error: 'maxPlayers must be greater than or equal to minPlayers'
      };
    }
  }
  
  if (maxDuration !== undefined) {
    if (typeof maxDuration !== 'number' || maxDuration < 60000 || maxDuration > 3600000) {
      return {
        isValid: false,
        error: 'maxDuration must be between 1 minute and 1 hour (in milliseconds)'
      };
    }
  }
  
  return {
    isValid: true,
    config: config
  };
}

module.exports = {
  validateMatchPlayers,
  validateMovementDirection,
  validateMatchChatMessage,
  validateMatchId,
  validatePlayerStatus,
  validateMatchStatusTransition,
  validateQueuedPlayer,
  sanitizeUsername,
  validateMatchConfig
};