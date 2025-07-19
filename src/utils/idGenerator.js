/**
 * Secure ID generation utilities for JogoTesto
 * Generates unique IDs for players, sessions, and matches
 */

const crypto = require('crypto');

/**
 * Generate a secure random ID with specified length
 * @param {number} length - Length of the ID to generate
 * @returns {string} Secure random ID
 */
function generateSecureId(length = 16) {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
}

/**
 * Generate a unique player ID
 * @returns {string} Player ID in format: player_[16 chars]
 */
function generatePlayerID() {
  const id = generateSecureId(16);
  return `player_${id}`;
}

/**
 * Generate a unique session ID
 * @returns {string} Session ID in format: session_[24 chars]
 */
function generateSessionID() {
  const id = generateSecureId(24);
  return `session_${id}`;
}

/**
 * Generate a unique match ID
 * @returns {string} Match ID in format: match_[12 chars]
 */
function generateMatchID() {
  const id = generateSecureId(12);
  return `match_${id}`;
}

/**
 * Generate a timestamp-based ID for ordering
 * @returns {string} Timestamp-based ID
 */
function generateTimestampID() {
  const timestamp = Date.now().toString(36);
  const random = generateSecureId(8);
  return `${timestamp}_${random}`;
}

/**
 * Validate ID format
 * @param {string} id - ID to validate
 * @param {string} type - Expected type (player, session, match)
 * @returns {boolean} True if ID format is valid
 */
function validateIdFormat(id, type) {
  if (!id || typeof id !== 'string') {
    return false;
  }

  const patterns = {
    player: /^player_[a-f0-9]{16}$/,
    session: /^session_[a-f0-9]{24}$/,
    match: /^match_[a-f0-9]{12}$/
  };

  return patterns[type] ? patterns[type].test(id) : false;
}

module.exports = {
  generateSecureId,
  generatePlayerID,
  generateSessionID,
  generateMatchID,
  generateTimestampID,
  validateIdFormat
};