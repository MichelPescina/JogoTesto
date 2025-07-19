/**
 * Match Management System for JogoTesto
 * Handles matchmaking queue, match creation, and match lifecycle
 */

// Match ID generation handled in createMatch method

/**
 * MatchManager class manages the matchmaking system and active matches
 */
class MatchManager {
  /**
   * Initialize the match manager
   */
  constructor() {
    /** @type {Map<string, Object>} Map of matchId to Match instance */
    this.activeMatches = new Map();
    
    /** @type {Set<Object>} Set of players waiting for match */
    this.waitingQueue = new Set();
    
    /** @type {Map<string, string>} Map of playerID to matchId */
    this.playerMatches = new Map();
    
    /** @type {number} Counter for match numbering */
    this.matchCounter = 0;
    
    /** @type {number} Minimum players required to start a match */
    this.minPlayersToStart = 10;
    
    /** @type {number} Maximum players allowed in a match */
    this.maxPlayersPerMatch = 50;
    
    /** @type {number} Queue check interval in milliseconds */
    this.queueCheckInterval = 5000; // 5 seconds
    
    /** @type {NodeJS.Timeout} Queue processing timer */
    this.queueTimer = null;
    
    // Start queue processing
    this.startQueueProcessing();
    
    console.log('MatchManager initialized');
  }

  /**
   * Add a player to the matchmaking queue
   * @param {string} playerID - Player identifier
   * @param {string} username - Player's username
   * @returns {Object} Queue status
   */
  addPlayerToQueue(playerID, username) {
    // Check if player is already in queue
    for (const queuedPlayer of this.waitingQueue) {
      if (queuedPlayer.playerID === playerID) {
        return {
          success: false,
          error: 'Player already in queue',
          queuePosition: this.getQueuePosition(playerID)
        };
      }
    }
    
    // Check if player is already in an active match
    if (this.playerMatches.has(playerID)) {
      const matchId = this.playerMatches.get(playerID);
      const match = this.activeMatches.get(matchId);
      if (match && match.status === 'active') {
        return {
          success: false,
          error: 'Player already in active match',
          matchId: matchId
        };
      } else {
        // Clean up stale match reference
        this.playerMatches.delete(playerID);
      }
    }
    
    // Add player to queue
    const queuedPlayer = {
      playerID,
      username: username || `Player_${playerID.slice(-8)}`,
      queuedAt: Date.now(),
      priority: 0 // Could be used for VIP players, etc.
    };
    
    this.waitingQueue.add(queuedPlayer);
    
    console.log(`Player ${playerID} (${queuedPlayer.username}) added to matchmaking queue`);
    
    // Try to create match immediately if enough players
    this.tryCreateMatch();
    
    return {
      success: true,
      queuePosition: this.getQueuePosition(playerID),
      queueSize: this.waitingQueue.size,
      estimatedWaitTime: this.getEstimatedWaitTime()
    };
  }

  /**
   * Remove a player from the matchmaking queue
   * @param {string} playerID - Player identifier
   * @returns {boolean} True if player was removed from queue
   */
  removePlayerFromQueue(playerID) {
    for (const queuedPlayer of this.waitingQueue) {
      if (queuedPlayer.playerID === playerID) {
        this.waitingQueue.delete(queuedPlayer);
        console.log(`Player ${playerID} removed from matchmaking queue`);
        return true;
      }
    }
    return false;
  }

  /**
   * Try to create a match if enough players are available
   * @returns {Object|null} Created match or null if not enough players
   */
  tryCreateMatch() {
    if (this.waitingQueue.size < this.minPlayersToStart) {
      return null;
    }
    
    // Get players for the match (up to max players)
    const playersForMatch = Array.from(this.waitingQueue)
      .sort((a, b) => a.queuedAt - b.queuedAt) // Prioritize by queue time
      .slice(0, this.maxPlayersPerMatch);
    
    // Create the match
    return this.createMatch(playersForMatch);
  }

  /**
   * Create a new match with the specified players
   * @param {Array<Object>} players - Array of player objects
   * @returns {Object} Created match
   */
  createMatch(players) {
    const matchId = `match_${++this.matchCounter}_${Date.now()}`;
    
    console.log(`Creating match ${matchId} with ${players.length} players`);
    
    // Import Match class here to avoid circular dependency
    const Match = require('./match');
    const match = new Match(matchId, players);
    
    // Store the match
    this.activeMatches.set(matchId, match);
    
    // Remove players from queue and assign to match
    players.forEach(player => {
      this.waitingQueue.delete(player);
      this.playerMatches.set(player.playerID, matchId);
    });
    
    console.log(`Match ${matchId} created successfully with ${players.length} players`);
    
    return match;
  }

  /**
   * Get a match by ID
   * @param {string} matchId - Match identifier
   * @returns {Object|null} Match instance or null if not found
   */
  getMatch(matchId) {
    return this.activeMatches.get(matchId) || null;
  }

  /**
   * Get the match a player is currently in
   * @param {string} playerID - Player identifier
   * @returns {Object|null} Match instance or null if not in a match
   */
  getPlayerMatch(playerID) {
    const matchId = this.playerMatches.get(playerID);
    return matchId ? this.getMatch(matchId) : null;
  }

  /**
   * Remove a player from their current match
   * @param {string} playerID - Player identifier
   * @returns {boolean} True if player was removed from a match
   */
  removePlayerFromMatch(playerID) {
    const matchId = this.playerMatches.get(playerID);
    if (!matchId) {
      return false;
    }
    
    const match = this.getMatch(matchId);
    if (match) {
      match.removePlayer(playerID);
    }
    
    this.playerMatches.delete(playerID);
    console.log(`Player ${playerID} removed from match ${matchId}`);
    
    return true;
  }

  /**
   * End a match and clean up resources
   * @param {string} matchId - Match identifier
   * @returns {boolean} True if match was ended successfully
   */
  endMatch(matchId) {
    const match = this.getMatch(matchId);
    if (!match) {
      return false;
    }
    
    // Remove all players from match tracking
    for (const [playerID, playerMatchId] of this.playerMatches) {
      if (playerMatchId === matchId) {
        this.playerMatches.delete(playerID);
      }
    }
    
    // Clean up match resources
    if (match.destroy) {
      match.destroy();
    }
    
    // Remove match from active matches
    this.activeMatches.delete(matchId);
    
    console.log(`Match ${matchId} ended and cleaned up`);
    return true;
  }

  /**
   * Get player's position in the queue
   * @param {string} playerID - Player identifier
   * @returns {number} Queue position (1-based) or 0 if not in queue
   */
  getQueuePosition(playerID) {
    const sortedQueue = Array.from(this.waitingQueue)
      .sort((a, b) => a.queuedAt - b.queuedAt);
    
    const position = sortedQueue.findIndex(player => player.playerID === playerID);
    return position === -1 ? 0 : position + 1;
  }

  /**
   * Get estimated wait time for a player
   * @returns {number} Estimated wait time in milliseconds
   */
  getEstimatedWaitTime() {
    const playersNeeded = Math.max(0, this.minPlayersToStart - this.waitingQueue.size);
    
    if (playersNeeded === 0) {
      return 0; // Match should start soon
    }
    
    // Rough estimate: 30 seconds per additional player needed
    return playersNeeded * 30000;
  }

  /**
   * Start automatic queue processing
   * @private
   */
  startQueueProcessing() {
    this.queueTimer = setInterval(() => {
      this.processQueue();
    }, this.queueCheckInterval);
  }

  /**
   * Stop automatic queue processing
   * @private
   */
  stopQueueProcessing() {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
      this.queueTimer = null;
    }
  }

  /**
   * Process the matchmaking queue
   * @private
   */
  processQueue() {
    // Clean up expired queue entries (players who waited too long)
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    
    for (const queuedPlayer of this.waitingQueue) {
      if (now - queuedPlayer.queuedAt > maxWaitTime) {
        console.log(`Removing player ${queuedPlayer.playerID} from queue due to timeout`);
        this.waitingQueue.delete(queuedPlayer);
      }
    }
    
    // Try to create matches
    this.tryCreateMatch();
    
    // Log queue status if there are players waiting
    if (this.waitingQueue.size > 0) {
      console.log(`Matchmaking queue: ${this.waitingQueue.size} players waiting, ${this.activeMatches.size} active matches`);
    }
  }

  /**
   * Get comprehensive statistics about the match system
   * @returns {Object} Statistics about matches and queue
   */
  getStats() {
    const queuePlayersByWaitTime = {};
    const now = Date.now();
    
    for (const player of this.waitingQueue) {
      const waitTime = Math.floor((now - player.queuedAt) / 1000);
      const bracket = Math.floor(waitTime / 30) * 30; // 30-second brackets
      queuePlayersByWaitTime[bracket] = (queuePlayersByWaitTime[bracket] || 0) + 1;
    }
    
    const matchStatusCounts = {};
    for (const match of this.activeMatches.values()) {
      matchStatusCounts[match.status] = (matchStatusCounts[match.status] || 0) + 1;
    }
    
    return {
      activeMatches: this.activeMatches.size,
      queueSize: this.waitingQueue.size,
      totalPlayersInMatches: this.playerMatches.size,
      matchStatusCounts,
      queuePlayersByWaitTime,
      averageQueueTime: this.getAverageQueueTime()
    };
  }

  /**
   * Get average queue time for current players
   * @returns {number} Average queue time in milliseconds
   * @private
   */
  getAverageQueueTime() {
    if (this.waitingQueue.size === 0) {
      return 0;
    }
    
    const now = Date.now();
    const totalWaitTime = Array.from(this.waitingQueue)
      .reduce((sum, player) => sum + (now - player.queuedAt), 0);
    
    return Math.floor(totalWaitTime / this.waitingQueue.size);
  }

  /**
   * Cleanup resources when shutting down
   */
  destroy() {
    this.stopQueueProcessing();
    
    // End all active matches
    for (const matchId of this.activeMatches.keys()) {
      this.endMatch(matchId);
    }
    
    // Clear all data structures
    this.waitingQueue.clear();
    this.playerMatches.clear();
    this.activeMatches.clear();
    
    console.log('MatchManager destroyed');
  }
}

module.exports = MatchManager;