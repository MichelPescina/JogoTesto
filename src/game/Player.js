const { PLAYER_STATUS, GAME_CONFIG } = require('../utils/constants');

/**
 * Player class manages individual player state and actions
 */
class Player {
  /**
   * Creates a new Player instance
   * @param {string} id - Unique player identifier
   * @param {string} name - Player display name
   * @param {string} socketId - Socket.io connection ID
   */
  constructor(id, name, socketId) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;

    // Game state
    this.room = 'spawn'; // Current room ID
    this.strength = GAME_CONFIG.BASE_PLAYER_STRENGTH;
    this.weapon = null; // Current weapon object
    this.status = PLAYER_STATUS.ALIVE;

    // Action tracking
    this.lastAction = Date.now();
    this.searchStartTime = null;
    this.isSearching = false;

    // Combat tracking
    this.kills = 0;
    this.combatParticipant = null; // ID of player in combat with
  }

  /**
   * Checks if player can perform an action (rate limiting)
   * @returns {boolean} True if action is allowed
   */
  canAct() {
    const now = Date.now();
    const timeSinceLastAction = now - this.lastAction;

    if (timeSinceLastAction < GAME_CONFIG.ACTION_COOLDOWN) {
      return false;
    }

    return this.status === PLAYER_STATUS.ALIVE && !this.isSearching;
  }

  /**
   * Updates last action timestamp
   */
  updateLastAction() {
    this.lastAction = Date.now();
  }

  /**
   * Moves player to a new room
   * @param {string} roomId - Target room ID
   */
  moveToRoom(roomId) {
    if (!this.canAct()) {
      throw new Error('Player cannot move right now');
    }

    this.room = roomId;
    this.updateLastAction();
  }

  /**
   * Equips a weapon, replacing current weapon if any
   * @param {Object} weapon - Weapon object to equip
   */
  equipWeapon(weapon) {
    this.weapon = weapon;
  }

  /**
   * Calculates total attack damage (strength + weapon damage)
   * @returns {number} Total attack damage
   */
  getAttackDamage() {
    const weaponDamage = this.weapon ? this.weapon.damage : 0;
    return this.strength + weaponDamage;
  }

  /**
   * Processes taking damage and potentially dying
   * @param {number} damage - Damage amount received
   */
  takeDamage(damage) {
    // In this game, any combat results in winner/loser, not gradual damage
    // This method is for consistency but actual combat is resolved differently
    this.status = PLAYER_STATUS.DEAD;
  }

  /**
   * Handles winning a combat encounter
   * Increases strength and updates kill count
   */
  winCombat() {
    if (this.status !== PLAYER_STATUS.ALIVE) {
      return;
    }

    this.strength += GAME_CONFIG.STRENGTH_GAIN_PER_WIN;
    this.kills += 1;
    this.combatParticipant = null;
  }

  /**
   * Handles losing a combat encounter
   */
  loseCombat() {
    this.status = PLAYER_STATUS.DEAD;
    this.combatParticipant = null;
  }

  /**
   * Starts weapon search process
   * Makes player vulnerable for the search duration
   */
  startWeaponSearch() {
    if (!this.canAct()) {
      throw new Error('Player cannot search right now');
    }

    this.status = PLAYER_STATUS.SEARCHING;
    this.isSearching = true;
    this.searchStartTime = Date.now();
    this.updateLastAction();

    // Auto-complete search after duration
    setTimeout(() => {
      this.completeWeaponSearch();
    }, GAME_CONFIG.WEAPON_SEARCH_DURATION);
  }

  /**
   * Completes weapon search process
   * Returns player to normal status
   */
  completeWeaponSearch() {
    if (this.status === PLAYER_STATUS.SEARCHING) {
      this.status = PLAYER_STATUS.ALIVE;
    }
    this.isSearching = false;
    this.searchStartTime = null;
  }

  /**
   * Checks if player is currently vulnerable (searching)
   * @returns {boolean} True if player is vulnerable
   */
  isVulnerable() {
    return this.status === PLAYER_STATUS.SEARCHING;
  }

  /**
   * Checks if player is alive and can participate in combat
   * @returns {boolean} True if player can fight
   */
  canFight() {
    return this.status === PLAYER_STATUS.ALIVE && !this.isSearching;
  }

  /**
   * Initiates combat with another player
   * @param {string} targetPlayerId - ID of player to fight
   */
  initiateCombat(targetPlayerId) {
    if (!this.canFight()) {
      throw new Error('Player cannot initiate combat');
    }

    this.combatParticipant = targetPlayerId;
    this.updateLastAction();
  }

  /**
   * Attempts to escape from combat
   * @returns {boolean} True if escape was successful
   */
  attemptEscape() {
    if (!this.combatParticipant) {
      throw new Error('Player is not in combat');
    }

    const escapeSuccess = Math.random() < GAME_CONFIG.ESCAPE_SUCCESS_CHANCE;
    this.combatParticipant = null;
    this.updateLastAction();

    return escapeSuccess;
  }

  /**
   * Handles player disconnection
   * Sets status to dead to remove from active game
   */
  handleDisconnection() {
    this.status = PLAYER_STATUS.DEAD;
    this.combatParticipant = null;
    this.isSearching = false;
  }

  /**
   * Gets remaining search time in milliseconds
   * @returns {number} Milliseconds remaining, 0 if not searching
   */
  getRemainingSearchTime() {
    if (!this.isSearching || !this.searchStartTime) {
      return 0;
    }

    const elapsed = Date.now() - this.searchStartTime;
    const remaining = GAME_CONFIG.WEAPON_SEARCH_DURATION - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * Serializes player data for client transmission
   * @param {boolean} includePrivateData - Include sensitive data like exact position
   * @returns {Object} Player data for client
   */
  toClientData(includePrivateData = false) {
    const data = {
      id: this.id,
      name: this.name,
      status: this.status,
      strength: this.strength,
      kills: this.kills,
      weapon: this.weapon ? {
        name: this.weapon.name,
        damage: this.weapon.damage,
        description: this.weapon.description
      } : null,
      isSearching: this.isSearching
    };

    if (includePrivateData) {
      data.room = this.room;
      data.socketId = this.socketId;
      data.combatParticipant = this.combatParticipant;
      data.remainingSearchTime = this.getRemainingSearchTime();
    }

    return data;
  }

  /**
   * Gets player's current stats for display
   * @returns {Object} Current player statistics
   */
  getStats() {
    return {
      name: this.name,
      strength: this.strength,
      kills: this.kills,
      weapon: this.weapon ? this.weapon.name : 'None',
      attackDamage: this.getAttackDamage(),
      status: this.status
    };
  }

  /**
   * Validates if player name meets requirements
   * @param {string} name - Name to validate
   * @returns {boolean} True if name is valid
   */
  static isValidName(name) {
    if (!name || typeof name !== 'string') {
      return false;
    }

    const trimmed = name.trim();

    // Name must be 1-20 characters, alphanumeric plus spaces
    if (trimmed.length < 1 || trimmed.length > 20) {
      return false;
    }

    // Only allow letters, numbers, spaces, and basic punctuation
    const validNameRegex = /^[a-zA-Z0-9\s\-_\.]+$/;
    return validNameRegex.test(trimmed);
  }
}

module.exports = Player;