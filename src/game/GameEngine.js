const fs = require('fs');
const path = require('path');
const Room = require('./Room');
const { DIRECTIONS, PLAYER_STATUS } = require('../utils/constants');

/**
 * GameEngine handles core game mechanics including movement, combat, and weapon searching
 */
class GameEngine {
  constructor() {
    this.rooms = new Map(); // roomId -> Room instance
    this.players = new Map(); // playerId -> Player instance
    this.loadWorld();
  }

  /**
   * Loads world data from JSON and creates Room instances
   */
  loadWorld() {
    try {
      const worldPath = path.join(__dirname, '../data/world.json');
      const worldData = JSON.parse(fs.readFileSync(worldPath, 'utf8'));

      // Create Room instances from world data
      for (const [roomId, roomData] of Object.entries(worldData)) {
        const room = Room.fromWorldData(roomData);
        this.rooms.set(roomId, room);
      }

      console.log(`Loaded ${this.rooms.size} rooms from world data`);
    } catch (error) {
      console.error('Failed to load world data:', error);
      throw new Error('Cannot start game engine without world data');
    }
  }

  /**
   * Adds a player to the game engine
   * @param {Player} player - Player instance to add
   */
  addPlayer(player) {
    this.players.set(player.id, player);

    // Add player to spawn room
    const spawnRoom = this.rooms.get('spawn');
    if (spawnRoom) {
      spawnRoom.addPlayer(player.id);
    }
  }

  /**
   * Removes a player from the game engine
   * @param {string} playerId - Player ID to remove
   */
  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      // Remove from current room
      const currentRoom = this.rooms.get(player.room);
      if (currentRoom) {
        currentRoom.removePlayer(playerId);
      }
    }

    this.players.delete(playerId);
  }

  /**
   * Gets a player by ID
   * @param {string} playerId - Player ID
   * @returns {Player|null} Player instance or null
   */
  getPlayer(playerId) {
    return this.players.get(playerId) || null;
  }

  /**
   * Gets a room by ID
   * @param {string} roomId - Room ID
   * @returns {Room|null} Room instance or null
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Validates if a move is possible from current room in given direction
   * @param {string} fromRoomId - Current room ID
   * @param {string} direction - Movement direction
   * @returns {Object} Validation result {valid: boolean, targetRoom: string|null, error: string|null}
   */
  validateMove(fromRoomId, direction) {
    const room = this.rooms.get(fromRoomId);
    if (!room) {
      return { valid: false, targetRoom: null, error: 'Invalid current room' };
    }

    // Normalize direction
    const normalizedDirection = DIRECTIONS[direction.toLowerCase()];
    if (!normalizedDirection) {
      return { valid: false, targetRoom: null, error: 'Invalid direction' };
    }

    const targetRoomId = room.getExit(normalizedDirection);
    if (!targetRoomId) {
      return { valid: false, targetRoom: null, error: 'No exit in that direction' };
    }

    const targetRoom = this.rooms.get(targetRoomId);
    if (!targetRoom) {
      return { valid: false, targetRoom: null, error: 'Target room does not exist' };
    }

    return { valid: true, targetRoom: targetRoomId, error: null };
  }

  /**
   * Moves a player to a new room with atomic state updates
   * @param {string} playerId - Player ID
   * @param {string} direction - Movement direction
   * @returns {Object} Move result with success status and room data
   */
  movePlayer(playerId, direction) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (!player.canAct()) {
      return { success: false, error: 'Cannot move right now' };
    }

    const validation = this.validateMove(player.room, direction);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Atomic state update
    try {
      const oldRoom = this.rooms.get(player.room);
      const newRoom = this.rooms.get(validation.targetRoom);

      // Remove from old room
      if (oldRoom) {
        oldRoom.removePlayer(playerId);
      }

      // Update player position
      player.moveToRoom(validation.targetRoom);

      // Add to new room
      newRoom.addPlayer(playerId);

      return {
        success: true,
        oldRoom: oldRoom ? oldRoom.id : null,
        newRoom: newRoom.id,
        roomDescription: newRoom.getFullDescription(),
        roomData: newRoom.toClientData(),
        playersInRoom: newRoom.getPlayers().filter(pid => pid !== playerId)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Initiates weapon search for a player
   * @param {string} playerId - Player ID
   * @returns {Object} Search result
   */
  startWeaponSearch(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (!player.canAct()) {
      return { success: false, error: 'Cannot search right now' };
    }

    const room = this.rooms.get(player.room);
    if (!room) {
      return { success: false, error: 'Invalid room' };
    }

    if (!room.hasWeapon) {
      return { success: false, error: 'Nothing to find here' };
    }

    try {
      // Start search process (makes player vulnerable)
      player.startWeaponSearch();

      return {
        success: true,
        searchDuration: require('../utils/constants').GAME_CONFIG.WEAPON_SEARCH_DURATION,
        message: 'Searching for weapon... You are vulnerable!'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Completes weapon search and awards weapon if still available
   * @param {string} playerId - Player ID
   * @returns {Object} Search completion result
   */
  completeWeaponSearch(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (!player.isSearching) {
      return { success: false, error: 'Player is not searching' };
    }

    const room = this.rooms.get(player.room);
    if (!room) {
      return { success: false, error: 'Invalid room' };
    }

    try {
      // Complete search process
      player.completeWeaponSearch();

      // Try to get weapon from room
      const weapon = room.searchForWeapon();

      if (weapon) {
        player.equipWeapon(weapon);
        return {
          success: true,
          weaponFound: true,
          weapon: weapon,
          message: `Found ${weapon.name}! ${weapon.description}`
        };
      } else {
        return {
          success: true,
          weaponFound: false,
          message: 'Search completed but found nothing.'
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Resolves combat between two players with atomic state updates
   * @param {string} attackerId - Attacking player ID
   * @param {string} defenderId - Defending player ID
   * @returns {Object} Combat result
   */
  resolveCombat(attackerId, defenderId) {
    const attacker = this.getPlayer(attackerId);
    const defender = this.getPlayer(defenderId);

    if (!attacker || !defender) {
      return { success: false, error: 'Invalid players' };
    }

    // Validate combat can occur
    if (attacker.room !== defender.room) {
      return { success: false, error: 'Players not in same room' };
    }

    if (defender.isVulnerable()) {
      // Defender is searching and automatically loses
      try {
        defender.loseCombat();
        attacker.winCombat();

        return {
          success: true,
          winner: attacker.toClientData(),
          loser: defender.toClientData(),
          reason: 'Defender was vulnerable while searching',
          attackDamage: attacker.getAttackDamage(),
          defendDamage: 0
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    if (!attacker.canFight() || !defender.canFight()) {
      return { success: false, error: 'Players cannot fight right now' };
    }

    try {
      // Calculate combat damage
      const attackDamage = attacker.getAttackDamage();
      const defendDamage = defender.getAttackDamage();

      // Determine winner (higher damage wins, attacker wins ties)
      const attackerWins = attackDamage >= defendDamage;
      const winner = attackerWins ? attacker : defender;
      const loser = attackerWins ? defender : attacker;

      // Apply combat results atomically
      winner.winCombat();
      loser.loseCombat();

      return {
        success: true,
        winner: winner.toClientData(),
        loser: loser.toClientData(),
        reason: 'Combat resolved by attack power',
        attackDamage: attackDamage,
        defendDamage: defendDamage
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Handles escape attempt during combat
   * @param {string} playerId - Player attempting to escape
   * @returns {Object} Escape result
   */
  handleEscape(playerId) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (!player.combatParticipant) {
      return { success: false, error: 'Player is not in combat' };
    }

    const room = this.rooms.get(player.room);
    if (!room) {
      return { success: false, error: 'Invalid room' };
    }

    try {
      const escapeSuccess = player.attemptEscape();

      if (escapeSuccess) {
        // Move to random exit
        const randomExit = room.getRandomExit();
        if (randomExit) {
          const targetRoomId = room.getExit(randomExit);
          const moveResult = this.movePlayer(playerId, randomExit);

          return {
            success: true,
            escaped: true,
            newRoom: targetRoomId,
            message: `Escaped to ${randomExit}!`,
            moveResult: moveResult
          };
        } else {
          // No exits available, escape fails
          player.loseCombat();
          return {
            success: true,
            escaped: false,
            died: true,
            message: 'No escape route available!'
          };
        }
      } else {
        // Escape failed, player dies
        player.loseCombat();
        return {
          success: true,
          escaped: false,
          died: true,
          message: 'Escape attempt failed!'
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Gets all players in a specific room
   * @param {string} roomId - Room ID
   * @returns {Array<Player>} Array of players in the room
   */
  getPlayersInRoom(roomId) {
    const players = [];
    for (const player of this.players.values()) {
      if (player.room === roomId && player.status === PLAYER_STATUS.ALIVE) {
        players.push(player);
      }
    }
    return players;
  }

  /**
   * Gets all alive players
   * @returns {Array<Player>} Array of alive players
   */
  getAlivePlayers() {
    const alivePlayers = [];
    for (const player of this.players.values()) {
      if (player.status === PLAYER_STATUS.ALIVE) {
        alivePlayers.push(player);
      }
    }
    return alivePlayers;
  }

  /**
   * Handles player disconnection
   * @param {string} playerId - Disconnected player ID
   */
  handlePlayerDisconnection(playerId) {
    const player = this.getPlayer(playerId);
    if (player) {
      player.handleDisconnection();

      // Remove from room
      const room = this.rooms.get(player.room);
      if (room) {
        room.removePlayer(playerId);
      }
    }
  }

  /**
   * Gets game state summary
   * @returns {Object} Current game state
   */
  getGameState() {
    const alivePlayers = this.getAlivePlayers();
    return {
      totalPlayers: this.players.size,
      alivePlayers: alivePlayers.length,
      deadPlayers: this.players.size - alivePlayers.length,
      roomCount: this.rooms.size
    };
  }
}

module.exports = GameEngine;