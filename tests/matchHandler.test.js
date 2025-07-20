/**
 * Unit tests for MatchHandler class
 * Tests Socket.IO event handling, timer management, and match lifecycle coordination
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// Import the MatchHandler class
const MatchHandler = require('../src/handlers/matchHandler');
const MatchManager = require('../src/systems/matchManager');

// Mock socket utilities
function createMockSocket(id = 'test-socket-id') {
  const emittedEvents = [];
  
  return {
    id: id,
    join: (room) => ({ room }),
    leave: (room) => ({ room }),
    to: (room) => ({
      emit: (event, data) => {
        emittedEvents.push({ target: 'room', room, event, data });
      }
    }),
    emit: (event, data) => {
      emittedEvents.push({ target: 'socket', event, data });
    },
    getEmittedEvents: () => emittedEvents,
    clearEmittedEvents: () => { emittedEvents.length = 0; }
  };
}

function createMockIO() {
  const emittedEvents = [];
  const sockets = new Map();
  
  return {
    to: (room) => ({
      emit: (event, data) => {
        emittedEvents.push({ target: 'room', room, event, data });
      }
    }),
    emit: (event, data) => {
      emittedEvents.push({ target: 'broadcast', event, data });
    },
    sockets: {
      sockets: sockets
    },
    getEmittedEvents: () => emittedEvents,
    clearEmittedEvents: () => { emittedEvents.length = 0; },
    addSocket: (socket) => { sockets.set(socket.id, socket); }
  };
}

describe('MatchHandler Class', () => {
  
  describe('Constructor', () => {
    test('should initialize with IO and MatchManager', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      
      const handler = new MatchHandler(mockIO, mockMatchManager);
      
      assert.strictEqual(handler.io, mockIO);
      assert.strictEqual(handler.matchManager, mockMatchManager);
      assert.ok(handler.countdownTimers instanceof Map);
      assert.strictEqual(handler.countdownTimers.size, 0);
    });
  });

  describe('Join Match Handling', () => {
    test('should handle valid join match request', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      const joinData = { playerName: 'TestPlayer' };
      handler.handleJoinMatch(mockSocket, joinData);
      
      // Check that player was assigned to a match
      const playerMatchId = mockMatchManager.getPlayerMatchId('player1');
      assert.ok(playerMatchId);
      
      // Check that socket received matchAssigned event
      const events = mockSocket.getEmittedEvents();
      const matchAssignedEvent = events.find(e => e.event === 'matchAssigned');
      assert.ok(matchAssignedEvent);
      assert.strictEqual(matchAssignedEvent.data.playerId, 'player1');
      assert.strictEqual(matchAssignedEvent.data.playerName, 'TestPlayer');
      assert.ok(matchAssignedEvent.data.matchId);
    });

    test('should reject invalid player name', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Test empty player name
      handler.handleJoinMatch(mockSocket, { playerName: '' });
      
      const events = mockSocket.getEmittedEvents();
      const errorEvent = events.find(e => e.event === 'error');
      assert.ok(errorEvent);
      assert.match(errorEvent.data.message, /invalid.*player.*name/i);
    });

    test('should reject player name that is too long', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      const longName = 'a'.repeat(51); // Over 50 character limit
      handler.handleJoinMatch(mockSocket, { playerName: longName });
      
      const events = mockSocket.getEmittedEvents();
      const errorEvent = events.find(e => e.event === 'error');
      assert.ok(errorEvent);
      assert.match(errorEvent.data.message, /too.*long/i);
    });

    test('should handle non-string player name', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      handler.handleJoinMatch(mockSocket, { playerName: 123 });
      
      const events = mockSocket.getEmittedEvents();
      const errorEvent = events.find(e => e.event === 'error');
      assert.ok(errorEvent);
      assert.match(errorEvent.data.message, /invalid.*player.*name/i);
    });

    test('should notify other players when player joins match', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      handler.handleJoinMatch(mockSocket, { playerName: 'TestPlayer' });
      
      // Check for playerJoinedMatch broadcast
      const ioEvents = mockIO.getEmittedEvents();
      const joinNotification = ioEvents.find(e => e.event === 'playerJoinedMatch');
      console.log("Miau")
      assert.ok(joinNotification);
      assert.strictEqual(joinNotification.data.playerId, 'player1');
      assert.strictEqual(joinNotification.data.playerName, 'TestPlayer');
      console.log(handler)
    });
  });

  describe('Countdown Timer Management', () => {
    test('should start countdown timer for match', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      
      // Create a match manually
      const matchResult = mockMatchManager.findOrCreateMatch('player1', 'Player1');
      const match = mockMatchManager.getMatch(matchResult.matchId);
      
      // Override for testing
      match.minPlayers = 1;
      match.countdownDuration = 1; // 1 second for testing
      match.startCountdown();
      
      // Start countdown timer
      handler.startCountdownTimer(matchResult.matchId);
      
      // Verify timer was created
      assert.ok(handler.countdownTimers.has(matchResult.matchId));
      
      // Check for countdownStarted event
      const ioEvents = mockIO.getEmittedEvents();
      const countdownStarted = ioEvents.find(e => e.event === 'countdownStarted');
      assert.ok(countdownStarted);
      assert.ok(typeof countdownStarted.data.timeLeft === 'number');
    });

    test('should not start countdown for non-countdown match', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      
      // Create a match in waiting state
      const matchResult = mockMatchManager.findOrCreateMatch('player1', 'Player1');
      
      // Try to start countdown (should not work since match is in 'waiting' state)
      handler.startCountdownTimer(matchResult.matchId);
      
      // Should not create timer
      assert.strictEqual(handler.countdownTimers.has(matchResult.matchId), false);
    });

    test('should clear countdown timer', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      
      // Manually create a timer
      const timer = setInterval(() => {}, 1000);
      handler.countdownTimers.set('test-match', timer);
      
      // Clear the timer
      handler.clearCountdownTimer('test-match');
      
      // Verify timer was removed
      assert.strictEqual(handler.countdownTimers.has('test-match'), false);
    });

    test('should handle clearing non-existent timer gracefully', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      
      // Try to clear non-existent timer (should not throw)
      handler.clearCountdownTimer('nonexistent-match');
      
      // Should complete without error
      assert.ok(true);
    });
  });

  describe('Match Chat Handling', () => {
    test('should handle valid match chat message', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Add player to match first
      handler.handleJoinMatch(mockSocket, { playerName: 'TestPlayer' });
      mockSocket.clearEmittedEvents();
      mockIO.clearEmittedEvents();
      
      // Send chat message
      handler.handleMatchChat(mockSocket, { text: 'Hello world!' });
      
      // Check for matchChatMessage broadcast
      const ioEvents = mockIO.getEmittedEvents();
      const chatMessage = ioEvents.find(e => e.event === 'matchChatMessage');
      assert.ok(chatMessage);
      assert.strictEqual(chatMessage.data.playerId, 'player1');
      assert.strictEqual(chatMessage.data.playerName, 'TestPlayer');
      assert.strictEqual(chatMessage.data.text, 'Hello world!');
      assert.ok(chatMessage.data.matchId);
    });

    test('should reject invalid chat message', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Add player to match first
      handler.handleJoinMatch(mockSocket, { playerName: 'TestPlayer' });
      mockSocket.clearEmittedEvents();
      
      // Send invalid message (no text)
      handler.handleMatchChat(mockSocket, {});
      
      const events = mockSocket.getEmittedEvents();
      const errorEvent = events.find(e => e.event === 'error');
      assert.ok(errorEvent);
      assert.ok(errorEvent.data.message);
    });

    test('should reject chat from player not in match', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Try to send chat without being in a match
      handler.handleMatchChat(mockSocket, { text: 'Hello!' });
      
      const events = mockSocket.getEmittedEvents();
      const errorEvent = events.find(e => e.event === 'error');
      assert.ok(errorEvent);
      assert.match(errorEvent.data.message, /not.*in.*any.*match/i);
    });
  });

  describe('Match Movement Handling', () => {
    test('should handle movement request for active match', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Add player to match and set to active
      handler.handleJoinMatch(mockSocket, { playerName: 'TestPlayer' });
      const matchId = mockMatchManager.getPlayerMatchId('player1');
      const match = mockMatchManager.getMatch(matchId);
      match.state = 'active';
      
      mockSocket.clearEmittedEvents();
      
      // Try movement
      handler.handleMatchMovement(mockSocket, { direction: 'north' });
      
      // Should get game master message (even if movement fails due to room system)
      const events = mockSocket.getEmittedEvents();
      const gmMessage = events.find(e => e.event === 'gameMasterMessage');
      assert.ok(gmMessage);
    });

    test('should reject movement when match not active', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Add player to match (state will be 'waiting' or 'countdown')
      handler.handleJoinMatch(mockSocket, { playerName: 'TestPlayer' });
      mockSocket.clearEmittedEvents();
      
      // Try movement
      handler.handleMatchMovement(mockSocket, { direction: 'north' });
      
      const events = mockSocket.getEmittedEvents();
      const gmMessage = events.find(e => e.event === 'gameMasterMessage');
      assert.ok(gmMessage);
      assert.match(gmMessage.data.text, /movement.*not.*allowed/i);
    });

    test('should reject movement from player not in match', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Try movement without being in a match
      handler.handleMatchMovement(mockSocket, { direction: 'north' });
      
      const events = mockSocket.getEmittedEvents();
      const errorEvent = events.find(e => e.event === 'error');
      assert.ok(errorEvent);
      assert.match(errorEvent.data.message, /not.*in.*any.*match/i);
    });

    test('should handle movement without direction', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Add player to match and set to active
      handler.handleJoinMatch(mockSocket, { playerName: 'TestPlayer' });
      const matchId = mockMatchManager.getPlayerMatchId('player1');
      const match = mockMatchManager.getMatch(matchId);
      match.state = 'active';
      
      mockSocket.clearEmittedEvents();
      
      // Try movement without direction
      handler.handleMatchMovement(mockSocket, {});
      
      const events = mockSocket.getEmittedEvents();
      const gmMessage = events.find(e => e.event === 'gameMasterMessage');
      assert.ok(gmMessage);
      assert.match(gmMessage.data.text, /go.*where.*specify.*direction/i);
    });
  });

  describe('Match Reconnection Handling', () => {
    test('should handle reconnection with valid session', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // First, join a match to create session
      handler.handleJoinMatch(mockSocket, { playerName: 'TestPlayer' });
      const matchId = mockMatchManager.getPlayerMatchId('player1');
      
      // Clear events and simulate reconnection
      mockSocket.clearEmittedEvents();
      
      const reconnectData = {
        matchId: matchId,
        playerId: 'player1',
        sessionToken: null // Will use match manager validation
      };
      
      handler.handleReconnectToMatch(mockSocket, reconnectData);
      
      // Should get reconnection success
      const events = mockSocket.getEmittedEvents();
      const reconnectSuccess = events.find(e => e.event === 'reconnectionSuccess');
      assert.ok(reconnectSuccess);
      assert.strictEqual(reconnectSuccess.data.matchId, matchId);
      assert.strictEqual(reconnectSuccess.data.playerId, 'player1');
    });

    test('should reject invalid reconnection session', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      const invalidReconnectData = {
        matchId: 'invalid-match',
        playerId: 'player1',
        sessionToken: null
      };
      
      handler.handleReconnectToMatch(mockSocket, invalidReconnectData);
      
      const events = mockSocket.getEmittedEvents();
      const sessionInvalid = events.find(e => e.event === 'sessionInvalid');
      assert.ok(sessionInvalid);
      assert.match(sessionInvalid.data.message, /session.*expired.*invalid/i);
    });
  });

  describe('Match Cleanup Handling', () => {
    test('should handle match cleanup', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      
      // Create a countdown timer to be cleaned up
      const timer = setInterval(() => {}, 1000);
      handler.countdownTimers.set('test-match', timer);
      
      // Perform cleanup
      handler.handleMatchCleanup('test-match');
      
      // Timer should be cleared
      assert.strictEqual(handler.countdownTimers.has('test-match'), false);
      
      // Should emit matchClosed event
      const ioEvents = mockIO.getEmittedEvents();
      const matchClosed = ioEvents.find(e => e.event === 'matchClosed');
      assert.ok(matchClosed);
      assert.match(matchClosed.data.message, /match.*closed/i);
    });
  });

  describe('Statistics', () => {
    test('should generate handler statistics', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      
      // Add some active countdowns
      handler.countdownTimers.set('match1', setInterval(() => {}, 1000));
      handler.countdownTimers.set('match2', setInterval(() => {}, 1000));
      
      const stats = handler.getStats();
      
      assert.strictEqual(stats.activeCountdowns, 2);
      assert.ok(stats.matchManagerStats);
      assert.ok(typeof stats.matchManagerStats.totalMatches === 'number');
      
      // Clean up timers
      handler.clearCountdownTimer('match1');
      handler.clearCountdownTimer('match2');
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully in join match', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Test with invalid data that might cause errors
      handler.handleJoinMatch(mockSocket, null);
      
      const events = mockSocket.getEmittedEvents();
      const errorEvent = events.find(e => e.event === 'error');
      assert.ok(errorEvent);
      assert.ok(errorEvent.data.message);
    });

    test('should handle errors gracefully in chat handling', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Test with invalid data
      handler.handleMatchChat(mockSocket, null);
      
      const events = mockSocket.getEmittedEvents();
      const errorEvent = events.find(e => e.event === 'error');
      assert.ok(errorEvent);
      assert.ok(errorEvent.data.message);
    });

    test('should handle errors gracefully in movement handling', () => {
      const mockIO = createMockIO();
      const mockMatchManager = new MatchManager();
      const handler = new MatchHandler(mockIO, mockMatchManager);
      const mockSocket = createMockSocket('player1');
      
      // Test error handling - socket should always get some response
      handler.handleMatchMovement(mockSocket, { direction: 'invalid' });
      
      // Should handle gracefully (either error or game master message)
      const events = mockSocket.getEmittedEvents();
      assert.ok(events.length > 0);
    });
  });
});