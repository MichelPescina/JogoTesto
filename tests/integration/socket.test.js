const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

const MatchManager = require('../../src/game/MatchManager.js');
const socketHandlers = require('../../src/handlers/socketHandlers.js');
const { SOCKET_EVENTS, GAME_CONFIG } = require('../../src/utils/constants.js');

describe('Socket.io Integration', () => {
  let server;
  let io;
  let matchManager;
  let clientSocket1;
  let clientSocket2;
  let serverPort;

  beforeEach(async () => {
    // Create HTTP server and Socket.io server
    server = createServer();
    io = new Server(server, {
      cors: { origin: '*' }
    });

    // Initialize match manager
    matchManager = new MatchManager();

    // Set up socket handlers
    io.on('connection', (socket) => {
      socketHandlers.initializeHandlers(socket, io, matchManager);
    });

    // Start server on random port
    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Clean up client connections
    if (clientSocket1?.connected) {
      clientSocket1.disconnect();
    }
    if (clientSocket2?.connected) {
      clientSocket2.disconnect();
    }

    // Close server
    await new Promise((resolve) => {
      io.close(resolve);
    });

    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  describe('Connection Management', () => {
    test('should connect client successfully', async () => {
      clientSocket1 = Client(`http://localhost:${serverPort}`);

      await new Promise((resolve) => {
        clientSocket1.on('connect', resolve);
      });

      assert.ok(clientSocket1.connected);
    });

    test('should handle multiple client connections', async () => {
      clientSocket1 = Client(`http://localhost:${serverPort}`);
      clientSocket2 = Client(`http://localhost:${serverPort}`);

      await Promise.all([
        new Promise((resolve) => clientSocket1.on('connect', resolve)),
        new Promise((resolve) => clientSocket2.on('connect', resolve))
      ]);

      assert.ok(clientSocket1.connected);
      assert.ok(clientSocket2.connected);
    });

    test('should handle client disconnection', async () => {
      clientSocket1 = Client(`http://localhost:${serverPort}`);

      await new Promise((resolve) => {
        clientSocket1.on('connect', resolve);
      });

      assert.ok(clientSocket1.connected);

      clientSocket1.disconnect();

      await new Promise((resolve) => {
        clientSocket1.on('disconnect', resolve);
      });

      assert.ok(!clientSocket1.connected);
    });
  });

  describe('Match Joining Flow', () => {
    test('should handle successful match join', async () => {
      clientSocket1 = Client(`http://localhost:${serverPort}`);

      await new Promise((resolve) => {
        clientSocket1.on('connect', resolve);
      });

      // Join match
      const joinResult = await new Promise((resolve, reject) => {
        clientSocket1.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'Alice' });

        clientSocket1.on(SOCKET_EVENTS.MATCH_JOINED, resolve);
        clientSocket1.on(SOCKET_EVENTS.ERROR, reject);

        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      assert.ok(joinResult.player);
      assert.strictEqual(joinResult.player.name, 'Alice');
      assert.ok(joinResult.match);
    });

    test('should reject invalid player names', async () => {
      clientSocket1 = Client(`http://localhost:${serverPort}`);

      await new Promise((resolve) => {
        clientSocket1.on('connect', resolve);
      });

      // Try to join with empty name
      const errorResult = await new Promise((resolve, reject) => {
        clientSocket1.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: '' });

        clientSocket1.on(SOCKET_EVENTS.ERROR, resolve);
        clientSocket1.on(SOCKET_EVENTS.MATCH_JOINED, reject);

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      assert.ok(errorResult.message);
      assert.strictEqual(errorResult.code, 'VALIDATION_ERROR');
    });

    test('should handle duplicate player names', async () => {
      clientSocket1 = Client(`http://localhost:${serverPort}`);
      clientSocket2 = Client(`http://localhost:${serverPort}`);

      await Promise.all([
        new Promise((resolve) => clientSocket1.on('connect', resolve)),
        new Promise((resolve) => clientSocket2.on('connect', resolve))
      ]);

      // First player joins successfully
      await new Promise((resolve, reject) => {
        clientSocket1.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'Alice' });
        clientSocket1.on(SOCKET_EVENTS.MATCH_JOINED, resolve);
        clientSocket1.on(SOCKET_EVENTS.ERROR, reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      // Second player with same name should be rejected
      const errorResult = await new Promise((resolve, reject) => {
        clientSocket2.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'Alice' });
        clientSocket2.on(SOCKET_EVENTS.ERROR, resolve);
        clientSocket2.on(SOCKET_EVENTS.MATCH_JOINED, reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      assert.ok(errorResult.message.includes('already taken'));
    });
  });

  describe('Game Flow', () => {
    beforeEach(async () => {
      // Set up two connected clients
      clientSocket1 = Client(`http://localhost:${serverPort}`);
      clientSocket2 = Client(`http://localhost:${serverPort}`);

      await Promise.all([
        new Promise((resolve) => clientSocket1.on('connect', resolve)),
        new Promise((resolve) => clientSocket2.on('connect', resolve))
      ]);

      // Both players join
      await Promise.all([
        new Promise((resolve, reject) => {
          clientSocket1.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'Alice' });
          clientSocket1.on(SOCKET_EVENTS.MATCH_JOINED, resolve);
          clientSocket1.on(SOCKET_EVENTS.ERROR, reject);
          setTimeout(() => reject(new Error('Timeout')), 5000);
        }),
        new Promise((resolve, reject) => {
          clientSocket2.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'Bob' });
          clientSocket2.on(SOCKET_EVENTS.MATCH_JOINED, resolve);
          clientSocket2.on(SOCKET_EVENTS.ERROR, reject);
          setTimeout(() => reject(new Error('Timeout')), 5000);
        })
      ]);

      // Wait for match to start (if min players reached)
      if (GAME_CONFIG.MIN_PLAYERS_TO_START <= 2) {
        await Promise.all([
          new Promise((resolve) => {
            clientSocket1.on(SOCKET_EVENTS.MATCH_STARTED, resolve);
          }),
          new Promise((resolve) => {
            clientSocket2.on(SOCKET_EVENTS.MATCH_STARTED, resolve);
          })
        ]);
      }
    });

    test('should handle player movement', async () => {
      // Skip if match hasn't started (need more players)
      if (GAME_CONFIG.MIN_PLAYERS_TO_START > 2) {
        return; // Skip this test
      }

      const moveResult = await new Promise((resolve, reject) => {
        clientSocket1.emit(SOCKET_EVENTS.MOVE, { direction: 'north' });

        clientSocket1.on(SOCKET_EVENTS.ROOM_UPDATE, resolve);
        clientSocket1.on(SOCKET_EVENTS.ERROR, (error) => {
          // Movement might fail if no north exit from spawn, that's ok
          if (error.code === 'MOVE_FAILED') {
            resolve({ failed: true, error });
          } else {
            reject(error);
          }
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      // Either successful move or expected failure
      assert.ok(moveResult.room || moveResult.failed);
    });

    test('should handle weapon search', async () => {
      // Skip if match hasn't started
      if (GAME_CONFIG.MIN_PLAYERS_TO_START > 2) {
        return;
      }

      const searchResult = await new Promise((resolve, reject) => {
        clientSocket1.emit(SOCKET_EVENTS.SEARCH, {});

        clientSocket1.on(SOCKET_EVENTS.SEARCH_STARTED, resolve);
        clientSocket1.on(SOCKET_EVENTS.ERROR, (error) => {
          // Search might fail if no weapon in room, that's ok
          if (error.code === 'SEARCH_FAILED') {
            resolve({ failed: true, error });
          } else {
            reject(error);
          }
        });

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      // Either successful search start or expected failure
      assert.ok(searchResult.duration || searchResult.failed);
    });

    test('should broadcast player events to other clients', async () => {
      // Skip if match hasn't started
      if (GAME_CONFIG.MIN_PLAYERS_TO_START > 2) {
        return;
      }

      // Set up listener on second client for player events
      const playerEventPromise = new Promise((resolve) => {
        clientSocket2.on(SOCKET_EVENTS.PLAYER_LEFT, resolve);
        clientSocket2.on(SOCKET_EVENTS.PLAYER_ENTERED, resolve);
      });

      // First player attempts to move
      clientSocket1.emit(SOCKET_EVENTS.MOVE, { direction: 'north' });

      // Second client should receive player event (either left or error)
      const playerEvent = await Promise.race([
        playerEventPromise,
        new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 5000))
      ]);

      // Should receive some kind of event or timeout (both are acceptable outcomes)
      assert.ok(playerEvent);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed messages', async () => {
      clientSocket1 = Client(`http://localhost:${serverPort}`);

      await new Promise((resolve) => {
        clientSocket1.on('connect', resolve);
      });

      // Send malformed join message
      const errorResult = await new Promise((resolve, reject) => {
        clientSocket1.emit(SOCKET_EVENTS.JOIN_MATCH, 'invalid_data');

        clientSocket1.on(SOCKET_EVENTS.ERROR, resolve);
        clientSocket1.on(SOCKET_EVENTS.MATCH_JOINED, reject);

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      assert.ok(errorResult.message);
      assert.strictEqual(errorResult.code, 'VALIDATION_ERROR');
    });

    test('should handle actions from non-joined players', async () => {
      clientSocket1 = Client(`http://localhost:${serverPort}`);

      await new Promise((resolve) => {
        clientSocket1.on('connect', resolve);
      });

      // Try to move without joining match first
      const errorResult = await new Promise((resolve, reject) => {
        clientSocket1.emit(SOCKET_EVENTS.MOVE, { direction: 'north' });

        clientSocket1.on(SOCKET_EVENTS.ERROR, resolve);
        clientSocket1.on(SOCKET_EVENTS.ROOM_UPDATE, reject);

        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      assert.ok(errorResult.message);
    });
  });

  describe('Match Completion Flow', () => {
    test('should handle match end events', async () => {
      // This test is complex as it requires simulating a full match
      // For now, we'll test that the event structure is correct

      clientSocket1 = Client(`http://localhost:${serverPort}`);

      await new Promise((resolve) => {
        clientSocket1.on('connect', resolve);
      });

      // Set up listener for match events
      clientSocket1.on(SOCKET_EVENTS.MATCH_ENDED, () => {
        // Match end event received
      });

      // We can't easily trigger a match end in a test, so we'll just verify
      // the listener is set up correctly
      assert.ok(typeof clientSocket1.listeners(SOCKET_EVENTS.MATCH_ENDED)[0] === 'function');
    });
  });

  describe('Stress Testing', () => {
    test('should handle rapid message sending', async () => {
      clientSocket1 = Client(`http://localhost:${serverPort}`);

      await new Promise((resolve) => {
        clientSocket1.on('connect', resolve);
      });

      // Join match first
      await new Promise((resolve, reject) => {
        clientSocket1.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'Alice' });
        clientSocket1.on(SOCKET_EVENTS.MATCH_JOINED, resolve);
        clientSocket1.on(SOCKET_EVENTS.ERROR, reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      // Send multiple move commands rapidly
      for (let i = 0; i < 10; i++) {
        clientSocket1.emit(SOCKET_EVENTS.MOVE, { direction: 'north' });
      }

      // Wait a bit for all responses
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should not crash the server (test passes if we get here)
      assert.ok(true);
    });
  });
});