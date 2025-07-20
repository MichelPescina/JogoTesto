/**
 * Match - Individual match management for JogoTesto Battle Royale
 * Manages match lifecycle, countdown timers, and isolated game worlds
 */

const RoomSystem = require('./roomSystem');
const { generateCountdownId } = require('../utils/idGenerator');

/**
 * Match class manages individual match state and players
 */
class Match {
  /**
   * Initialize a new match
   * @param {string} matchId - Unique match identifier
   */
  constructor(matchId) {
    /** @type {string} Unique match identifier */
    this.id = matchId;
    
    /** @type {Map<string, Object>} Map of player ID to player data */
    this.players = new Map();
    
    /** @type {RoomSystem} Isolated room system for this match */
    this.roomSystem = new RoomSystem();
    
    /** @type {string} Current match state */
    this.state = 'waiting'; // waiting -> countdown -> active -> finished
    
    /** @type {NodeJS.Timeout|null} Countdown timer reference */
    this.countdown = null;
    
    /** @type {string|null} Current countdown ID */
    this.countdownId = null;
    
    /** @type {number} Maximum players allowed */
    this.maxPlayers = 50;
    
    /** @type {number} Minimum players needed to start countdown */
    this.minPlayers = 10;
    
    /** @type {number} Countdown duration in seconds */
    this.countdownDuration = 60;
    
    /** @type {number} Current countdown time left */
    this.timeLeft = 0;
    
    /** @type {Date} When the match was created */
    this.createdAt = new Date();
    
    /** @type {Date|null} When the match started */
    this.startedAt = null;
    
    /** @type {Date|null} When the match finished */
    this.finishedAt = null;
    
    // Initialize room system for this match
    this.initializeRoomSystem();
  }

  /**
   * Initialize the isolated room system for this match
   * @private
   */
  async initializeRoomSystem() {
    try {
      const roomsLoaded = await this.roomSystem.loadRoomsFromJSON('data/rooms.json');
      if (!roomsLoaded) {
        console.error(`Failed to load rooms for match ${this.id}`);
      } else {
        console.log(`Room system initialized for match ${this.id}`);
      }
    } catch (error) {
      console.error(`Error initializing room system for match ${this.id}:`, error);
    }
  }

  /**
   * Add a player to this match
   * @param {string} playerId - Player identifier
   * @param {string} playerName - Player display name
   * @returns {Object} Addition result
   */
  addPlayer(playerId, playerName) {
    try {
      // Validate inputs
      if (!playerId || !playerName) {
        return {
          success: false,
          error: 'Invalid player ID or name'
        };
      }

      // Check if match is full
      if (this.players.size >= this.maxPlayers) {
        return {
          success: false,
          error: 'Match is full'
        };
      }

      // Check if match has already started
      if (this.state === 'active' || this.state === 'finished') {
        return {
          success: false,
          error: 'Match has already started'
        };
      }

      // Check if player already exists in match
      if (this.players.has(playerId)) {
        return {
          success: true,
          action: 'already_in_match'
        };
      }

      // Add player to match
      const playerData = {
        id: playerId,
        name: playerName.trim(),
        joinedAt: new Date(),
        isConnected: true,
        lastActivity: new Date()
      };

      this.players.set(playerId, playerData);

      // Add player to room system if loaded
      if (this.roomSystem.isLoaded) {
        this.roomSystem.addPlayer(playerId);
      }

      console.log(`Player ${playerId} (${playerName}) added to match ${this.id}`);

      // Check if we should start countdown
      if (this.players.size >= this.minPlayers && this.state === 'waiting') {
        this.startCountdown();
      }

      return {
        success: true,
        action: 'added',
        playerCount: this.players.size
      };

    } catch (error) {
      console.error(`Error adding player to match ${this.id}:`, error);
      return {
        success: false,
        error: 'Failed to add player to match'
      };
    }
  }

  /**
   * Remove a player from this match
   * @param {string} playerId - Player identifier
   * @returns {Object} Removal result
   */
  removePlayer(playerId) {
    try {
      if (!this.players.has(playerId)) {
        return {
          success: false,
          error: 'Player not in match'
        };
      }

      const playerData = this.players.get(playerId);
      
      // Remove from room system
      if (this.roomSystem.isLoaded) {
        this.roomSystem.removePlayer(playerId);
      }

      // Remove from players map
      this.players.delete(playerId);

      console.log(`Player ${playerId} removed from match ${this.id}`);

      // Check if match should be cancelled due to insufficient players
      if (this.players.size < this.minPlayers && this.state === 'countdown') {
        this.cancelCountdown();
      }

      return {
        success: true,
        action: 'removed',
        playerCount: this.players.size
      };

    } catch (error) {
      console.error(`Error removing player from match ${this.id}:`, error);
      return {
        success: false,
        error: 'Failed to remove player from match'
      };
    }
  }

  /**
   * Reconnect a player to this match
   * @param {string} playerId - Player identifier
   * @param {Object} socket - Socket.IO socket object
   * @returns {Object} Reconnection result
   */
  reconnectPlayer(playerId, socket) {
    try {
      if (!this.players.has(playerId)) {
        return {
          success: false,
          error: 'Player not in match'
        };
      }

      const playerData = this.players.get(playerId);
      playerData.isConnected = true;
      playerData.lastActivity = new Date();

      console.log(`Player ${playerId} reconnected to match ${this.id}`);

      return {
        success: true,
        action: 'reconnected',
        state: this.state,
        timeLeft: this.timeLeft
      };

    } catch (error) {
      console.error(`Error reconnecting player to match ${this.id}:`, error);
      return {
        success: false,
        error: 'Failed to reconnect player'
      };
    }
  }

  /**
   * Start the countdown timer for match start
   */
  startCountdown() {
    if (this.players.size < this.minPlayers) {
      console.log(`Cannot start countdown for match ${this.id}: insufficient players`);
      return;
    }

    if (this.state !== 'waiting') {
      console.log(`Cannot start countdown for match ${this.id}: wrong state ${this.state}`);
      return;
    }

    this.state = 'countdown';
    this.timeLeft = this.countdownDuration;
    this.countdownId = generateCountdownId();

    console.log(`Starting countdown for match ${this.id}`);

    // Note: The actual timer will be managed by the match handler
    // which has access to the Socket.IO instance for broadcasting
  }

  /**
   * Cancel the countdown timer
   */
  cancelCountdown() {
    if (this.state !== 'countdown') {
      return;
    }

    this.state = 'waiting';
    this.timeLeft = 0;
    this.countdownId = null;

    console.log(`Countdown cancelled for match ${this.id}`);
  }

  /**
   * Start the actual match gameplay
   */
  startMatch() {
    if (this.state !== 'countdown') {
      console.error(`Cannot start match ${this.id}: wrong state ${this.state}`);
      return;
    }

    this.state = 'active';
    this.startedAt = new Date();
    this.timeLeft = 0;
    this.countdownId = null;

    console.log(`Match ${this.id} started with ${this.players.size} players`);
  }

  /**
   * Finish the match
   * @param {string} reason - Reason for finishing
   */
  finishMatch(reason = 'completed') {
    if (this.state === 'finished') {
      return;
    }

    this.state = 'finished';
    this.finishedAt = new Date();

    // Clean up countdown if still running
    if (this.countdown) {
      clearInterval(this.countdown);
      this.countdown = null;
    }

    console.log(`Match ${this.id} finished: ${reason}`);
  }

  /**
   * Update countdown timer (called by match handler)
   * @param {number} newTimeLeft - New time left in seconds
   */
  updateCountdown(newTimeLeft) {
    this.timeLeft = Math.max(0, newTimeLeft);
    
    if (this.timeLeft <= 0 && this.state === 'countdown') {
      this.startMatch();
    }
  }

  /**
   * Get player data by ID
   * @param {string} playerId - Player identifier
   * @returns {Object|null} Player data or null if not found
   */
  getPlayer(playerId) {
    return this.players.get(playerId) || null;
  }

  /**
   * Get all connected players in this match
   * @returns {Array<Object>} Array of connected player data
   */
  getConnectedPlayers() {
    const connectedPlayers = [];
    for (const [playerId, playerData] of this.players) {
      if (playerData.isConnected) {
        connectedPlayers.push(playerData);
      }
    }
    return connectedPlayers;
  }

  /**
   * Check if player can move in room system
   * @param {string} playerId - Player identifier
   * @param {string} direction - Movement direction
   * @returns {boolean} True if movement is allowed
   */
  canPlayerMove(playerId, direction) {
    if (!this.roomSystem.isLoaded || this.state !== 'active') {
      return false;
    }
    
    return this.roomSystem.canMove(playerId, direction);
  }

  /**
   * Move player in room system
   * @param {string} playerId - Player identifier
   * @param {string} direction - Movement direction
   * @returns {Object} Movement result
   */
  movePlayer(playerId, direction) {
    if (!this.roomSystem.isLoaded) {
      return {
        success: false,
        error: 'Room system not loaded'
      };
    }

    if (this.state !== 'active') {
      return {
        success: false,
        error: 'Match not active'
      };
    }

    return this.roomSystem.movePlayer(playerId, direction);
  }

  /**
   * Get room description for player
   * @param {string} playerId - Player identifier
   * @returns {Object|null} Room description or null
   */
  getRoomDescription(playerId) {
    if (!this.roomSystem.isLoaded) {
      return null;
    }

    const playerRoom = this.roomSystem.getPlayerRoom(playerId);
    if (!playerRoom) {
      return null;
    }

    return this.roomSystem.getRoomDescription(playerRoom, playerId, this.players);
  }

  /**
   * Clean up match resources
   */
  cleanup() {
    // Clear countdown timer
    if (this.countdown) {
      clearInterval(this.countdown);
      this.countdown = null;
    }

    // Clear all players from room system
    for (const playerId of this.players.keys()) {
      if (this.roomSystem.isLoaded) {
        this.roomSystem.removePlayer(playerId);
      }
    }

    console.log(`Match ${this.id} cleaned up`);
  }

  /**
   * Get match statistics
   * @returns {Object} Match statistics
   */
  getStats() {
    const duration = this.startedAt ? 
      (this.finishedAt || new Date()) - this.startedAt : 0;

    return {
      id: this.id,
      state: this.state,
      playerCount: this.players.size,
      connectedCount: this.getConnectedPlayers().length,
      timeLeft: this.timeLeft,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      duration: duration,
      roomSystemLoaded: this.roomSystem.isLoaded
    };
  }
}

module.exports = Match;