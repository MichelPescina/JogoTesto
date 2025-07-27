const { randomUUID } = require('node:crypto')

class Session {
    constructor (sessionId) {
        this.sessionId = sessionId;
        this.creationDate = new Date();
        this.lastOnline = this.creationDate;
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

    assignSocket(sessionId, socket) {
        let session = this.sessions.get(sessionId);
        session.setSocket(socket);
    }

    isValidSession(sessionId) {
        if (!sessionId) return false;
        const isValid = this.sessions.has(sessionId) && 
            (new Date() - this.sessions.get(sessionId).lastOnline < this.expirationThreshold);
        return isValid;
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
}

module.exports = SessionManager;