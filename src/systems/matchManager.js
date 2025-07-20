/**
 * MatchManager - Core match management system for JogoTesto
 * Handles match finding, creation, and player assignment
 */

const { generateMatchId } = require('../utils/idGenerator');

/**
 * MatchManager class manages multiple concurrent matches
 */
class MatchManager {
  /**
   * Initialize the match manager
   */
  constructor() {
    /** @type {Map<string, Object>} Map of match ID to Match instance */
    this.matches = new Map();
    
    /** @type {Map<string, string>} Map of player ID to match ID */
    this.playerMatchMap = new Map();
    
    /** @type {Array<string>} Players waiting in lobby for matches */
    this.lobbyQueue = [];
    
    /** @type {number} Maximum players per match */
    this.maxPlayersPerMatch = 50;
    
    /** @type {number} Minimum players to start countdown */
    this.minPlayersForCountdown = 2;
  }

  /**
   * Find an available match or create a new one for a player
   * @param {string} playerId - Player identifier
   * @param {string} playerName - Player display name
   * @returns {Object} Match assignment result
   */
  findOrCreateMatch(playerId, playerName) {
    try {
      // Validate input
      if (!playerId || !playerName || typeof playerName !== 'string') {
        return {
          success: false,
          error: 'Invalid player ID or name'
        };
      }

      // Check if player is already in a match
      if (this.playerMatchMap.has(playerId)) {
        const existingMatchId = this.playerMatchMap.get(playerId);
        const existingMatch = this.matches.get(existingMatchId);
        
        if (existingMatch && existingMatch.state !== 'finished') {
          return {
            success: true,
            matchId: existingMatchId,
            action: 'rejoined',
            playerCount: existingMatch.players.size
          };
        }
        
        // Clean up stale mapping
        this.playerMatchMap.delete(playerId);
      }

      // Look for available match (< max players, waiting or countdown state)
      const availableMatch = this.findAvailableMatch();
      
      if (availableMatch) {
        const result = this.addPlayerToMatch(playerId, playerName, availableMatch.id);
        if (result.success) {
          return {
            success: true,
            matchId: availableMatch.id,
            action: 'joined',
            playerCount: availableMatch.players.size
          };
        }
      }

      // No available match, create new one
      const newMatchResult = this.createNewMatch();
      if (!newMatchResult.success) {
        return newMatchResult;
      }

      const addResult = this.addPlayerToMatch(playerId, playerName, newMatchResult.matchId);
      if (addResult.success) {
        return {
          success: true,
          matchId: newMatchResult.matchId,
          action: 'created',
          playerCount: 1
        };
      }

      return addResult;

    } catch (error) {
      console.error('Error in findOrCreateMatch:', error);
      return {
        success: false,
        error: 'Failed to assign match'
      };
    }
  }

  /**
   * Find an available match that can accept new players
   * @returns {Object|null} Available match or null if none found
   * @private
   */
  findAvailableMatch() {
    for (const [matchId, match] of this.matches) {
      if (match.players.size < this.maxPlayersPerMatch && 
          (match.state === 'waiting' || match.state === 'countdown')) {
        return match;
      }
    }
    return null;
  }

  /**
   * Create a new match
   * @returns {Object} Creation result with match ID
   * @private
   */
  createNewMatch() {
    try {
      const matchId = generateMatchId();
      
      // Import Match class dynamically to avoid circular dependency
      const Match = require('./match');
      const newMatch = new Match(matchId);
      
      this.matches.set(matchId, newMatch);
      
      console.log(`Created new match: ${matchId}`);
      
      return {
        success: true,
        matchId: matchId
      };
      
    } catch (error) {
      console.error('Failed to create new match:', error);
      return {
        success: false,
        error: 'Failed to create match'
      };
    }
  }

  /**
   * Add a player to a specific match
   * @param {string} playerId - Player identifier
   * @param {string} playerName - Player display name
   * @param {string} matchId - Target match ID
   * @returns {Object} Addition result
   * @private
   */
  addPlayerToMatch(playerId, playerName, matchId) {
    const match = this.matches.get(matchId);
    if (!match) {
      return {
        success: false,
        error: 'Match not found'
      };
    }

    if (match.players.size >= this.maxPlayersPerMatch) {
      return {
        success: false,
        error: 'Match is full'
      };
    }

    // Add player to match
    const addResult = match.addPlayer(playerId, playerName);
    if (!addResult.success) {
      return addResult;
    }

    // Update player-to-match mapping
    this.playerMatchMap.set(playerId, matchId);

    // Remove from lobby queue if present
    const queueIndex = this.lobbyQueue.indexOf(playerId);
    if (queueIndex !== -1) {
      this.lobbyQueue.splice(queueIndex, 1);
    }

    console.log(`Player ${playerId} added to match ${matchId}`);
    
    return {
      success: true,
      matchId: matchId
    };
  }

  /**
   * Remove a player from their current match
   * @param {string} playerId - Player identifier
   * @returns {Object} Removal result
   */
  removePlayerFromMatch(playerId) {
    const matchId = this.playerMatchMap.get(playerId);
    if (!matchId) {
      return {
        success: false,
        error: 'Player not in any match'
      };
    }

    const match = this.matches.get(matchId);
    if (!match) {
      // Clean up stale mapping
      this.playerMatchMap.delete(playerId);
      return {
        success: false,
        error: 'Match not found'
      };
    }

    // Remove player from match
    const removeResult = match.removePlayer(playerId);
    
    // Clean up mapping
    this.playerMatchMap.delete(playerId);

    // Clean up empty matches
    if (match.players.size === 0 && match.state !== 'active') {
      this.cleanupMatch(matchId);
    }

    console.log(`Player ${playerId} removed from match ${matchId}`);
    
    return removeResult;
  }

  /**
   * Get match instance by ID
   * @param {string} matchId - Match identifier
   * @returns {Object|null} Match instance or null if not found
   */
  getMatch(matchId) {
    return this.matches.get(matchId) || null;
  }

  /**
   * Get match ID for a player
   * @param {string} playerId - Player identifier
   * @returns {string|null} Match ID or null if not in match
   */
  getPlayerMatchId(playerId) {
    return this.playerMatchMap.get(playerId) || null;
  }

  /**
   * Validate a session for reconnection
   * @param {string} matchId - Match identifier
   * @param {string} playerId - Player identifier
   * @returns {boolean} True if session is valid
   */
  validateSession(matchId, playerId) {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    const playerMatchId = this.playerMatchMap.get(playerId);
    return playerMatchId === matchId && match.players.has(playerId);
  }

  /**
   * Clean up a finished or empty match
   * @param {string} matchId - Match identifier to clean up
   * @private
   */
  cleanupMatch(matchId) {
    const match = this.matches.get(matchId);
    if (match) {
      match.cleanup();
      this.matches.delete(matchId);
      console.log(`Cleaned up match: ${matchId}`);
    }
  }

  /**
   * Get manager statistics
   * @returns {Object} Current manager state statistics
   */
  getStats() {
    const stats = {
      totalMatches: this.matches.size,
      totalPlayers: this.playerMatchMap.size,
      lobbyQueue: this.lobbyQueue.length,
      matchStates: {
        waiting: 0,
        countdown: 0,
        active: 0,
        finished: 0
      }
    };

    for (const match of this.matches.values()) {
      stats.matchStates[match.state] = (stats.matchStates[match.state] || 0) + 1;
    }

    return stats;
  }
}

module.exports = MatchManager;