/**
 * Session Management utilities for JogoTesto MatchSystem
 * Handles server-side session validation and persistence
 */

const { generateSessionToken, validateIdFormat } = require('./idGenerator');

/**
 * SessionManager class handles player session persistence and validation
 */
class SessionManager {
  /**
   * Initialize the session manager
   */
  constructor() {
    /** @type {Map<string, Object>} Map of session token to session data */
    this.sessions = new Map();
    
    /** @type {Map<string, string>} Map of player ID to session token */
    this.playerSessions = new Map();
    
    /** @type {number} Session timeout in milliseconds (24 hours) */
    this.sessionTimeout = 24 * 60 * 60 * 1000;
    
    // Clean up expired sessions every hour
    setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
  }

  /**
   * Create a new session for a player
   * @param {string} playerId - Player identifier
   * @param {string} matchId - Match identifier
   * @param {string} playerName - Player display name
   * @returns {Object} Session creation result
   */
  createSession(playerId, matchId, playerName) {
    try {
      // Validate inputs
      if (!playerId || !matchId || !playerName) {
        return {
          success: false,
          error: 'Invalid session parameters'
        };
      }

      // Check if player already has a session
      const existingToken = this.playerSessions.get(playerId);
      if (existingToken) {
        const existingSession = this.sessions.get(existingToken);
        if (existingSession && !this.isSessionExpired(existingSession)) {
          // Update existing session
          existingSession.matchId = matchId;
          existingSession.playerName = playerName;
          existingSession.lastActivity = new Date();
          
          return {
            success: true,
            sessionToken: existingToken,
            action: 'updated'
          };
        }
        
        // Clean up expired session
        this.deleteSession(existingToken);
      }

      // Generate new session token
      const sessionToken = generateSessionToken();
      
      // Create session data
      const sessionData = {
        playerId: playerId,
        matchId: matchId,
        playerName: playerName,
        createdAt: new Date(),
        lastActivity: new Date(),
        isValid: true
      };

      // Store session
      this.sessions.set(sessionToken, sessionData);
      this.playerSessions.set(playerId, sessionToken);

      console.log(`Created session for player ${playerId} in match ${matchId}`);

      return {
        success: true,
        sessionToken: sessionToken,
        action: 'created'
      };

    } catch (error) {
      console.error('Error creating session:', error);
      return {
        success: false,
        error: 'Failed to create session'
      };
    }
  }

  /**
   * Validate a session token and return session data
   * @param {string} sessionToken - Session token to validate
   * @returns {Object} Validation result with session data
   */
  validateSession(sessionToken) {
    try {
      // Validate token format
      if (!validateIdFormat(sessionToken, 'session')) {
        return {
          success: false,
          error: 'Invalid session token format'
        };
      }

      // Check if session exists
      const sessionData = this.sessions.get(sessionToken);
      if (!sessionData) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      // Check if session is expired
      if (this.isSessionExpired(sessionData)) {
        this.deleteSession(sessionToken);
        return {
          success: false,
          error: 'Session expired'
        };
      }

      // Check if session is valid
      if (!sessionData.isValid) {
        return {
          success: false,
          error: 'Session invalidated'
        };
      }

      // Update last activity
      sessionData.lastActivity = new Date();

      return {
        success: true,
        sessionData: {
          playerId: sessionData.playerId,
          matchId: sessionData.matchId,
          playerName: sessionData.playerName,
          createdAt: sessionData.createdAt,
          lastActivity: sessionData.lastActivity
        }
      };

    } catch (error) {
      console.error('Error validating session:', error);
      return {
        success: false,
        error: 'Session validation failed'
      };
    }
  }

  /**
   * Update session with new match ID
   * @param {string} sessionToken - Session token
   * @param {string} newMatchId - New match identifier
   * @returns {Object} Update result
   */
  updateSessionMatch(sessionToken, newMatchId) {
    const sessionData = this.sessions.get(sessionToken);
    if (!sessionData || this.isSessionExpired(sessionData)) {
      return {
        success: false,
        error: 'Invalid or expired session'
      };
    }

    sessionData.matchId = newMatchId;
    sessionData.lastActivity = new Date();

    return {
      success: true
    };
  }

  /**
   * Invalidate a session
   * @param {string} sessionToken - Session token to invalidate
   * @returns {Object} Invalidation result
   */
  invalidateSession(sessionToken) {
    const sessionData = this.sessions.get(sessionToken);
    if (!sessionData) {
      return {
        success: false,
        error: 'Session not found'
      };
    }

    sessionData.isValid = false;
    
    // Remove from player sessions map
    this.playerSessions.delete(sessionData.playerId);

    console.log(`Invalidated session for player ${sessionData.playerId}`);

    return {
      success: true
    };
  }

  /**
   * Delete a session completely
   * @param {string} sessionToken - Session token to delete
   * @private
   */
  deleteSession(sessionToken) {
    const sessionData = this.sessions.get(sessionToken);
    if (sessionData) {
      this.playerSessions.delete(sessionData.playerId);
      this.sessions.delete(sessionToken);
      console.log(`Deleted session for player ${sessionData.playerId}`);
    }
  }

  /**
   * Check if a session is expired
   * @param {Object} sessionData - Session data to check
   * @returns {boolean} True if session is expired
   * @private
   */
  isSessionExpired(sessionData) {
    const now = new Date();
    const sessionAge = now - sessionData.lastActivity;
    return sessionAge > this.sessionTimeout;
  }

  /**
   * Clean up expired sessions
   * @private
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [token, sessionData] of this.sessions) {
      if (this.isSessionExpired(sessionData)) {
        this.deleteSession(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Get session data by player ID
   * @param {string} playerId - Player identifier
   * @returns {Object|null} Session data or null if not found
   */
  getPlayerSession(playerId) {
    const sessionToken = this.playerSessions.get(playerId);
    if (!sessionToken) {
      return null;
    }

    const validation = this.validateSession(sessionToken);
    return validation.success ? validation.sessionData : null;
  }

  /**
   * Check if player has valid session
   * @param {string} playerId - Player identifier
   * @returns {boolean} True if player has valid session
   */
  hasValidSession(playerId) {
    const sessionToken = this.playerSessions.get(playerId);
    if (!sessionToken) {
      return false;
    }

    const validation = this.validateSession(sessionToken);
    return validation.success;
  }

  /**
   * Get session manager statistics
   * @returns {Object} Current session statistics
   */
  getStats() {
    const now = new Date();
    let activeCount = 0;
    let expiredCount = 0;

    for (const sessionData of this.sessions.values()) {
      if (this.isSessionExpired(sessionData)) {
        expiredCount++;
      } else if (sessionData.isValid) {
        activeCount++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeCount,
      expiredSessions: expiredCount,
      playerMappings: this.playerSessions.size
    };
  }
}

// Export singleton instance
const sessionManager = new SessionManager();

module.exports = sessionManager;