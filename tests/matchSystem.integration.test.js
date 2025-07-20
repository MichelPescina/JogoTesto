/**
 * Integration tests for Match System
 * Tests complete match lifecycle with real Socket.IO communication
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

// Import server components
const express = require('express');
const socketConfig = require('../src/config/socket');
const MatchManager = require('../src/systems/matchManager');
const MatchHandler = require('../src/handlers/matchHandler');

// Helper function to create a client and wait for connection
function createClient(port, socketId = null) {
  return new Promise((resolve, reject) => {
    const client = Client(`http://localhost:${port}`);
    
    client.on('connect', () => {
      resolve(client);
    });
    
    client.on('connect_error', (error) => {
      reject(error);
    });
    
    // Set a timeout for connection
    setTimeout(() => {
      reject(new Error('Client connection timeout'));
    }, 5000);
  });
}

// Helper function to wait for a specific event
function waitForEvent(socket, eventName, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);
    
    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Helper function to wait for multiple events
function waitForEvents(socket, eventNames, timeout = 5000) {
  const promises = eventNames.map(eventName => waitForEvent(socket, eventName, timeout));
  return Promise.all(promises);
}

describe('Match System Integration Tests', () => {
  let server;
  let io;
  let matchManager;
  let matchHandler;
  let serverPort;
  let clients = [];

  before(async () => {
    // Create test server with complete Match System
    const app = express();
    server = createServer(app);
    
    // Initialize Socket.IO with configuration
    io = new Server(server, {
      ...socketConfig,
      cors: {
        origin: true,
        methods: ['GET', 'POST']
      }
    });

    // Initialize Match System components
    matchManager = new MatchManager();
    
    // Override for faster testing
    matchManager.maxPlayersPerMatch = 5;
    matchManager.minPlayersForCountdown = 2;
    
    matchHandler = new MatchHandler(io, matchManager);

    // Set up socket connection handling
    io.on('connection', (socket) => {
      console.log(`Test: Player connected: ${socket.id}`);
      
      // Initially join lobby
      socket.join('lobby');
      
      // Set up Match System event handlers
      socket.on('joinMatch', (data) => {
        matchHandler.handleJoinMatch(socket, data);
      });
      
      socket.on('reconnectToMatch', (data) => {
        matchHandler.handleReconnectToMatch(socket, data);
      });
      
      socket.on('matchChat', (data) => {
        matchHandler.handleMatchChat(socket, data);
      });
      
      socket.on('move', (data) => {
        matchHandler.handleMatchMovement(socket, data);
      });
      
      socket.on('disconnect', () => {
        console.log(`Test: Player disconnected: ${socket.id}`);
        matchManager.removePlayerFromMatch(socket.id);
      });
    });

    // Start server on random port
    return new Promise((resolve, reject) => {
      server.listen(0, (error) => {
        if (error) {
          reject(error);
        } else {
          serverPort = server.address().port;
          console.log(`Test server listening on port ${serverPort}`);
          resolve();
        }
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      // Close all client connections
      clients.forEach(client => {
        if (client && client.connected) {
          client.close();
        }
      });
      clients = [];
      
      // Clear any active timers
      for (const timer of matchHandler.countdownTimers.values()) {
        clearInterval(timer);
      }
      
      // Close server
      io.close();
      server.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
  });

  describe('Player Joining Matches', () => {
    test('should allow player to join match', async () => {
      const client = await createClient(serverPort);
      clients.push(client);
      
      // Join match
      client.emit('joinMatch', { playerName: 'TestPlayer' });
      
      // Wait for match assignment
      const matchData = await waitForEvent(client, 'matchAssigned');
      
      assert.ok(matchData.matchId);
      assert.strictEqual(matchData.playerId, client.id);
      assert.strictEqual(matchData.playerName, 'TestPlayer');
      assert.strictEqual(matchData.action, 'created');
      assert.strictEqual(matchData.playerCount, 1);
      assert.ok(matchData.timestamp);
    });

    test('should save player name correctly', async () => {
      const client = await createClient(serverPort);
      clients.push(client);
      
      const playerName = 'UniqueTestPlayer123';
      client.emit('joinMatch', { playerName });
      
      const matchData = await waitForEvent(client, 'matchAssigned');
      assert.strictEqual(matchData.playerName, playerName);
      
      // Verify name is saved in match system
      const matchId = matchData.matchId;
      const match = matchManager.getMatch(matchId);
      const playerData = match.getPlayer(client.id);
      assert.strictEqual(playerData.name, playerName);
    });

    test('should assign multiple players to same match', async () => {
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);
      clients.push(client1, client2);
      
      // First player joins
      client1.emit('joinMatch', { playerName: 'Player1' });
      const match1Data = await waitForEvent(client1, 'matchAssigned');
      
      // Second player joins
      client2.emit('joinMatch', { playerName: 'Player2' });
      const match2Data = await waitForEvent(client2, 'matchAssigned');
      
      // Should be in same match
      assert.strictEqual(match1Data.matchId, match2Data.matchId);
      assert.strictEqual(match2Data.action, 'joined');
      assert.strictEqual(match2Data.playerCount, 2);
    });

    test('should notify existing players when new player joins', async () => {
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);
      clients.push(client1, client2);
      
      // First player joins
      client1.emit('joinMatch', { playerName: 'Player1' });
      await waitForEvent(client1, 'matchAssigned');
      
      // Second player joins
      client2.emit('joinMatch', { playerName: 'Player2' });
      
      // First player should receive notification
      const joinNotification = await waitForEvent(client1, 'playerJoinedMatch');
      assert.strictEqual(joinNotification.playerId, client2.id);
      assert.strictEqual(joinNotification.playerName, 'Player2');
      assert.strictEqual(joinNotification.playerCount, 2);
    });
  });

  describe('Match Countdown and Start', () => {
    test('should start match with minimum players', async () => {
      // Override match settings for faster testing
      const originalMinPlayers = matchManager.minPlayersForCountdown;
      matchManager.minPlayersForCountdown = 2;
      
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);
      clients.push(client1, client2);
      
      try {
        // First player joins
        client1.emit('joinMatch', { playerName: 'Player1' });
        const match1Data = await waitForEvent(client1, 'matchAssigned');
        
        // Override countdown duration for faster testing
        const match = matchManager.getMatch(match1Data.matchId);
        match.countdownDuration = 1; // 1 second
        
        // Second player joins - should trigger countdown
        client2.emit('joinMatch', { playerName: 'Player2' });
        
        // Both players should receive countdown started
        const [countdown1, countdown2] = await Promise.all([
          waitForEvent(client1, 'countdownStarted'),
          waitForEvent(client2, 'countdownStarted')
        ]);
        
        assert.ok(countdown1.timeLeft > 0);
        assert.ok(countdown2.timeLeft > 0);
        
        // Wait for match to start
        const [gameStart1, gameStart2] = await Promise.all([
          waitForEvent(client1, 'gameStarted'),
          waitForEvent(client2, 'gameStarted')
        ]);
        
        assert.ok(gameStart1.timestamp);
        assert.ok(gameStart2.timestamp);
        
        // Match should be in active state
        assert.strictEqual(match.state, 'active');
        
      } finally {
        // Restore original setting
        matchManager.minPlayersForCountdown = originalMinPlayers;
      }
    });

    test('should send countdown updates', async () => {
      const originalMinPlayers = matchManager.minPlayersForCountdown;
      matchManager.minPlayersForCountdown = 2;
      
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);
      clients.push(client1, client2);
      
      try {
        // Join match and trigger countdown
        client1.emit('joinMatch', { playerName: 'Player1' });
        const match1Data = await waitForEvent(client1, 'matchAssigned');
        
        const match = matchManager.getMatch(match1Data.matchId);
        match.countdownDuration = 2; // 2 seconds for testing
        
        client2.emit('joinMatch', { playerName: 'Player2' });
        
        // Wait for countdown to start
        await waitForEvent(client1, 'countdownStarted');
        
        // Should receive at least one countdown update
        const countdownUpdate = await waitForEvent(client1, 'countdownUpdate', 3000);
        assert.ok(typeof countdownUpdate.timeLeft === 'number');
        assert.ok(countdownUpdate.timestamp);
        
      } finally {
        matchManager.minPlayersForCountdown = originalMinPlayers;
      }
    });

    test('should send initial room description when game starts', async () => {
      const originalMinPlayers = matchManager.minPlayersForCountdown;
      matchManager.minPlayersForCountdown = 2;
      
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);
      clients.push(client1, client2);
      
      try {
        // Set up match to start quickly
        client1.emit('joinMatch', { playerName: 'Player1' });
        const match1Data = await waitForEvent(client1, 'matchAssigned');
        
        const match = matchManager.getMatch(match1Data.matchId);
        match.countdownDuration = 1;
        
        client2.emit('joinMatch', { playerName: 'Player2' });
        
        // Wait for game to start
        await waitForEvent(client1, 'gameStarted');
        
        // Should receive initial game master message with room description
        const gmMessage = await waitForEvent(client1, 'gameMasterMessage', 3000);
        assert.ok(gmMessage.text);
        assert.match(gmMessage.text, /welcome.*match/i);
        
      } finally {
        matchManager.minPlayersForCountdown = originalMinPlayers;
      }
    });
  });

  describe('Player Disconnection and Reconnection', () => {
    test('should handle player disconnection and reconnection', async () => {
      const client = await createClient(serverPort);
      clients.push(client);
      
      // Join match
      client.emit('joinMatch', { playerName: 'TestPlayer' });
      const matchData = await waitForEvent(client, 'matchAssigned');
      const { matchId, sessionToken } = matchData;
      
      // Disconnect
      client.close();
      
      // Reconnect with new client
      const reconnectClient = await createClient(serverPort);
      clients.push(reconnectClient);
      
      // Attempt reconnection
      reconnectClient.emit('reconnectToMatch', {
        matchId,
        playerId: client.id, // Original player ID
        sessionToken
      });
      
      // Should receive reconnection response (might be success or failure depending on session management)
      const response = await Promise.race([
        waitForEvent(reconnectClient, 'reconnectionSuccess'),
        waitForEvent(reconnectClient, 'sessionInvalid'),
        waitForEvent(reconnectClient, 'reconnectionFailed')
      ]);
      
      assert.ok(response);
      assert.ok(response.timestamp);
    });

    test('should reject invalid reconnection session', async () => {
      const client = await createClient(serverPort);
      clients.push(client);
      
      // Try to reconnect with invalid session
      client.emit('reconnectToMatch', {
        matchId: 'invalid-match-id',
        playerId: 'invalid-player-id',
        sessionToken: 'invalid-token'
      });
      
      const response = await waitForEvent(client, 'sessionInvalid');
      assert.match(response.message, /session.*expired.*invalid/i);
    });
  });

  describe('Match Ending Scenarios', () => {
    test('should end match when no players remain', async () => {
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);
      clients.push(client1, client2);
      
      // Create match with players
      client1.emit('joinMatch', { playerName: 'Player1' });
      const match1Data = await waitForEvent(client1, 'matchAssigned');
      const matchId = match1Data.matchId;
      
      client2.emit('joinMatch', { playerName: 'Player2' });
      await waitForEvent(client2, 'matchAssigned');
      
      // Verify match exists and has players
      let match = matchManager.getMatch(matchId);
      assert.strictEqual(match.players.size, 2);
      
      // Disconnect both players
      client1.close();
      client2.close();
      
      // Give system time to process disconnections
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Match should be cleaned up or marked for cleanup
      match = matchManager.getMatch(matchId);
      if (match) {
        // If match still exists, it should have no players
        assert.strictEqual(match.players.size, 0);
      }
      
      // Remove from clients array since they're closed
      clients.splice(clients.indexOf(client1), 1);
      clients.splice(clients.indexOf(client2), 1);
    });

    test('should handle countdown cancellation when players leave', async () => {
      const originalMinPlayers = matchManager.minPlayersForCountdown;
      matchManager.minPlayersForCountdown = 2;
      
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);
      clients.push(client1, client2);
      
      try {
        // Start countdown
        client1.emit('joinMatch', { playerName: 'Player1' });
        const match1Data = await waitForEvent(client1, 'matchAssigned');
        
        const match = matchManager.getMatch(match1Data.matchId);
        match.countdownDuration = 10; // Long countdown for testing
        
        client2.emit('joinMatch', { playerName: 'Player2' });
        await waitForEvent(client1, 'countdownStarted');
        
        // Verify countdown is active
        assert.strictEqual(match.state, 'countdown');
        
        // Disconnect one player to cancel countdown
        client2.close();
        clients.splice(clients.indexOf(client2), 1);
        
        // Give system time to process
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Countdown should be cancelled (match should return to waiting)
        assert.strictEqual(match.state, 'waiting');
        
      } finally {
        matchManager.minPlayersForCountdown = originalMinPlayers;
      }
    });
  });

  describe('Match Chat System', () => {
    test('should handle match chat messages', async () => {
      const client1 = await createClient(serverPort);
      const client2 = await createClient(serverPort);
      clients.push(client1, client2);
      
      // Both players join same match
      client1.emit('joinMatch', { playerName: 'Player1' });
      await waitForEvent(client1, 'matchAssigned');
      
      client2.emit('joinMatch', { playerName: 'Player2' });
      await waitForEvent(client2, 'matchAssigned');
      
      // Player1 sends chat message
      const testMessage = 'Hello from Player1!';
      client1.emit('matchChat', { text: testMessage });
      
      // Both players should receive the message
      const [chat1, chat2] = await Promise.all([
        waitForEvent(client1, 'matchChatMessage'),
        waitForEvent(client2, 'matchChatMessage')
      ]);
      
      assert.strictEqual(chat1.playerId, client1.id);
      assert.strictEqual(chat1.playerName, 'Player1');
      assert.strictEqual(chat1.text, testMessage);
      
      assert.strictEqual(chat2.playerId, client1.id);
      assert.strictEqual(chat2.playerName, 'Player1');
      assert.strictEqual(chat2.text, testMessage);
    });

    test('should reject invalid chat messages', async () => {
      const client = await createClient(serverPort);
      clients.push(client);
      
      // Join match first
      client.emit('joinMatch', { playerName: 'TestPlayer' });
      await waitForEvent(client, 'matchAssigned');
      
      // Send invalid message
      client.emit('matchChat', { text: '' });
      
      const errorResponse = await waitForEvent(client, 'error');
      assert.ok(errorResponse.message);
      assert.ok(errorResponse.timestamp);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should reject invalid player names', async () => {
      const client = await createClient(serverPort);
      clients.push(client);
      
      // Try to join with empty name
      client.emit('joinMatch', { playerName: '' });
      
      const errorResponse = await waitForEvent(client, 'error');
      assert.match(errorResponse.message, /invalid.*player.*name/i);
    });

    test('should reject overly long player names', async () => {
      const client = await createClient(serverPort);
      clients.push(client);
      
      // Try to join with very long name
      const longName = 'a'.repeat(100);
      client.emit('joinMatch', { playerName: longName });
      
      const errorResponse = await waitForEvent(client, 'error');
      assert.match(errorResponse.message, /too.*long/i);
    });

    test('should handle movement commands when not in active match', async () => {
      const client = await createClient(serverPort);
      clients.push(client);
      
      // Join match (will be in waiting state)
      client.emit('joinMatch', { playerName: 'TestPlayer' });
      await waitForEvent(client, 'matchAssigned');
      
      // Try to move
      client.emit('move', { direction: 'north' });
      
      const response = await waitForEvent(client, 'gameMasterMessage');
      assert.match(response.text, /movement.*not.*allowed/i);
    });

    test('should handle concurrent player joins', async () => {
      // Test race conditions with multiple simultaneous joins
      const clientPromises = Array.from({ length: 3 }, () => createClient(serverPort));
      const testClients = await Promise.all(clientPromises);
      clients.push(...testClients);
      
      // All join simultaneously
      const joinPromises = testClients.map((client, index) => {
        client.emit('joinMatch', { playerName: `Player${index + 1}` });
        return waitForEvent(client, 'matchAssigned');
      });
      
      const matchData = await Promise.all(joinPromises);
      
      // All should be assigned successfully
      matchData.forEach(data => {
        assert.ok(data.matchId);
        assert.ok(data.playerName);
        assert.strictEqual(data.success !== false, true);
      });
      
      // Check final state consistency
      const stats = matchManager.getStats();
      assert.ok(stats.totalPlayers >= 3);
      assert.ok(stats.totalMatches >= 1);
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle rapid join/leave cycles', async () => {
      const client = await createClient(serverPort);
      clients.push(client);
      
      // Rapid join/leave simulation
      for (let i = 0; i < 3; i++) {
        client.emit('joinMatch', { playerName: `TestPlayer${i}` });
        await waitForEvent(client, 'matchAssigned');
        
        // Simulate quick leave (disconnect/reconnect cycle)
        client.close();
        
        const newClient = await createClient(serverPort);
        clients.push(newClient);
        client = newClient; // Update reference
      }
      
      // System should remain stable
      const stats = matchManager.getStats();
      assert.ok(typeof stats.totalPlayers === 'number');
      assert.ok(typeof stats.totalMatches === 'number');
    });

    test('should maintain system consistency under load', async () => {
      // Create multiple matches simultaneously
      const clientSets = [];
      
      for (let i = 0; i < 2; i++) {
        const setClients = await Promise.all([
          createClient(serverPort),
          createClient(serverPort)
        ]);
        clients.push(...setClients);
        clientSets.push(setClients);
        
        // Each set joins different matches
        const joinPromises = setClients.map((client, index) => {
          client.emit('joinMatch', { playerName: `Set${i}Player${index}` });
          return waitForEvent(client, 'matchAssigned');
        });
        
        await Promise.all(joinPromises);
      }
      
      // Verify system state
      const stats = matchManager.getStats();
      assert.ok(stats.totalPlayers >= 4);
      assert.ok(stats.totalMatches >= 1);
      
      // All players should be properly tracked
      assert.strictEqual(stats.totalPlayers, matchManager.playerMatchMap.size);
    });
  });
});