const { test, describe } = require('node:test');
const assert = require('node:assert');
const SessionManager = require('../server/SessionManager.js');

describe('SessionManager', () => {
    test('should create valid session with player ID and name', () => {
        const manager = new SessionManager();
        const sessionId = manager.createSession('player123', 'TestPlayer');
        
        assert(typeof sessionId === 'string');
        assert(sessionId.length > 0);
        
        const session = manager.getSession(sessionId);
        assert(session !== null);
        assert.strictEqual(session.playerId, 'player123');
        assert.strictEqual(session.playerName, 'TestPlayer');
        assert.strictEqual(session.isValid, true);
    });

    test('should validate existing session within timeout period', () => {
        const manager = new SessionManager();
        const sessionId = manager.createSession('player456', 'ValidPlayer');
        const currentTime = Date.now();
        
        const isValid = manager.isValidSession(sessionId, currentTime);
        assert.strictEqual(isValid, true);
    });

    test('should reject invalid session ID', () => {
        const manager = new SessionManager();
        const isValid = manager.isValidSession('invalid-session-id', Date.now());
        assert.strictEqual(isValid, false);
    });

    test('should reject expired session', () => {
        const manager = new SessionManager();
        const sessionId = manager.createSession('player789', 'ExpiredPlayer');
        
        // Simulate time far in the future (beyond session timeout)
        const futureTime = Date.now() + (31 * 60 * 1000); // 31 minutes in the future
        
        const isValid = manager.isValidSession(sessionId, futureTime);
        assert.strictEqual(isValid, false);
    });

    test('should update activity timestamp', () => {
        const manager = new SessionManager();
        const sessionId = manager.createSession('player999', 'ActivePlayer');
        
        const originalSession = manager.getSession(sessionId);
        const originalActivity = originalSession.lastActivity;
        
        // Wait a tiny bit and update activity
        setTimeout(() => {
            manager.updateActivity(sessionId);
            const updatedSession = manager.getSession(sessionId);
            assert(updatedSession.lastActivity > originalActivity);
        }, 10);
    });

    test('should invalidate session', () => {
        const manager = new SessionManager();
        const sessionId = manager.createSession('player111', 'ToBeInvalidated');
        
        // Session should be valid initially
        assert.strictEqual(manager.isValidSession(sessionId), true);
        
        // Invalidate session
        manager.invalidateSession(sessionId);
        
        // Session should now be invalid
        assert.strictEqual(manager.isValidSession(sessionId), false);
    });

    test('should count active sessions correctly', () => {
        const manager = new SessionManager();
        
        // Initially should have 0 sessions
        assert.strictEqual(manager.getActiveSessionCount(), 0);
        
        // Create some sessions
        const session1 = manager.createSession('player1', 'Player1');
        const session2 = manager.createSession('player2', 'Player2');
        
        assert.strictEqual(manager.getActiveSessionCount(), 2);
        
        // Invalidate one session
        manager.invalidateSession(session1);
        
        assert.strictEqual(manager.getActiveSessionCount(), 1);
    });

    test('should cleanup properly', () => {
        const manager = new SessionManager();
        manager.createSession('player222', 'CleanupTest');
        
        assert(manager.sessions.size > 0);
        
        manager.cleanup();
        
        assert.strictEqual(manager.sessions.size, 0);
        assert.strictEqual(manager.cleanupInterval, null);
    });
});