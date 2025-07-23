/**
 * Game configuration constants with environment variable overrides
 */

const GAME_CONFIG = {
  // Server configuration
  DEFAULT_PORT: parseInt(process.env.PORT, 10) || 3000,

  // Match configuration
  MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS, 10) || 20,
  MIN_PLAYERS_TO_START: parseInt(process.env.MIN_PLAYERS_TO_START, 10) || 2,

  // Game mechanics
  WEAPON_SEARCH_DURATION: parseInt(process.env.WEAPON_SEARCH_DURATION, 10) || 2000, // 2 seconds
  ESCAPE_SUCCESS_CHANCE: parseFloat(process.env.ESCAPE_SUCCESS_CHANCE) || 0.5, // 50%

  // Weapon spawn configuration
  DEFAULT_WEAPON_SPAWN_CHANCE: parseFloat(process.env.DEFAULT_WEAPON_SPAWN_CHANCE) || 0.1, // 10%

  // Combat configuration
  BASE_PLAYER_STRENGTH: parseInt(process.env.BASE_PLAYER_STRENGTH, 10) || 1,
  STRENGTH_GAIN_PER_WIN: parseInt(process.env.STRENGTH_GAIN_PER_WIN, 10) || 1,

  // Rate limiting
  ACTION_COOLDOWN: parseInt(process.env.ACTION_COOLDOWN, 10) || 100, // 100ms between actions

  // Connection configuration
  HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL, 10) || 25000, // 25 seconds
  HEARTBEAT_TIMEOUT: parseInt(process.env.HEARTBEAT_TIMEOUT, 10) || 60000, // 60 seconds
};

/**
 * Weapon definitions with damage and rarity
 */
const WEAPONS = {
  stick: {
    damage: 1,
    rarity: 0.6,
    name: 'Wooden Stick',
    description: 'A sturdy wooden stick. Better than nothing.'
  },
  knife: {
    damage: 3,
    rarity: 0.3,
    name: 'Sharp Knife',
    description: 'A gleaming blade that cuts deep.'
  },
  sword: {
    damage: 5,
    rarity: 0.1,
    name: 'Steel Sword',
    description: 'A masterfully forged weapon of war.'
  }
};

/**
 * Player status constants
 */
const PLAYER_STATUS = {
  ALIVE: 'alive',
  DEAD: 'dead',
  SEARCHING: 'searching'
};

/**
 * Match status constants
 */
const MATCH_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  FINISHED: 'finished'
};

/**
 * Movement directions mapping
 */
const DIRECTIONS = {
  w: 'north',
  a: 'west',
  s: 'south',
  d: 'east',
  north: 'north',
  west: 'west',
  south: 'south',
  east: 'east'
};

/**
 * Socket event names
 */
const SOCKET_EVENTS = {
  // Server to client
  MATCH_JOINED: 'matchJoined',
  MATCH_FULL: 'matchFull',
  MATCH_STARTED: 'matchStarted',
  MATCH_ENDED: 'matchEnded',
  ROOM_UPDATE: 'roomUpdate',
  ROOM_INFO: 'roomInfo',
  PLAYER_ENTERED: 'playerEntered',
  PLAYER_LEFT: 'playerLeft',
  COMBAT_INITIATED: 'combatInitiated',
  COMBAT_RESULT: 'combatResult',
  WEAPON_FOUND: 'weaponFound',
  SEARCH_STARTED: 'searchStarted',
  SEARCH_COMPLETED: 'searchCompleted',
  ERROR: 'error',

  // Client to server
  JOIN_MATCH: 'joinMatch',
  MOVE: 'move',
  SEARCH: 'search',
  ATTACK: 'attack',
  ESCAPE: 'escape'
};

module.exports = {
  GAME_CONFIG,
  WEAPONS,
  PLAYER_STATUS,
  MATCH_STATUS,
  DIRECTIONS,
  SOCKET_EVENTS
};