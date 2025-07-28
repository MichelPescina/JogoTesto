const { randomUUID } = require('node:crypto');

/**
 * Manages player sessions with creation, validation, and cleanup
 * Follows the same pattern as MatchManager for consistency
 */
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes
        this.cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes
        
        // Start automatic cleanup
        this.cleanupInterval = setInterval(() => {
            this.deleteExpiredSessions();
        }, this.cleanupIntervalMs);
    }

    /**
     * Creates a new session for a player
     * @param {string} playerId - Unique player identifier
     * @param {string} playerName - Player display name
     * @returns {string} sessionId - Unique session identifier
     */
    createSession(playerId, playerName) {
        const sessionId = randomUUID();
        const session = {
            sessionId,
            playerId,
            playerName,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            isValid: true
        };
        
        this.sessions.set(sessionId, session);
        return sessionId;
    }

    /**
     * Validates if a session exists and is not expired
     * @param {string} sessionId - Session identifier to validate
     * @param {number} currentTime - Current timestamp for expiration check
     * @returns {boolean} - True if session is valid
     */
    isValidSession(sessionId, currentTime = Date.now()) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isValid) {
            return false;
        }
        
        // Check if session has expired
        const isExpired = (currentTime - session.lastActivity) > this.sessionTimeoutMs;
        if (isExpired) {
            this.invalidateSession(sessionId);
            return false;
        }
        
        return true;
    }

    /**
     * Gets session data for a valid session
     * @param {string} sessionId - Session identifier
     * @returns {Object|null} - Session data or null if invalid
     */
    getSession(sessionId) {
        if (!this.isValidSession(sessionId)) {
            return null;
        }
        
        const session = this.sessions.get(sessionId);
        // Update last activity
        session.lastActivity = Date.now();
        return session;
    }

    /**
     * Updates the last activity timestamp for a session
     * @param {string} sessionId - Session identifier
     */
    updateActivity(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session && session.isValid) {
            session.lastActivity = Date.now();
        }
    }

    /**
     * Invalidates a specific session
     * @param {string} sessionId - Session identifier to invalidate
     */
    invalidateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.isValid = false;
        }
    }

    /**
     * Deletes a session completely
     * @param {string} sessionId - Session identifier to delete
     */
    deleteSession(sessionId) {
        this.sessions.delete(sessionId);
    }

    /**
     * Cleans up expired and invalid sessions
     * Called automatically via interval
     */
    deleteExpiredSessions() {
        const currentTime = Date.now();
        const toRemove = [];
        
        for (const [sessionId, session] of this.sessions) {
            const isExpired = (currentTime - session.lastActivity) > this.sessionTimeoutMs;
            if (!session.isValid || isExpired) {
                toRemove.push(sessionId);
            }
        }
        
        for (const sessionId of toRemove) {
            this.deleteSession(sessionId);
        }
    }

    /**
     * Gets total number of active sessions
     * @returns {number} - Count of valid sessions
     */
    getActiveSessionCount() {
        let count = 0;
        const currentTime = Date.now();
        
        for (const session of this.sessions.values()) {
            if (this.isValidSession(session.sessionId, currentTime)) {
                count++;
            }
        }
        
        return count;
    }

    /**
     * Cleanup method to stop intervals when shutting down
     */
    cleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.sessions.clear();
    }
}

module.exports = SessionManager;