/**
 * Session Management System for JogoTesto
 * Handles persistent player sessions across reconnections
 */

const { generatePlayerID, generateSessionID, validateIdFormat } = require('../utils/idGenerator');

/**
 * SessionManager class manages player sessions and persistent identity
 */
class SessionManager {
  /**
   * Initialize the session manager
   */
  constructor() {
    /** @type {Map<string, Object>} Map of sessionID to session data */
    this.sessions = new Map();
    
    /** @type {Map<string, string>} Map of playerID to sessionID for quick lookup */
    this.playerSessions = new Map();
    
    /** @type {number} Session expiry time in milliseconds (24 hours) */
    this.sessionExpiryTime = 24 * 60 * 60 * 1000;
    
    /** @type {NodeJS.Timeout} Cleanup interval timer */
    this.cleanupInterval = null;
    
    // Start cleanup process
    this.startCleanupProcess();
    
    console.log('SessionManager initialized');
  }

  /**
   * Create a new session for a player
   * @param {string} playerID - Unique player identifier
   * @param {string} username - Player's chosen username
   * @returns {Object} Session object
   */
  createSession(playerID, username) {
    if (!playerID || !validateIdFormat(playerID, 'player')) {
      throw new Error('Invalid playerID format');
    }

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      throw new Error('Username is required');
    }

    const sessionID = generateSessionID();
    const now = Date.now();
    
    const session = {
      sessionID,
      playerID,
      username: username.trim(),
      createdAt: now,
      lastActivity: now,
      matchID: null,
      isActive: true
    };

    // Store session
    this.sessions.set(sessionID, session);
    this.playerSessions.set(playerID, sessionID);

    console.log(`Created session for player ${playerID} (${username})`);
    return session;
  }

  /**
   * Create a new player and session
   * @param {string} username - Player's chosen username
   * @returns {Object} Session object with new playerID
   */
  createNewPlayerSession(username) {
    const playerID = generatePlayerID();
    return this.createSession(playerID, username);
  }

  /**
   * Find a session by sessionID
   * @param {string} sessionID - Session identifier
   * @returns {Object|null} Session object or null if not found
   */
  findSession(sessionID) {
    if (!sessionID || !validateIdFormat(sessionID, 'session')) {
      return null;
    }

    const session = this.sessions.get(sessionID);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (this.isSessionExpired(session)) {
      this.expireSession(sessionID);
      return null;
    }

    return session;
  }

  /**
   * Find session by playerID
   * @param {string} playerID - Player identifier
   * @returns {Object|null} Session object or null if not found
   */
  findSessionByPlayerID(playerID) {
    const sessionID = this.playerSessions.get(playerID);
    return sessionID ? this.findSession(sessionID) : null;
  }

  /**
   * Update session activity timestamp
   * @param {string} sessionID - Session identifier
   * @returns {boolean} True if session was updated
   */
  updateActivity(sessionID) {
    const session = this.findSession(sessionID);
    if (session) {
      session.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Update player's match association
   * @param {string} sessionID - Session identifier
   * @param {string|null} matchID - Match identifier or null to clear
   * @returns {boolean} True if session was updated
   */
  updatePlayerMatch(sessionID, matchID) {
    const session = this.findSession(sessionID);
    if (session) {
      session.matchID = matchID;
      this.updateActivity(sessionID);
      return true;
    }
    return false;
  }

  /**
   * Update player username
   * @param {string} sessionID - Session identifier
   * @param {string} newUsername - New username
   * @returns {boolean} True if session was updated
   */
  updateUsername(sessionID, newUsername) {
    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim().length === 0) {
      return false;
    }

    const session = this.findSession(sessionID);
    if (session) {
      session.username = newUsername.trim();
      this.updateActivity(sessionID);
      return true;
    }
    return false;
  }

  /**
   * Expire a session manually
   * @param {string} sessionID - Session identifier
   * @returns {boolean} True if session was expired
   */
  expireSession(sessionID) {
    const session = this.sessions.get(sessionID);
    if (session) {
      // Remove from both maps
      this.sessions.delete(sessionID);
      this.playerSessions.delete(session.playerID);
      
      console.log(`Expired session ${sessionID} for player ${session.playerID}`);
      return true;
    }
    return false;
  }

  /**
   * Check if a session is expired
   * @param {Object} session - Session object
   * @returns {boolean} True if session is expired
   * @private
   */
  isSessionExpired(session) {
    return (Date.now() - session.lastActivity) > this.sessionExpiryTime;
  }

  /**
   * Start automatic cleanup process for expired sessions
   * @private
   */
  startCleanupProcess() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  /**
   * Clean up expired sessions
   * @private
   */
  cleanupExpiredSessions() {
    const expiredSessions = [];
    
    for (const [sessionID, session] of this.sessions) {
      if (this.isSessionExpired(session)) {
        expiredSessions.push(sessionID);
      }
    }

    let cleanedCount = 0;
    for (const sessionID of expiredSessions) {
      if (this.expireSession(sessionID)) {
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Stop the cleanup process
   */
  stopCleanupProcess() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get session statistics
   * @returns {Object} Statistics about active sessions
   */
  getStats() {
    let activeSessions = 0;
    let playersInMatches = 0;
    
    for (const session of this.sessions.values()) {
      if (!this.isSessionExpired(session)) {
        activeSessions++;
        if (session.matchID) {
          playersInMatches++;
        }
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      expiredSessions: this.sessions.size - activeSessions,
      playersInMatches,
      playersInLobby: activeSessions - playersInMatches
    };
  }

  /**
   * Validate session data
   * @param {string} sessionID - Session identifier
   * @param {string} playerID - Player identifier
   * @returns {Object} Validation result
   */
  validateSession(sessionID, playerID) {
    try {
      const session = this.findSession(sessionID);
      
      if (!session) {
        return {
          isValid: false,
          error: 'Session not found - please rejoin',
          action: 'CREATE_NEW_SESSION'
        };
      }

      if (session.playerID !== playerID) {
        return {
          isValid: false,
          error: 'Session mismatch - invalid credentials',
          action: 'CREATE_NEW_SESSION'
        };
      }

      if (this.isSessionExpired(session)) {
        this.expireSession(sessionID);
        return {
          isValid: false,
          error: 'Session expired - please create new session',
          action: 'CREATE_NEW_SESSION'
        };
      }

      return {
        isValid: true,
        session
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Session validation error: ${error.message}`,
        action: 'CREATE_NEW_SESSION'
      };
    }
  }

  /**
   * Cleanup resources when shutting down
   */
  destroy() {
    this.stopCleanupProcess();
    this.sessions.clear();
    this.playerSessions.clear();
    console.log('SessionManager destroyed');
  }
}

module.exports = SessionManager;