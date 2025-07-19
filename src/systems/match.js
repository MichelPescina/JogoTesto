/**
 * Match Instance for JogoTesto Battle Royale System
 * Represents an individual match with isolated world and player management
 */

const RoomSystem = require('./roomSystem');

/**
 * Match class represents an individual battle royale match instance
 */
class Match {
  /**
   * Initialize a new match instance
   * @param {string} matchId - Unique match identifier
   * @param {Array<Object>} players - Array of player objects to add to match
   */
  constructor(matchId, players) {
    /** @type {string} Unique match identifier */
    this.matchId = matchId;
    
    /** @type {Map<string, Object>} Map of playerID to player data */
    this.players = new Map();
    
    /** @type {Map<string, Object>} Map of playerID to socket connection */
    this.connectedSockets = new Map();
    
    /** @type {RoomSystem} Isolated room system for this match */
    this.roomSystem = new RoomSystem();
    
    /** @type {string} Match status: 'starting', 'active', 'finished' */
    this.status = 'starting';
    
    /** @type {number} Timestamp when match was created */
    this.createdAt = Date.now();
    
    /** @type {number} Timestamp when match started (becomes active) */
    this.startedAt = null;
    
    /** @type {number} Timestamp when match ended */
    this.endedAt = null;
    
    /** @type {number} Maximum match duration in milliseconds (30 minutes) */
    this.maxDuration = 30 * 60 * 1000;
    
    /** @type {NodeJS.Timeout} Match timeout timer */
    this.matchTimer = null;
    
    // Initialize players
    players.forEach(player => {
      this.players.set(player.playerID, {
        playerID: player.playerID,
        username: player.username,
        status: 'active', // active, forfeited, disconnected, eliminated
        joinedAt: Date.now(),
        currentRoom: null,
        lastActivity: Date.now(),
        score: 0
      });
    });
    
    console.log(`Match ${this.matchId} created with ${this.players.size} players`);
    
    // Initialize the match world
    this.initializeWorld();
  }

  /**
   * Initialize the match world by loading room data
   * @returns {Promise<boolean>} True if world loaded successfully
   */
  async initializeWorld() {
    try {
      console.log(`Initializing world for match ${this.matchId}...`);
      
      // Load rooms from JSON (could be match-specific in the future)
      const roomsLoaded = await this.roomSystem.loadRoomsFromJSON('data/rooms.json');
      
      if (!roomsLoaded) {
        console.error(`Failed to load room data for match ${this.matchId}`);
        this.status = 'failed';
        return false;
      }
      
      // Add all players to the room system
      for (const [playerID, playerData] of this.players) {
        this.roomSystem.addPlayer(playerID);
        playerData.currentRoom = this.roomSystem.defaultRoom;
      }
      
      // Mark match as active
      this.status = 'active';
      this.startedAt = Date.now();
      
      // Start match duration timer
      this.startMatchTimer();
      
      console.log(`Match ${this.matchId} is now active with world loaded`);
      
      // Notify all connected players that match has started
      this.broadcast('matchStarted', {
        matchId: this.matchId,
        playerCount: this.players.size,
        startedAt: this.startedAt
      });
      
      return true;
      
    } catch (error) {
      console.error(`Error initializing world for match ${this.matchId}:`, error);
      this.status = 'failed';
      return false;
    }
  }

  /**
   * Add a socket connection for a player
   * @param {string} playerID - Player identifier
   * @param {Object} socket - Socket.IO socket object
   * @returns {boolean} True if player was added successfully
   */
  addPlayerSocket(playerID, socket) {
    const player = this.players.get(playerID);
    if (!player) {
      console.error(`Cannot add socket for unknown player ${playerID} in match ${this.matchId}`);
      return false;
    }
    
    // Store socket connection
    this.connectedSockets.set(playerID, socket);
    
    // Join socket to match-specific room
    socket.join(this.matchId);
    
    // Update player status
    player.status = 'active';
    player.lastActivity = Date.now();
    
    console.log(`Player ${playerID} (${player.username}) connected to match ${this.matchId}`);
    
    // Send match state to the connecting player
    this.sendMatchState(playerID);
    
    // Send initial room description if world is loaded
    if (this.status === 'active' && this.roomSystem.isLoaded) {
      this.sendRoomDescription(playerID);
    }
    
    // Notify other players about the connection
    this.broadcast('playerConnected', {
      playerID: playerID,
      username: player.username,
      message: `${player.username} has joined the match`
    }, [playerID]);
    
    return true;
  }

  /**
   * Remove a player from the match (disconnect, not forfeit)
   * @param {string} playerID - Player identifier
   * @returns {boolean} True if player was removed
   */
  removePlayerSocket(playerID) {
    const player = this.players.get(playerID);
    if (!player) {
      return false;
    }
    
    // Remove socket connection
    const socket = this.connectedSockets.get(playerID);
    if (socket) {
      socket.leave(this.matchId);
      this.connectedSockets.delete(playerID);
    }
    
    // Update player status to disconnected (not forfeited)
    player.status = 'disconnected';
    
    console.log(`Player ${playerID} (${player.username}) disconnected from match ${this.matchId}`);
    
    // Notify other players about the disconnection
    this.broadcast('playerDisconnected', {
      playerID: playerID,
      username: player.username,
      message: `${player.username} has disconnected`
    }, [playerID]);
    
    return true;
  }

  /**
   * Handle player forfeit (voluntary leaving)
   * @param {string} playerID - Player identifier
   * @returns {boolean} True if player forfeited successfully
   */
  handlePlayerForfeit(playerID) {
    const player = this.players.get(playerID);
    if (!player) {
      return false;
    }
    
    // Update player status
    player.status = 'forfeited';
    
    // Remove from room system
    this.roomSystem.removePlayer(playerID);
    
    // Remove socket connection
    const socket = this.connectedSockets.get(playerID);
    if (socket) {
      socket.leave(this.matchId);
      this.connectedSockets.delete(playerID);
      
      // Notify the forfeiting player
      socket.emit('matchForfeited', {
        message: 'You have forfeited the match',
        canRejoin: false
      });
    }
    
    console.log(`Player ${playerID} (${player.username}) forfeited match ${this.matchId}`);
    
    // Notify other players about the forfeit
    this.broadcast('gameMasterMessage', {
      text: `${player.username} has forfeited the match.`,
      timestamp: new Date().toISOString(),
      type: 'forfeit'
    }, [playerID]);
    
    // Check if match should end (not enough active players)
    this.checkMatchEnd();
    
    return true;
  }

  /**
   * Handle player movement within the match
   * @param {string} playerID - Player identifier
   * @param {string} direction - Movement direction
   * @returns {Object} Movement result
   */
  handlePlayerMovement(playerID, direction) {
    const player = this.players.get(playerID);
    if (!player || player.status !== 'active') {
      return {
        success: false,
        error: 'Player not active in match'
      };
    }
    
    if (!this.roomSystem.isLoaded) {
      return {
        success: false,
        error: 'Match world is still loading'
      };
    }
    
    // Use room system to handle movement
    const moveResult = this.roomSystem.movePlayer(playerID, direction);
    
    if (moveResult.success) {
      // Update player's current room
      player.currentRoom = moveResult.toRoom;
      player.lastActivity = Date.now();
      
      // Notify players in both rooms about the movement
      this.notifyRoomMovement(playerID, moveResult);
    }
    
    return moveResult;
  }

  /**
   * Handle chat message within the match
   * @param {string} playerID - Player identifier
   * @param {string} message - Chat message
   * @returns {boolean} True if message was handled successfully
   */
  handleChatMessage(playerID, message) {
    const player = this.players.get(playerID);
    if (!player || player.status !== 'active') {
      return false;
    }
    
    const socket = this.connectedSockets.get(playerID);
    if (!socket) {
      return false;
    }
    
    // Get current room and players in room
    const currentRoom = this.roomSystem.getPlayerRoom(playerID);
    if (!currentRoom) {
      socket.emit('gameMasterMessage', {
        text: 'You seem to be lost in the void. Cannot send message.',
        timestamp: new Date().toISOString()
      });
      return false;
    }
    
    const playersInRoom = this.roomSystem.getPlayersInRoom(currentRoom);
    const otherPlayersInRoom = playersInRoom.filter(id => id !== playerID);
    
    if (otherPlayersInRoom.length === 0) {
      socket.emit('gameMasterMessage', {
        text: 'You speak to the empty air, but no one is here to listen.',
        timestamp: new Date().toISOString()
      });
      return false;
    }
    
    // Send message to all players in the room
    const chatData = {
      playerID: playerID,
      username: player.username,
      message: message.trim(),
      roomId: currentRoom,
      timestamp: new Date().toISOString()
    };
    
    // Send to all players in room
    playersInRoom.forEach(id => {
      const playerSocket = this.connectedSockets.get(id);
      if (playerSocket) {
        if (id === playerID) {
          playerSocket.emit('roomChatMessage', {
            ...chatData,
            text: `You say: \"${chatData.message}\"`,
            isSelf: true
          });
        } else {
          playerSocket.emit('roomChatMessage', {
            ...chatData,
            text: `${player.username} says: \"${chatData.message}\"`,
            isSelf: false
          });
        }
      }
    });
    
    player.lastActivity = Date.now();
    return true;
  }

  /**
   * Send current match state to a player
   * @param {string} playerID - Player identifier
   */
  sendMatchState(playerID) {
    const socket = this.connectedSockets.get(playerID);
    const player = this.players.get(playerID);
    
    if (!socket || !player) {
      return;
    }
    
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status === 'active')
      .map(p => ({
        playerID: p.playerID,
        username: p.username,
        currentRoom: p.currentRoom
      }));
    
    socket.emit('matchState', {
      matchId: this.matchId,
      status: this.status,
      playerCount: this.players.size,
      activePlayers: activePlayers.length,
      players: activePlayers,
      startedAt: this.startedAt,
      playerStatus: player.status,
      currentRoom: player.currentRoom
    });
  }

  /**
   * Send room description to a player
   * @param {string} playerID - Player identifier
   */
  sendRoomDescription(playerID) {
    const socket = this.connectedSockets.get(playerID);
    if (!socket) {
      return;
    }
    
    const currentRoom = this.roomSystem.getPlayerRoom(playerID);
    if (!currentRoom) {
      return;
    }
    
    // Create connected players map for room description
    const connectedPlayersMap = new Map();
    for (const [pid, player] of this.players) {
      if (this.connectedSockets.has(pid)) {
        connectedPlayersMap.set(pid, { name: player.username });
      }
    }
    
    const roomDescription = this.roomSystem.getRoomDescription(
      currentRoom,
      playerID,
      connectedPlayersMap
    );
    
    if (roomDescription) {
      socket.emit('gameMasterMessage', {
        text: `${roomDescription.name}\n\n${roomDescription.description}`,
        timestamp: new Date().toISOString(),
        type: 'room_description'
      });
    }
  }

  /**
   * Notify players about movement between rooms
   * @param {string} playerID - Player who moved
   * @param {Object} moveResult - Movement result from room system
   * @private
   */
  notifyRoomMovement(playerID, moveResult) {
    const player = this.players.get(playerID);
    if (!player) return;
    
    const socket = this.connectedSockets.get(playerID);
    
    // Notify players in the departure room
    const playersInOldRoom = this.roomSystem.getPlayersInRoom(moveResult.fromRoom);
    playersInOldRoom.forEach(id => {
      if (id !== playerID) {
        const playerSocket = this.connectedSockets.get(id);
        if (playerSocket) {
          playerSocket.emit('gameMasterMessage', {
            text: `${player.username} heads ${moveResult.direction}.`,
            timestamp: new Date().toISOString(),
            type: 'movement'
          });
        }
      }
    });
    
    // Send movement description to the moving player
    if (socket) {
      socket.emit('gameMasterMessage', {
        text: moveResult.exitDescription,
        timestamp: new Date().toISOString(),
        type: 'movement'
      });
      
      // Send new room description
      this.sendRoomDescription(playerID);
    }
    
    // Notify players in the arrival room
    const playersInNewRoom = this.roomSystem.getPlayersInRoom(moveResult.toRoom);
    playersInNewRoom.forEach(id => {
      if (id !== playerID) {
        const playerSocket = this.connectedSockets.get(id);
        if (playerSocket) {
          const oppositeDirection = this.getOppositeDirection(moveResult.direction);
          playerSocket.emit('gameMasterMessage', {
            text: `${player.username} arrives from the ${oppositeDirection}.`,
            timestamp: new Date().toISOString(),
            type: 'movement'
          });
        }
      }
    });
  }

  /**
   * Get opposite direction for arrival messages
   * @param {string} direction - Original direction
   * @returns {string} Opposite direction
   * @private
   */
  getOppositeDirection(direction) {
    const opposites = {
      'north': 'south', 'south': 'north',
      'east': 'west', 'west': 'east',
      'up': 'down', 'down': 'up',
      'northeast': 'southwest', 'northwest': 'southeast',
      'southeast': 'northwest', 'southwest': 'northeast'
    };
    return opposites[direction.toLowerCase()] || direction;
  }

  /**
   * Broadcast a message to all or specific players in the match
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   * @param {Array<string>} excludePlayers - Player IDs to exclude from broadcast
   */
  broadcast(event, data, excludePlayers = []) {
    for (const [playerID, socket] of this.connectedSockets) {
      if (!excludePlayers.includes(playerID)) {
        socket.emit(event, data);
      }
    }
  }

  /**
   * Start match duration timer
   * @private
   */
  startMatchTimer() {
    this.matchTimer = setTimeout(() => {
      console.log(`Match ${this.matchId} has reached maximum duration`);
      this.endMatch('timeout');
    }, this.maxDuration);
  }

  /**
   * Check if match should end due to insufficient players
   * @private
   */
  checkMatchEnd() {
    const activePlayers = Array.from(this.players.values())
      .filter(p => p.status === 'active').length;
    
    if (activePlayers <= 1 && this.status === 'active') {
      console.log(`Match ${this.matchId} ending due to insufficient players`);
      this.endMatch('insufficient_players');
    }
  }

  /**
   * End the match
   * @param {string} reason - Reason for ending the match
   */
  endMatch(reason = 'completed') {
    if (this.status === 'finished') {
      return; // Already ended
    }
    
    this.status = 'finished';
    this.endedAt = Date.now();
    
    // Clear match timer
    if (this.matchTimer) {
      clearTimeout(this.matchTimer);
      this.matchTimer = null;
    }
    
    console.log(`Match ${this.matchId} ended. Reason: ${reason}`);
    
    // Notify all connected players
    this.broadcast('matchEnded', {
      matchId: this.matchId,
      reason: reason,
      duration: this.endedAt - this.startedAt,
      endedAt: this.endedAt
    });
    
    // Remove all players from match-specific room
    for (const socket of this.connectedSockets.values()) {
      socket.leave(this.matchId);
    }
  }

  /**
   * Get match statistics
   * @returns {Object} Match statistics
   */
  getStats() {
    const playerStatusCounts = {};
    for (const player of this.players.values()) {
      playerStatusCounts[player.status] = (playerStatusCounts[player.status] || 0) + 1;
    }
    
    return {
      matchId: this.matchId,
      status: this.status,
      totalPlayers: this.players.size,
      connectedPlayers: this.connectedSockets.size,
      playerStatusCounts,
      duration: this.status === 'finished' 
        ? (this.endedAt - this.startedAt) 
        : (Date.now() - (this.startedAt || this.createdAt)),
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      endedAt: this.endedAt
    };
  }

  /**
   * Cleanup match resources
   */
  destroy() {
    // Clear timers
    if (this.matchTimer) {
      clearTimeout(this.matchTimer);
      this.matchTimer = null;
    }
    
    // Disconnect all sockets
    for (const socket of this.connectedSockets.values()) {
      socket.leave(this.matchId);
    }
    
    // Clear data structures
    this.players.clear();
    this.connectedSockets.clear();
    
    // Cleanup room system
    if (this.roomSystem) {
      // RoomSystem doesn't have a destroy method, but we can clear its state
      this.roomSystem = null;
    }
    
    console.log(`Match ${this.matchId} resources cleaned up`);
  }
}

module.exports = Match;