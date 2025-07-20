/**
 * ID Generation utilities for JogoTesto MatchSystem
 * Provides unique identifiers for matches, players, and sessions
 */

const crypto = require('crypto');

/**
 * Generate a unique match ID
 * @returns {string} Unique match identifier
 */
function generateMatchId() {
  return `match_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate a unique player ID
 * @returns {string} Unique player identifier
 */
function generatePlayerId() {
  return `player_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate a secure session token for reconnection
 * @returns {string} Cryptographically secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a simple numeric countdown ID for timers
 * @returns {string} Simple countdown identifier
 */
function generateCountdownId() {
  return `countdown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate that an ID follows expected format
 * @param {string} id - ID to validate
 * @param {string} type - Expected type ('match', 'player', 'session', 'countdown')
 * @returns {boolean} True if ID format is valid
 */
function validateIdFormat(id, type) {
  if (!id || typeof id !== 'string') {
    return false;
  }

  const patterns = {
    match: /^match_[a-f0-9]{16}$/,
    player: /^player_[a-f0-9]{16}$/,
    session: /^[a-f0-9]{64}$/,
    countdown: /^countdown_\d+_[a-z0-9]{9}$/
  };

  return patterns[type] ? patterns[type].test(id) : false;
}

/**
 * Extract timestamp from countdown ID
 * @param {string} countdownId - Countdown ID to parse
 * @returns {number|null} Timestamp or null if invalid
 */
function getTimestampFromCountdownId(countdownId) {
  if (!validateIdFormat(countdownId, 'countdown')) {
    return null;
  }
  
  const parts = countdownId.split('_');
  return parseInt(parts[1], 10);
}

module.exports = {
  generateMatchId,
  generatePlayerId,
  generateSessionToken,
  generateCountdownId,
  validateIdFormat,
  getTimestampFromCountdownId
};