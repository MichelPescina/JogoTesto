const GameEngine = require('./GameEngine');
const Player = require('./Player');
const { MATCH_STATUS, GAME_CONFIG } = require('../utils/constants');

/**
 * MatchManager handles match lifecycle, player queuing, and game state transitions
 */
class MatchManager {
  constructor() {
    this.currentMatch = null;
    this.gameEngine = null;
    this.playerQueue = []; // Players waiting for next match
    this.matchHistory = [];

    this.initializeNewMatch();
  }

  /**
   * Initializes a new match instance
   */
  initializeNewMatch() {
    this.currentMatch = {
      id: this.generateMatchId(),
      status: MATCH_STATUS.WAITING,
      //// MEJORA: USAR UN SISTEMA BASADO EN SESIONES, SOCKET.ID ES VOLATIL
      players: new Map(), // socketId -> Player
      startTime: null,
      endTime: null,
      winner: null,
      maxPlayers: GAME_CONFIG.MAX_PLAYERS,
      minPlayersToStart: GAME_CONFIG.MIN_PLAYERS_TO_START
    };

    this.gameEngine = new GameEngine();
    console.log(`New match initialized: ${this.currentMatch.id}`);
  }

  /**
   * Generates a unique match ID
   * @returns {string} Match ID
   */
  generateMatchId() {
    //// MEJORA: USAR UUIDs de node:crypto
    return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Attempts to add a player to the current match
   * @param {string} socketId - Socket ID
   * @param {string} playerName - Player name
   * @returns {Object} Join result
   */
  joinMatch(socketId, playerName) {
    // Validate player name
    if (!Player.isValidName(playerName)) {
      return {
        success: false,
        error: 'Invalid player name. Name must be 1-20 characters, letters and numbers only.'
      };
    }

    // Check if match is already full
    if (this.currentMatch.players.size >= this.currentMatch.maxPlayers) {
      return {
        success: false,
        error: 'Match is full. Please wait for the next match.',
        code: 'MATCH_FULL'
      };
    }

    // Check if match has already started
    if (this.currentMatch.status !== MATCH_STATUS.WAITING) {
      return {
        success: false,
        error: 'Match already started. Please wait until the match finishes.',
        code: 'MATCH_STARTED'
      };
    }

    // Check if player name is already taken
    for (const existingPlayer of this.currentMatch.players.values()) {
      if (existingPlayer.name === playerName) {
        return {
          success: false,
          error: 'Player name already taken. Please choose a different name.'
        };
      }
    }

    // Check if socket is already connected
    if (this.currentMatch.players.has(socketId)) {
      return {
        success: false,
        error: 'You are already in this match.'
      };
    }

    try {
      // Create new player
      const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const player = new Player(playerId, playerName, socketId);

      // Add to match
      this.currentMatch.players.set(socketId, player);

      // Add to game engine
      this.gameEngine.addPlayer(player);

      console.log(`Player ${playerName} joined match ${this.currentMatch.id} (${this.currentMatch.players.size}/${this.currentMatch.maxPlayers})`);

      // Check if we can start the match
      const shouldStart = this.currentMatch.players.size >= this.currentMatch.minPlayersToStart;
      //// MEJORA: AÑADIR CODIGO PARA QUE UNA VEZ SE OBTENGA EL MINIMO DE JUGADORES COMIENCE CUENTA REGRESIVA

      return {
        success: true,
        player: player.toClientData(true),
        match: this.getMatchInfo(),
        shouldStart: shouldStart,
        waitingForPlayers: this.currentMatch.minPlayersToStart - this.currentMatch.players.size
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to join match: ' + error.message
      };
    }
  }

  /**
   * Starts the current match if conditions are met
   * @returns {Object} Start result
   */
  startMatch() {
    if (this.currentMatch.status !== MATCH_STATUS.WAITING) {
      return {
        success: false,
        error: 'Match cannot be started'
      };
    }

    if (this.currentMatch.players.size < this.currentMatch.minPlayersToStart) {
      return {
        success: false,
        error: `Need at least ${this.currentMatch.minPlayersToStart} players to start`
      };
    }

    try {
      this.currentMatch.status = MATCH_STATUS.ACTIVE;
      this.currentMatch.startTime = new Date();

      console.log(`Match ${this.currentMatch.id} started with ${this.currentMatch.players.size} players`);

      return {
        success: true,
        match: this.getMatchInfo(),
        players: Array.from(this.currentMatch.players.values()).map(p => p.toClientData())
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to start match: ' + error.message
      };
    }
  }

  /**
   * Handles player disconnection
   * @param {string} socketId - Disconnected socket ID
   */
  handlePlayerDisconnection(socketId) {
    const player = this.currentMatch.players.get(socketId);
    if (!player) {
      return; // Player not in current match
    }

    console.log(`Player ${player.name} disconnected from match ${this.currentMatch.id}`);

    // Remove from game engine
    this.gameEngine.handlePlayerDisconnection(player.id);

    // Remove from match
    this.currentMatch.players.delete(socketId);

    // Check if match should end due to insufficient players
    this.checkMatchCompletion();
  }

  /**
   * Checks if the match is complete and handles end game logic
   */
  checkMatchCompletion() {
    if (this.currentMatch.status !== MATCH_STATUS.ACTIVE) {
      return;
    }

    const alivePlayers = this.gameEngine.getAlivePlayers();

    // Match ends when only one player remains or no players left
    if (alivePlayers.length <= 1) {
      this.endMatch(alivePlayers[0] || null);
    }
  }

  /**
   * Ends the current match
   * @param {Player|null} winner - Winning player or null if no winner
   */
  endMatch(winner) {
    if (this.currentMatch.status === MATCH_STATUS.FINISHED) {
      return; // Already ended
    }

    this.currentMatch.status = MATCH_STATUS.FINISHED;
    this.currentMatch.endTime = new Date();
    this.currentMatch.winner = winner;

    const matchDuration = this.currentMatch.endTime - this.currentMatch.startTime;

    console.log(`Match ${this.currentMatch.id} ended. Winner: ${winner ? winner.name : 'None'}, Duration: ${matchDuration}ms`);

    // Add to match history
    this.matchHistory.push({
      id: this.currentMatch.id,
      winner: winner ? winner.name : null,
      playerCount: this.currentMatch.players.size,
      duration: matchDuration,
      endTime: this.currentMatch.endTime
    });

    // Schedule cleanup and new match creation
    setTimeout(() => {
      this.cleanupAndCreateNewMatch();
    }, 5000); // 5 second delay before cleanup
  }

  /**
   * Cleans up current match and creates a new one
   */
  cleanupAndCreateNewMatch() {
    console.log(`Cleaning up match ${this.currentMatch.id} and creating new match`);

    // Clear current match data
    this.currentMatch = null;
    this.gameEngine = null;

    // Initialize new match
    this.initializeNewMatch();
  }

  /**
   * Gets current match information
   * @returns {Object} Match information
   */
  getMatchInfo() {
    return {
      id: this.currentMatch.id,
      status: this.currentMatch.status,
      playerCount: this.currentMatch.players.size,
      maxPlayers: this.currentMatch.maxPlayers,
      minPlayersToStart: this.currentMatch.minPlayersToStart,
      startTime: this.currentMatch.startTime,
      endTime: this.currentMatch.endTime,
      winner: this.currentMatch.winner ? this.currentMatch.winner.name : null,
      gameState: this.gameEngine ? this.gameEngine.getGameState() : null
    };
  }

  /**
   * Gets a player by socket ID
   * @param {string} socketId - Socket ID
   * @returns {Player|null} Player instance or null
   */
  getPlayerBySocket(socketId) {
    return this.currentMatch.players.get(socketId) || null;
  }

  /**
   * Gets all players in the current match
   * @returns {Array<Player>} Array of players
   */
  getAllPlayers() {
    return Array.from(this.currentMatch.players.values());
  }

  /**
   * Processes player move
   * @param {string} socketId - Player socket ID
   * @param {string} direction - Movement direction
   * @returns {Object} Move result
   */
  processPlayerMove(socketId, direction) {
    const player = this.getPlayerBySocket(socketId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (this.currentMatch.status !== MATCH_STATUS.ACTIVE) {
      return { success: false, error: 'Match is not active' };
    }

    const result = this.gameEngine.movePlayer(player.id, direction);

    // Check for match completion after move
    if (result.success) {
      this.checkMatchCompletion();
    }

    return result;
  }

  /**
   * Processes weapon search
   * @param {string} socketId - Player socket ID
   * @returns {Object} Search result
   */
  processWeaponSearch(socketId) {
    const player = this.getPlayerBySocket(socketId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (this.currentMatch.status !== MATCH_STATUS.ACTIVE) {
      return { success: false, error: 'Match is not active' };
    }

    const result = this.gameEngine.startWeaponSearch(player.id);

    // Auto-complete search after duration
    if (result.success) {
      setTimeout(() => {
        this.gameEngine.completeWeaponSearch(player.id);
        // Emit completion event through socket handlers
      }, GAME_CONFIG.WEAPON_SEARCH_DURATION);
    }

    return result;
  }

  /**
   * Processes combat initiation
   * @param {string} attackerSocketId - Attacker socket ID
   * @param {string} defenderSocketId - Defender socket ID
   * @returns {Object} Combat result
   */
  processCombat(attackerSocketId, defenderSocketId) {
    const attacker = this.getPlayerBySocket(attackerSocketId);
    const defender = this.getPlayerBySocket(defenderSocketId);

    if (!attacker || !defender) {
      return { success: false, error: 'Players not found' };
    }

    if (this.currentMatch.status !== MATCH_STATUS.ACTIVE) {
      return { success: false, error: 'Match is not active' };
    }

    const result = this.gameEngine.resolveCombat(attacker.id, defender.id);

    // Check for match completion after combat
    if (result.success) {
      this.checkMatchCompletion();
    }

    return result;
  }

  /**
   * Processes escape attempt
   * @param {string} socketId - Player socket ID
   * @returns {Object} Escape result
   */
  processEscape(socketId) {
    const player = this.getPlayerBySocket(socketId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (this.currentMatch.status !== MATCH_STATUS.ACTIVE) {
      return { success: false, error: 'Match is not active' };
    }

    const result = this.gameEngine.handleEscape(player.id);

    // Check for match completion after escape
    if (result.success && result.died) {
      this.checkMatchCompletion();
    }

    return result;
  }

  /**
   * Gets match statistics
   * @returns {Object} Match statistics
   */
  getMatchStats() {
    return {
      current: this.getMatchInfo(),
      history: this.matchHistory.slice(-10), // Last 10 matches
      totalMatches: this.matchHistory.length
    };
  }
}

module.exports = MatchManager;