const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

const MatchManager = require('../../src/game/MatchManager.js');
const socketHandlers = require('../../src/handlers/socketHandlers.js');
const { SOCKET_EVENTS } = require('../../src/utils/constants.js');

describe('Room Info Request', () => {
  let server;
  let io;
  let matchManager;
  let clientSocket;
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
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }

    // Close server
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test('server responds with room data when roomInfo received', async () => {
    // Create client connection
    clientSocket = new Client(`http://localhost:${serverPort}`);

    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });

    // Join a match first
    const joinPromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.MATCH_JOINED, (data) => {
        resolve(data);
      });
    });

    clientSocket.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'TestPlayer' });
    await joinPromise;

    // Now test room info request
    const roomUpdatePromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.ROOM_UPDATE, (data) => {
        resolve(data);
      });
    });

    // Emit roomInfo event
    clientSocket.emit(SOCKET_EVENTS.ROOM_INFO, {});
    const roomData = await roomUpdatePromise;

    // Verify room data structure
    assert.ok(roomData.room, 'Room data should be present');
    assert.ok(roomData.room.name, 'Room should have a name');
    assert.ok(roomData.room.description, 'Room should have a description');
    assert.ok(Array.isArray(roomData.playersInRoom), 'playersInRoom should be an array');
    assert.ok(typeof roomData.description === 'string', 'description should be a string');
  });

  test('handles player not found error gracefully', async () => {
    // Create client connection but don't join match
    clientSocket = new Client(`http://localhost:${serverPort}`);

    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });

    // Test room info request without joining match
    const errorPromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.ERROR, (data) => {
        resolve(data);
      });
    });

    clientSocket.emit(SOCKET_EVENTS.ROOM_INFO, {});
    const errorData = await errorPromise;

    // Verify error handling
    assert.strictEqual(errorData.code, 'PLAYER_NOT_FOUND');
    assert.strictEqual(errorData.message, 'Player not found');
  });

  test('room description appears on match start after requestRoomUpdate', async () => {
    // Create client connection
    clientSocket = new Client(`http://localhost:${serverPort}`);

    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });

    // Join match
    const joinPromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.MATCH_JOINED, resolve);
    });

    clientSocket.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'TestPlayer' });
    await joinPromise;

    // Wait for match to start (need second player)
    const client2 = new Client(`http://localhost:${serverPort}`);
    await new Promise((resolve) => {
      client2.on('connect', resolve);
    });

    const matchStartPromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.MATCH_STARTED, resolve);
    });

    client2.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'Player2' });
    await matchStartPromise;

    // Test room info request after match start
    const roomUpdatePromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.ROOM_UPDATE, resolve);
    });

    clientSocket.emit(SOCKET_EVENTS.ROOM_INFO, {});
    const roomData = await roomUpdatePromise;

    // Verify room description is present and contains expected elements
    assert.ok(roomData.description.length > 0, 'Room description should not be empty');
    assert.ok(roomData.description.includes('Exit'), 'Room description should include exit information');

    // Clean up second client
    client2.disconnect();
  });

  test('room data format matches move handler format', async () => {
    // Create client connection
    clientSocket = new Client(`http://localhost:${serverPort}`);

    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });

    // Join match and start it
    const joinPromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.MATCH_JOINED, resolve);
    });

    clientSocket.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'TestPlayer' });
    await joinPromise;

    // Add second player to start match
    const client2 = new Client(`http://localhost:${serverPort}`);
    await new Promise((resolve) => {
      client2.on('connect', resolve);
    });

    const matchStartPromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.MATCH_STARTED, resolve);
    });

    client2.emit(SOCKET_EVENTS.JOIN_MATCH, { playerName: 'Player2' });
    await matchStartPromise;

    // Get room data via roomInfo
    const roomInfoPromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.ROOM_UPDATE, resolve);
    });

    clientSocket.emit(SOCKET_EVENTS.ROOM_INFO, {});
    const roomInfoData = await roomInfoPromise;

    // Test a move to compare data format
    const movePromise = new Promise((resolve) => {
      clientSocket.on(SOCKET_EVENTS.ROOM_UPDATE, resolve);
    });

    clientSocket.emit(SOCKET_EVENTS.MOVE, { direction: 'north' });
    const moveData = await movePromise;

    // Compare data structures (they should have the same keys)
    assert.deepStrictEqual(Object.keys(roomInfoData).sort(), Object.keys(moveData).sort());
    assert.ok(roomInfoData.room.id, 'Room should have an id');
    assert.ok(roomInfoData.room.name, 'Room should have a name');
    assert.ok(typeof roomInfoData.room.hasWeapon === 'boolean', 'Room should have hasWeapon boolean');

    // Clean up second client
    client2.disconnect();
  });
});