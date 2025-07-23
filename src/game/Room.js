const { WEAPONS } = require('../utils/constants');

/**
 * Room class manages individual game rooms with weapon spawning and player tracking
 */
class Room {
  /**
   * Creates a new Room instance
   * @param {string} id - Unique room identifier
   * @param {string} name - Human-readable room name
   * @param {string} description - Room description shown to players
   * @param {Object} exits - Available exits {direction: roomId}
   * @param {number} weaponSpawnChance - Probability of weapon spawn (0-1)
   */
  constructor(id, name, description, exits, weaponSpawnChance = 0.1) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.exits = exits || {};
    this.weaponSpawnChance = weaponSpawnChance;

    // Current state
    this.hasWeapon = false;
    this.currentWeapon = null;
    this.players = new Set(); // Set of player IDs currently in this room

    // Initialize with potential weapon spawn
    this.rollForWeaponSpawn();
  }

  /**
   * Adds a player to this room
   * @param {string} playerId - The player ID to add
   */
  addPlayer(playerId) {
    this.players.add(playerId);
  }

  /**
   * Removes a player from this room
   * @param {string} playerId - The player ID to remove
   */
  removePlayer(playerId) {
    this.players.delete(playerId);
  }

  /**
   * Gets all players currently in this room
   * @returns {Array<string>} Array of player IDs
   */
  getPlayers() {
    return Array.from(this.players);
  }

  /**
   * Checks if a specific exit direction is valid
   * @param {string} direction - Direction to check (north, south, east, west)
   * @returns {boolean} True if exit exists
   */
  hasExit(direction) {
    return direction in this.exits;
  }

  /**
   * Gets the room ID for a given direction
   * @param {string} direction - Direction to check
   * @returns {string|null} Room ID or null if no exit
   */
  getExit(direction) {
    return this.exits[direction] || null;
  }

  /**
   * Gets all available exit directions
   * @returns {Array<string>} Array of available directions
   */
  getAvailableExits() {
    return Object.keys(this.exits);
  }

  /**
   * Attempts to spawn a weapon based on spawn chance
   * Only spawns if no weapon currently exists
   */
  rollForWeaponSpawn() {
    if (this.hasWeapon) {
      return; // Already has a weapon
    }

    if (Math.random() < this.weaponSpawnChance) {
      this.spawnWeapon();
    }
  }

  /**
   * Spawns a random weapon in this room
   * Uses weapon rarity to determine which weapon to spawn
   */
  spawnWeapon() {
    if (this.hasWeapon) {
      return; // Already has a weapon
    }

    const weaponKeys = Object.keys(WEAPONS);
    const totalRarity = weaponKeys.reduce((sum, key) => sum + WEAPONS[key].rarity, 0);
    let random = Math.random() * totalRarity;

    for (const weaponKey of weaponKeys) {
      random -= WEAPONS[weaponKey].rarity;
      if (random <= 0) {
        this.currentWeapon = {
          type: weaponKey,
          ...WEAPONS[weaponKey]
        };
        this.hasWeapon = true;
        break;
      }
    }
  }

  /**
   * Attempts to search for a weapon in this room
   * @returns {Object|null} Weapon object if found, null if no weapon
   */
  searchForWeapon() {
    if (!this.hasWeapon) {
      return null;
    }

    const foundWeapon = this.currentWeapon;
    this.resetWeapon();
    return foundWeapon;
  }

  /**
   * Resets weapon state and potentially spawns a new one
   */
  resetWeapon() {
    this.hasWeapon = false;
    this.currentWeapon = null;

    // Chance for a new weapon to spawn after this one is taken
    setTimeout(() => {
      this.rollForWeaponSpawn();
    }, 5000); // 5 second delay before potential respawn
  }

  /**
   * Gets the room description including weapon hint if present
   * @returns {string} Complete room description
   */
  getFullDescription() {
    let description = this.description;

    if (this.hasWeapon) {
      description += ' Looks like there is something hidden here.';
    }

    // Add exit information
    const exits = this.getAvailableExits();
    if (exits.length > 0) {
      description += ` Exits: ${exits.join(', ')}.`;
    }

    return description;
  }

  /**
   * Gets a random exit direction (used for escape mechanics)
   * @returns {string|null} Random exit direction or null if no exits
   */
  getRandomExit() {
    const exits = this.getAvailableExits();
    if (exits.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * exits.length);
    return exits[randomIndex];
  }

  /**
   * Serializes room data for client transmission
   * @param {boolean} includeWeaponHint - Whether to include weapon presence hint
   * @returns {Object} Room data for client
   */
  toClientData(includeWeaponHint = true) {
    return {
      id: this.id,
      name: this.name,
      description: includeWeaponHint ? this.getFullDescription() : this.description,
      exits: this.exits,
      hasWeapon: includeWeaponHint ? this.hasWeapon : false,
      playerCount: this.players.size
    };
  }

  /**
   * Creates a Room instance from world.json data
   * @param {Object} roomData - Room data from world.json
   * @returns {Room} New Room instance
   */
  static fromWorldData(roomData) {
    return new Room(
      roomData.id,
      roomData.name,
      roomData.description,
      roomData.exits,
      roomData.weaponSpawnChance
    );
  }
}

module.exports = Room;