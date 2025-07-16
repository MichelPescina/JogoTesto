/**
 * Room Management System for JogoTesto
 * Handles room navigation, player location tracking, and room-based interactions
 */

const fs = require('fs');
const path = require('path');

/**
 * RoomSystem class manages the game world, player locations, and room interactions
 */
class RoomSystem {
  /**
   * Initialize the room system
   */
  constructor() {
    /** @type {Map<string, Object>} Map of room ID to room data */
    this.rooms = new Map();
    
    /** @type {Map<string, string>} Map of player ID to current room ID */
    this.playerRooms = new Map();
    
    /** @type {boolean} Whether the room system has been successfully loaded */
    this.isLoaded = false;
    
    /** @type {string} Default starting room for new players */
    this.defaultRoom = 'forest_clearing';
  }

  /**
   * Load rooms from JSON file with validation
   * @param {string} filename - Path to the rooms JSON file
   * @returns {Promise<boolean>} True if loading succeeded, false otherwise
   */
  async loadRoomsFromJSON(filename) {
    try {
      console.log(`Loading rooms from ${filename}...`);
      
      // Read and parse JSON file
      const fullPath = path.resolve(filename);
      const roomData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      
      // Validate basic structure
      if (!roomData.rooms || typeof roomData.rooms !== 'object') {
        throw new Error('Invalid room data structure: missing rooms object');
      }
      
      // First pass: Load all rooms
      this.rooms.clear();
      const roomIds = Object.keys(roomData.rooms);
      
      for (const roomId of roomIds) {
        const room = roomData.rooms[roomId];
        
        // Validate required room fields
        if (!this._validateRoomStructure(room)) {
          throw new Error(`Invalid room structure for room: ${roomId}`);
        }
        
        this.rooms.set(roomId, room);
      }
      
      // Second pass: Validate all exit destinations exist
      for (const [roomId, room] of this.rooms) {
        if (room.exits) {
          for (const [direction, exit] of Object.entries(room.exits)) {
            if (!this.rooms.has(exit.destination)) {
              throw new Error(`Room ${roomId} has exit ${direction} pointing to non-existent room: ${exit.destination}`);
            }
          }
        }
      }
      
      // Validate default room exists
      if (!this.rooms.has(this.defaultRoom)) {
        throw new Error(`Default room ${this.defaultRoom} not found in room data`);
      }
      
      this.isLoaded = true;
      console.log(`Successfully loaded ${this.rooms.size} rooms`);
      return true;
      
    } catch (error) {
      console.error('Failed to load rooms:', error.message);
      this.isLoaded = false;
      return false;
    }
  }

  /**
   * Validate room structure has required fields
   * @param {Object} room - Room object to validate
   * @returns {boolean} True if room structure is valid
   * @private
   */
  _validateRoomStructure(room) {
    const requiredFields = ['id', 'name', 'description'];
    
    for (const field of requiredFields) {
      if (!room[field] || typeof room[field] !== 'string') {
        return false;
      }
    }
    
    // Validate exits structure if present
    if (room.exits) {
      if (typeof room.exits !== 'object') {
        return false;
      }
      
      for (const exit of Object.values(room.exits)) {
        if (!exit.destination || !exit.keywords || !Array.isArray(exit.keywords)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Add a player to the room system at the default starting room
   * @param {string} playerId - Player identifier
   * @returns {boolean} True if player was added successfully
   */
  addPlayer(playerId) {
    if (!this.isLoaded) {
      console.error('Cannot add player: room system not loaded');
      return false;
    }
    
    if (!playerId) {
      console.error('Cannot add player: invalid player ID');
      return false;
    }
    
    this.playerRooms.set(playerId, this.defaultRoom);
    console.log(`Player ${playerId} added to room system at ${this.defaultRoom}`);
    return true;
  }

  /**
   * Remove a player from the room system
   * @param {string} playerId - Player identifier
   * @returns {boolean} True if player was removed successfully
   */
  removePlayer(playerId) {
    if (this.playerRooms.has(playerId)) {
      this.playerRooms.delete(playerId);
      console.log(`Player ${playerId} removed from room system`);
      return true;
    }
    return false;
  }

  /**
   * Move a player to a different room
   * @param {string} playerId - Player identifier
   * @param {string} direction - Direction or target keyword for movement
   * @returns {Object} Movement result with success status and details
   */
  movePlayer(playerId, direction) {
    // Validate player exists
    if (!this.playerRooms.has(playerId)) {
      return {
        success: false,
        error: 'Player not found in room system'
      };
    }
    
    const currentRoomId = this.playerRooms.get(playerId);
    const currentRoom = this.rooms.get(currentRoomId);
    
    if (!currentRoom || !currentRoom.exits) {
      return {
        success: false,
        error: 'No exits available from current location'
      };
    }
    
    // Find matching exit
    const directionLower = direction.toLowerCase();
    let matchedExit = null;
    let matchedDirection = null;
    
    for (const [exitDirection, exit] of Object.entries(currentRoom.exits)) {
      // Check if direction matches or is in keywords
      if (exitDirection.toLowerCase() === directionLower || 
          exit.keywords.some(keyword => keyword.toLowerCase() === directionLower)) {
        matchedExit = exit;
        matchedDirection = exitDirection;
        break;
      }
    }
    
    if (!matchedExit) {
      return {
        success: false,
        error: `You can't go ${direction}. Available exits: ${Object.keys(currentRoom.exits).join(', ')}`
      };
    }
    
    // Validate destination room exists
    const destinationRoom = this.rooms.get(matchedExit.destination);
    if (!destinationRoom) {
      return {
        success: false,
        error: 'Destination room not found'
      };
    }
    
    // Move player
    this.playerRooms.set(playerId, matchedExit.destination);
    
    return {
      success: true,
      fromRoom: currentRoomId,
      toRoom: matchedExit.destination,
      direction: matchedDirection,
      exitDescription: matchedExit.description
    };
  }

  /**
   * Get current room ID for a player
   * @param {string} playerId - Player identifier
   * @returns {string|null} Room ID or null if player not found
   */
  getPlayerRoom(playerId) {
    return this.playerRooms.get(playerId) || null;
  }

  /**
   * Get all players currently in a specific room
   * @param {string} roomId - Room identifier
   * @returns {Array<string>} Array of player IDs in the room
   */
  getPlayersInRoom(roomId) {
    const playersInRoom = [];
    
    for (const [playerId, playerRoomId] of this.playerRooms) {
      if (playerRoomId === roomId) {
        playersInRoom.push(playerId);
      }
    }
    
    return playersInRoom;
  }

  /**
   * Get detailed room description including other players
   * @param {string} roomId - Room identifier
   * @param {string} currentPlayerId - ID of the player requesting description
   * @param {Map} connectedPlayers - Map of connected players for names
   * @returns {Object|null} Room description object or null if room not found
   */
  getRoomDescription(roomId, currentPlayerId, connectedPlayers = new Map()) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }
    
    // Get other players in the room
    const otherPlayers = this.getPlayersInRoom(roomId)
      .filter(playerId => playerId !== currentPlayerId)
      .map(playerId => {
        const playerData = connectedPlayers.get(playerId);
        return playerData ? playerData.name || `Player ${playerId.substring(0, 8)}` : `Player ${playerId.substring(0, 8)}`;
      });
    
    // Build description
    let description = room.description;
    
    // Add other players information
    if (otherPlayers.length > 0) {
      description += '\n\n';
      if (otherPlayers.length === 1) {
        description += `${otherPlayers[0]} is here.`;
      } else {
        description += `Other players here: ${otherPlayers.join(', ')}.`;
      }
    }
    
    // Add exits information
    if (room.exits && Object.keys(room.exits).length > 0) {
      description += '\n\nExits: ' + Object.keys(room.exits).join(', ') + '.';
    }
    
    return {
      id: room.id,
      name: room.name,
      description: description,
      exits: room.exits || {},
      commands: room.commands || {},
      playersPresent: otherPlayers
    };
  }

  /**
   * Get available commands for a room
   * @param {string} roomId - Room identifier
   * @returns {Object} Available commands for the room
   */
  getRoomCommands(roomId) {
    const room = this.rooms.get(roomId);
    return room ? (room.commands || {}) : {};
  }

  /**
   * Check if movement in a direction is valid from current room
   * @param {string} playerId - Player identifier
   * @param {string} direction - Direction to check
   * @returns {boolean} True if movement is valid
   */
  canMove(playerId, direction) {
    const roomId = this.getPlayerRoom(playerId);
    const room = this.rooms.get(roomId);
    
    if (!room || !room.exits) {
      return false;
    }
    
    const directionLower = direction.toLowerCase();
    
    for (const [exitDirection, exit] of Object.entries(room.exits)) {
      if (exitDirection.toLowerCase() === directionLower || 
          exit.keywords.some(keyword => keyword.toLowerCase() === directionLower)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get summary statistics about the room system
   * @returns {Object} Statistics about rooms and players
   */
  getStats() {
    const playersByRoom = new Map();
    
    for (const [playerId, roomId] of this.playerRooms) {
      if (!playersByRoom.has(roomId)) {
        playersByRoom.set(roomId, []);
      }
      playersByRoom.get(roomId).push(playerId);
    }
    
    return {
      totalRooms: this.rooms.size,
      totalPlayers: this.playerRooms.size,
      occupiedRooms: playersByRoom.size,
      isLoaded: this.isLoaded,
      defaultRoom: this.defaultRoom,
      playerDistribution: Object.fromEntries(playersByRoom)
    };
  }
}

module.exports = RoomSystem;