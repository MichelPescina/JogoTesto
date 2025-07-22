const { randomUUID } = require('node:crypto')

class Session {
    constructor (sessionId) {
        this.sessionId = sessionId;
        this.creationDate = new Date();
        this.playerId = null;
        this.matchId = null;
    }
}

class SessionManager {
    constructor () {
        this.sessions = new Map();
        // hours * minutes * seconds * milliseconds
        this.expirationThreshold = 24 * 60 * 60 * 1000; 
    }

    createSession() {
        const sessionId = randomUUID();
        const newSession = new Session(sessionId);
        this.sessions.set(sessionId, newSession);
        return sessionId;
    }

    isValidSession(sessionId, creationDate) {
        if (!sessionId || !creationDate) return false;
        const date = typeof(creationDate) === 'string'? 
            Date.parse(creationDate):
            creationDate;
        const isValid = this.sessions.has(sessionId) && 
            date === this.sessions.get(sessionId).creationDate &&
            date - this.sessions.get(sessionId).creationDate < this.expirationThreshold;
        return isValid;
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
}

module.exports = SessionManager;