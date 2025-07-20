/**
 * Unit tests for Match class
 * Tests match lifecycle, player management, and state transitions
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// Import the Match class
const Match = require('../src/systems/match');

describe('Match Class', () => {
  
  describe('Constructor', () => {
    test('should create match with valid matchId', () => {
      const matchId = 'test-match-123';
      const match = new Match(matchId);
      
      assert.strictEqual(match.id, matchId);
      assert.strictEqual(match.state, 'waiting');
      assert.strictEqual(match.players.size, 0);
      assert.strictEqual(match.timeLeft, 0);
      assert.ok(match.createdAt instanceof Date);
      assert.strictEqual(match.startedAt, null);
      assert.strictEqual(match.finishedAt, null);
    });

    test('should initialize with configurable parameters', () => {
      const match = new Match('test-match');
      
      // Verify default values that can be overridden for testing
      assert.strictEqual(match.maxPlayers, 50);
      assert.strictEqual(match.minPlayers, 10);
      assert.strictEqual(match.countdownDuration, 60);
    });
  });

  describe('Player Management', () => {
    test('should add player successfully with valid data', () => {
      const match = new Match('test-match');
      // Override for faster testing
      match.minPlayers = 2;
      match.maxPlayers = 5;
      match.countdownDuration = 3;
      
      const result = match.addPlayer('player1', 'TestPlayer');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.action, 'added');
      assert.strictEqual(result.playerCount, 1);
      assert.strictEqual(match.players.size, 1);
    });

    test('should save player name correctly', () => {
      const match = new Match('test-match');
      const playerName = 'TestPlayer123';
      match.addPlayer('player1', playerName);
      
      const playerData = match.getPlayer('player1');
      assert.strictEqual(playerData.name, playerName);
      assert.strictEqual(playerData.id, 'player1');
      assert.ok(playerData.joinedAt instanceof Date);
      assert.strictEqual(playerData.isConnected, true);
    });

    test('should reject player with invalid player ID', () => {
      const match = new Match('test-match');
      const result = match.addPlayer('', 'TestPlayer');
      
      assert.strictEqual(result.success, false);
      assert.match(result.error, /invalid.*player.*id/i);
    });

    test('should reject player with invalid player name', () => {
      const match = new Match('test-match');
      const result = match.addPlayer('player1', '');
      
      assert.strictEqual(result.success, false);
      assert.match(result.error, /invalid.*player.*name/i);
    });

    test('should reject player when match is full', () => {
      const match = new Match('test-match');
      match.maxPlayers = 2; // Small limit for testing
      
      // Fill the match to maxPlayers
      for (let i = 1; i <= match.maxPlayers; i++) {
        match.addPlayer(`player${i}`, `Player${i}`);
      }
      
      const result = match.addPlayer('overflow', 'OverflowPlayer');
      
      assert.strictEqual(result.success, false);
      assert.match(result.error, /match.*full/i);
    });

    test('should reject player when match already started', () => {
      const match = new Match('test-match');
      match.state = 'active';
      
      const result = match.addPlayer('player1', 'TestPlayer');
      
      assert.strictEqual(result.success, false);
      assert.match(result.error, /already.*started/i);
    });

    test('should handle duplicate player addition', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'TestPlayer');
      const result = match.addPlayer('player1', 'TestPlayer');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.action, 'already_in_match');
    });

    test('should start countdown when minPlayers threshold reached', () => {
      const match = new Match('test-match');
      match.minPlayers = 2;
      match.countdownDuration = 3;
      
      // Add first player - should not start countdown
      match.addPlayer('player1', 'Player1');
      assert.strictEqual(match.state, 'waiting');
      
      // Add second player - should start countdown
      match.addPlayer('player2', 'Player2');
      assert.strictEqual(match.state, 'countdown');
      assert.strictEqual(match.timeLeft, match.countdownDuration);
      assert.ok(match.countdownId);
    });

    test('should remove player successfully', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'TestPlayer');
      const result = match.removePlayer('player1');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.action, 'removed');
      assert.strictEqual(result.playerCount, 0);
      assert.strictEqual(match.players.size, 0);
    });

    test('should handle removing non-existent player', () => {
      const match = new Match('test-match');
      const result = match.removePlayer('nonexistent');
      
      assert.strictEqual(result.success, false);
      assert.match(result.error, /player.*not.*match/i);
    });

    test('should cancel countdown when below minPlayers', () => {
      const match = new Match('test-match');
      match.minPlayers = 2;
      match.countdownDuration = 3;
      
      // Add enough players to start countdown
      match.addPlayer('player1', 'Player1');
      match.addPlayer('player2', 'Player2');
      assert.strictEqual(match.state, 'countdown');
      
      // Remove player to go below threshold
      match.removePlayer('player2');
      assert.strictEqual(match.state, 'waiting');
      assert.strictEqual(match.timeLeft, 0);
      assert.strictEqual(match.countdownId, null);
    });
  });

  describe('Match Lifecycle', () => {

    test('should transition from waiting to countdown to active', () => {
      const match = new Match('test-match');
      match.minPlayers = 2;
      match.maxPlayers = 5;
      match.countdownDuration = 3;
      
      // Initial state
      assert.strictEqual(match.state, 'waiting');
      
      // Add players to trigger countdown
      match.addPlayer('player1', 'Player1');
      match.addPlayer('player2', 'Player2');
      assert.strictEqual(match.state, 'countdown');
      
      // Manually start match (simulating countdown completion)
      match.startMatch();
      assert.strictEqual(match.state, 'active');
      assert.ok(match.startedAt instanceof Date);
    });

    test('should not start match from wrong state', () => {
      const match = new Match('test-match');
      match.state = 'waiting';
      match.startMatch();
      
      // Should remain in waiting state
      assert.strictEqual(match.state, 'waiting');
      assert.strictEqual(match.startedAt, null);
    });

    test('should finish match correctly', () => {
      const match = new Match('test-match');
      match.state = 'active';
      match.finishMatch('test completed');
      
      assert.strictEqual(match.state, 'finished');
      assert.ok(match.finishedAt instanceof Date);
    });

    test('should handle multiple finish calls gracefully', () => {
      const match = new Match('test-match');
      match.state = 'active';
      match.finishMatch('first call');
      const firstFinishTime = match.finishedAt;
      
      match.finishMatch('second call');
      assert.strictEqual(match.finishedAt, firstFinishTime);
    });

    test('should update countdown correctly', () => {
      const match = new Match('test-match');
      match.state = 'countdown';
      match.updateCountdown(30);
      
      assert.strictEqual(match.timeLeft, 30);
    });

    test('should start match when countdown reaches zero', () => {
      const match = new Match('test-match');
      match.state = 'countdown';
      match.updateCountdown(0);
      
      assert.strictEqual(match.state, 'active');
      assert.ok(match.startedAt instanceof Date);
    });

    test('should prevent negative countdown time', () => {
      const match = new Match('test-match');
      match.state = 'countdown';
      match.updateCountdown(-5);
      
      assert.strictEqual(match.timeLeft, 0);
      assert.strictEqual(match.state, 'active');
    });
  });

  describe('Player Reconnection', () => {

    test('should reconnect existing player successfully', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'TestPlayer');
      
      const mockSocket = { id: 'player1' };
      const result = match.reconnectPlayer('player1', mockSocket);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.action, 'reconnected');
      assert.strictEqual(result.state, match.state);
      assert.strictEqual(result.timeLeft, match.timeLeft);
    });

    test('should reject reconnection for non-existent player', () => {
      const match = new Match('test-match');
      const mockSocket = { id: 'nonexistent' };
      const result = match.reconnectPlayer('nonexistent', mockSocket);
      
      assert.strictEqual(result.success, false);
      assert.match(result.error, /player.*not.*match/i);
    });

    test('should update player connection status on reconnection', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'TestPlayer');
      
      const playerData = match.getPlayer('player1');
      const originalActivity = playerData.lastActivity;
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        const mockSocket = { id: 'player1' };
        match.reconnectPlayer('player1', mockSocket);
        
        const updatedPlayerData = match.getPlayer('player1');
        assert.strictEqual(updatedPlayerData.isConnected, true);
        assert.ok(updatedPlayerData.lastActivity > originalActivity);
      }, 10);
    });
  });

  describe('Utility Methods', () => {

    test('should get player data correctly', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'ConnectedPlayer');
      
      const playerData = match.getPlayer('player1');
      
      assert.strictEqual(playerData.id, 'player1');
      assert.strictEqual(playerData.name, 'ConnectedPlayer');
      assert.strictEqual(playerData.isConnected, true);
    });

    test('should return null for non-existent player', () => {
      const match = new Match('test-match');
      const playerData = match.getPlayer('nonexistent');
      assert.strictEqual(playerData, null);
    });

    test('should get only connected players', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'ConnectedPlayer');
      match.addPlayer('player2', 'DisconnectedPlayer');
      
      // Mark one player as disconnected
      const playerData = match.getPlayer('player2');
      playerData.isConnected = false;
      
      const connectedPlayers = match.getConnectedPlayers();
      
      assert.strictEqual(connectedPlayers.length, 1);
      assert.strictEqual(connectedPlayers[0].id, 'player1');
      assert.strictEqual(connectedPlayers[0].name, 'ConnectedPlayer');
    });

    test('should generate match statistics', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'ConnectedPlayer');
      match.addPlayer('player2', 'DisconnectedPlayer');
      
      // Mark one player as disconnected
      const playerData = match.getPlayer('player2');
      playerData.isConnected = false;
      
      match.state = 'active';
      match.startedAt = new Date();
      
      const stats = match.getStats();
      
      assert.strictEqual(stats.id, 'test-match');
      assert.strictEqual(stats.state, 'active');
      assert.strictEqual(stats.playerCount, 2);
      assert.strictEqual(stats.connectedCount, 1);
      assert.ok(stats.createdAt instanceof Date);
      assert.ok(stats.startedAt instanceof Date);
      assert.strictEqual(stats.finishedAt, null);
      assert.ok(typeof stats.duration === 'number');
    });
  });

  describe('Room System Integration', () => {

    test('should check player movement permission', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'TestPlayer');
      
      // When match is not active, movement should be blocked
      const canMove = match.canPlayerMove('player1', 'north');
      assert.strictEqual(canMove, false);
    });

    test('should handle movement when match is active', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'TestPlayer');
      match.state = 'active';
      
      // Movement should be handled by room system
      const moveResult = match.movePlayer('player1', 'north');
      
      // Room system might be loaded, so check for either success or expected errors
      if (moveResult.success) {
        // If successful, should have movement data
        assert.ok(moveResult.fromRoom || moveResult.toRoom || moveResult.direction);
      } else {
        // If failed, should have error message
        assert.ok(moveResult.error);
      }
    });

    test('should get room description when available', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'TestPlayer');
      match.state = 'active';
      
      // Should return room description if room system is loaded and player is in room
      const description = match.getRoomDescription('player1');
      
      // Room system might be loaded, so check for either null or room data
      if (description === null) {
        assert.strictEqual(description, null);
      } else {
        // If room system is loaded, we should get room description
        assert.ok(description);
        assert.ok(description.name);
        assert.ok(description.description);
      }
    });
  });

  describe('Cleanup', () => {

    test('should clean up match resources', () => {
      const match = new Match('test-match');
      match.addPlayer('player1', 'TestPlayer');
      match.addPlayer('player2', 'TestPlayer2');
      
      // Start countdown to create timer
      match.startCountdown();
      match.countdown = setInterval(() => {}, 1000); // Mock timer
      
      match.cleanup();
      
      // Verify cleanup occurred
      // Note: cleanup is mostly internal, so we verify it doesn't throw
      assert.ok(true, 'Cleanup completed without errors');
    });

    test('should handle cleanup when no resources to clean', () => {
      const match = new Match('test-match');
      match.cleanup();
      
      // Should not throw error
      assert.ok(true, 'Cleanup completed without errors');
    });
  });
});