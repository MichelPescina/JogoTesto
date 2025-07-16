/**
 * Integration tests for room navigation and chat functionality
 * Tests the complete flow from client commands to server responses
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const fs = require('fs');
const path = require('path');

// Import the room system for setup
const RoomSystem = require('../src/systems/roomSystem');

// Test room data for navigation testing
const navigationTestRooms = {
  'metadata': {
    'version': '1.0',
    'name': 'Navigation Test World',
    'description': 'Test rooms for navigation integration testing'
  },
  'rooms': {
    'start_room': {
      'id': 'start_room',
      'name': 'Starting Room',
      'description': 'The starting point for navigation tests. A path leads north to the test area.',
      'exits': {
        'north': {
          'destination': 'test_room',
          'keywords': ['north', 'n', 'path'],
          'description': 'Follow the path north to the test room'
        }
      },
      'commands': {
        'look': 'Examine the starting area',
        'rest': 'Take a moment to rest'
      }
    },
    'test_room': {
      'id': 'test_room',
      'name': 'Test Room',
      'description': 'A room designed for testing navigation commands. Exits lead south back to start, and east to a special area.',
      'exits': {
        'south': {
          'destination': 'start_room',
          'keywords': ['south', 's', 'back'],
          'description': 'Return south to the starting room'
        },
        'east': {
          'destination': 'special_room',
          'keywords': ['east', 'e', 'special'],
          'description': 'Enter the special testing area to the east'
        }
      },
      'commands': {
        'look': 'Examine the test room carefully',
        'test': 'Run a test command'
      }
    },
    'special_room': {
      'id': 'special_room',
      'name': 'Special Test Room',
      'description': 'A special room for advanced testing. Only exit is west back to the test room.',
      'exits': {
        'west': {
          'destination': 'test_room',
          'keywords': ['west', 'w', 'out'],
          'description': 'Exit west back to the test room'
        }
      }
    }
  }
};

describe('Navigation Integration Tests', () => {
  let httpServer;
  let io;
  let roomSystem;
  let testRoomsFile;
  const TEST_PORT = 0; // Use random available port

  beforeEach((done) => {
    // Create test rooms file
    testRoomsFile = path.join(__dirname, 'navigation_test_rooms.json');
    fs.writeFileSync(testRoomsFile, JSON.stringify(navigationTestRooms));

    // Create HTTP server and Socket.IO instance
    httpServer = createServer();
    io = new Server(httpServer);

    // Initialize room system
    roomSystem = new RoomSystem();
    roomSystem.defaultRoom = 'start_room';

    // Connected players map (simulating server state)
    const connectedPlayers = new Map();

    // Load room data
    roomSystem.loadRoomsFromJSON(testRoomsFile).then((loaded) => {
      if (!loaded) {
        done(new Error('Failed to load test room data'));
        return;
      }

      // Set up Socket.IO connection handling (simplified version of server.js)
      io.on('connection', (socket) => {
        // Store player information with room tracking
        const playerName = `TestPlayer${socket.id.substring(0, 8)}`;
        connectedPlayers.set(socket.id, {
          id: socket.id,
          name: playerName,
          connectedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          currentRoom: roomSystem.defaultRoom
        });

        // Add player to room system
        roomSystem.addPlayer(socket.id);

        // Send initial room description
        const roomDescription = roomSystem.getRoomDescription(
          roomSystem.defaultRoom,
          socket.id,
          connectedPlayers
        );

        if (roomDescription) {
          socket.emit('gameMasterMessage', {
            text: `Welcome to ${roomDescription.name}!\n\n${roomDescription.description}`,
            timestamp: new Date().toISOString()
          });
        }

        // Handle player messages (room commands)
        socket.on('playerMessage', (data) => {
          const message = data.text.trim();

          // Handle /go commands
          if (message.startsWith('/go ')) {
            handleMoveCommand(socket, message);
            return;
          }

          // Handle /look commands
          if (message.startsWith('/look') || message === '/l') {
            handleLookCommand(socket);
            return;
          }

          // Handle /chat commands
          if (message.startsWith('/chat ') || message === '/chat') {
            handleChatCommand(socket, message);
            return;
          }

          // Default: treat as regular message
          socket.emit('messageReceived', {
            playerId: socket.id,
            text: data.text,
            timestamp: new Date().toISOString()
          });
        });

        // Handle disconnection
        socket.on('disconnect', () => {
          roomSystem.removePlayer(socket.id);
          connectedPlayers.delete(socket.id);
        });

        /**
         * Handle movement commands
         */
        function handleMoveCommand(socket, message) {
          const direction = message.substring(4).trim().toLowerCase();

          if (!direction) {
            socket.emit('gameMasterMessage', {
              text: 'Go where? Please specify a direction (e.g., "/go north").',
              timestamp: new Date().toISOString()
            });
            return;
          }

          const playerData = connectedPlayers.get(socket.id);
          if (!playerData) {
            socket.emit('gameMasterMessage', {
              text: 'Player data not found. Please reconnect.',
              timestamp: new Date().toISOString()
            });
            return;
          }

          const moveResult = roomSystem.movePlayer(socket.id, direction);

          if (!moveResult.success) {
            socket.emit('gameMasterMessage', {
              text: moveResult.error,
              timestamp: new Date().toISOString()
            });
            return;
          }

          // Update player's current room
          playerData.currentRoom = moveResult.toRoom;

          // Send movement description
          socket.emit('gameMasterMessage', {
            text: moveResult.exitDescription,
            timestamp: new Date().toISOString()
          });

          // Send new room description
          const newRoomDescription = roomSystem.getRoomDescription(
            moveResult.toRoom,
            socket.id,
            connectedPlayers
          );

          if (newRoomDescription) {
            socket.emit('gameMasterMessage', {
              text: `${newRoomDescription.name}\n\n${newRoomDescription.description}`,
              timestamp: new Date().toISOString()
            });
          }

          // Emit movement success event for testing
          socket.emit('navigationSuccess', {
            fromRoom: moveResult.fromRoom,
            toRoom: moveResult.toRoom,
            direction: moveResult.direction
          });
        }

        /**
         * Handle look commands
         */
        function handleLookCommand(socket) {
          const playerRoom = roomSystem.getPlayerRoom(socket.id);
          if (!playerRoom) {
            socket.emit('gameMasterMessage', {
              text: 'You seem to be lost in the void.',
              timestamp: new Date().toISOString()
            });
            return;
          }

          const roomDescription = roomSystem.getRoomDescription(
            playerRoom,
            socket.id,
            connectedPlayers
          );

          if (roomDescription) {
            socket.emit('gameMasterMessage', {
              text: `${roomDescription.name}\n\n${roomDescription.description}`,
              timestamp: new Date().toISOString()
            });
          }
        }

        /**
         * Handle chat commands
         */
        function handleChatCommand(socket, message) {
          let chatText = '';
          if (message.startsWith('/chat ')) {
            chatText = message.substring(6).trim();
          }

          if (!chatText) {
            socket.emit('gameMasterMessage', {
              text: 'Say what? Please provide a message (e.g., "/chat Hello everyone!").',
              timestamp: new Date().toISOString()
            });
            return;
          }

          const currentRoom = roomSystem.getPlayerRoom(socket.id);
          const playersInRoom = roomSystem.getPlayersInRoom(currentRoom);
          const otherPlayersInRoom = playersInRoom.filter(playerId => playerId !== socket.id);

          if (otherPlayersInRoom.length === 0) {
            socket.emit('gameMasterMessage', {
              text: 'You speak to the empty air, but no one is here to listen.',
              timestamp: new Date().toISOString()
            });
            return;
          }

          const playerData = connectedPlayers.get(socket.id);
          const chatMessageData = {
            playerId: socket.id,
            playerName: playerData.name,
            text: chatText,
            timestamp: new Date().toISOString(),
            roomId: currentRoom,
            messageType: 'roomChat'
          };

          // Send to all players in room
          for (const playerId of playersInRoom) {
            const playerSocket = io.sockets.sockets.get(playerId);
            if (playerSocket) {
              if (playerId === socket.id) {
                playerSocket.emit('roomChatMessage', {
                  ...chatMessageData,
                  text: `You say: "${chatText}"`,
                  isSelf: true
                });
              } else {
                playerSocket.emit('roomChatMessage', {
                  ...chatMessageData,
                  text: `${playerData.name} says: "${chatText}"`,
                  isSelf: false
                });
              }
            }
          }
        }
      });

      // Start server
      httpServer.listen(TEST_PORT, () => {
        done();
      });
    }).catch(done);
  });

  afterEach((done) => {
    // Clean up
    if (fs.existsSync(testRoomsFile)) {
      fs.unlinkSync(testRoomsFile);
    }

    if (httpServer) {
      httpServer.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  describe('Single Player Navigation', () => {
    test('should receive initial room description on connection', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);

      client.on('gameMasterMessage', (data) => {
        assert.match(data.text, /Welcome to Starting Room/);
        assert.match(data.text, /starting point for navigation tests/);
        client.disconnect();
        done();
      });

      client.on('connect_error', done);
    });

    test('should handle successful movement command', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let messageCount = 0;

      client.on('gameMasterMessage', (data) => {
        messageCount++;
        if (messageCount === 1) {
          // Initial welcome message
          assert.match(data.text, /Welcome to Starting Room/);
          // Send movement command
          client.emit('playerMessage', { text: '/go north' });
        } else if (messageCount === 2) {
          // Movement description
          assert.match(data.text, /Follow the path north/);
        } else if (messageCount === 3) {
          // New room description
          assert.match(data.text, /Test Room/);
          assert.match(data.text, /room designed for testing/);
          client.disconnect();
          done();
        }
      });

      client.on('navigationSuccess', (data) => {
        assert.strictEqual(data.fromRoom, 'start_room');
        assert.strictEqual(data.toRoom, 'test_room');
        assert.strictEqual(data.direction, 'north');
      });

      client.on('connect_error', done);
    });

    test('should handle movement with keywords', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let connected = false;

      client.on('gameMasterMessage', (data) => {
        if (!connected) {
          connected = true;
          // Try moving with keyword instead of direction
          client.emit('playerMessage', { text: '/go path' });
        } else if (data.text.includes('Test Room')) {
          // Successfully moved using keyword
          assert.match(data.text, /Test Room/);
          client.disconnect();
          done();
        }
      });

      client.on('connect_error', done);
    });

    test('should handle invalid movement command', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let connected = false;

      client.on('gameMasterMessage', (data) => {
        if (!connected) {
          connected = true;
          // Try invalid movement
          client.emit('playerMessage', { text: '/go invalid' });
        } else if (data.text.includes('can\'t go')) {
          // Should receive error message
          assert.match(data.text, /can't go invalid/);
          assert.match(data.text, /Available exits: north/);
          client.disconnect();
          done();
        }
      });

      client.on('connect_error', done);
    });

    test('should handle look command', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let messageCount = 0;

      client.on('gameMasterMessage', (data) => {
        messageCount++;
        if (messageCount === 1) {
          // Initial welcome
          client.emit('playerMessage', { text: '/look' });
        } else if (messageCount === 2) {
          // Look response
          assert.match(data.text, /Starting Room/);
          assert.match(data.text, /starting point for navigation tests/);
          client.disconnect();
          done();
        }
      });

      client.on('connect_error', done);
    });

    test('should handle empty go command', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let connected = false;

      client.on('gameMasterMessage', (data) => {
        if (!connected) {
          connected = true;
          client.emit('playerMessage', { text: '/go' });
        } else if (data.text.includes('Go where?')) {
          assert.match(data.text, /Go where\? Please specify a direction/);
          client.disconnect();
          done();
        }
      });

      client.on('connect_error', done);
    });
  });

  describe('Multi-Player Navigation', () => {
    test('should show other players in room description', (done) => {
      const client1 = new Client(`http://localhost:${httpServer.address().port}`);
      const client2 = new Client(`http://localhost:${httpServer.address().port}`);
      
      let client1Ready = false;
      let client2Ready = false;

      client1.on('gameMasterMessage', (data) => {
        if (!client1Ready && data.text.includes('Welcome')) {
          client1Ready = true;
          checkBothReady();
        }
      });

      client2.on('gameMasterMessage', (data) => {
        if (!client2Ready && data.text.includes('Welcome')) {
          client2Ready = true;
          checkBothReady();
        } else if (data.text.includes('TestPlayer') && data.text.includes('is here')) {
          // Should see other player
          assert.match(data.text, /TestPlayer.*is here/);
          client1.disconnect();
          client2.disconnect();
          done();
        }
      });

      function checkBothReady() {
        if (client1Ready && client2Ready) {
          // Both connected, now client2 should look around
          client2.emit('playerMessage', { text: '/look' });
        }
      }

      client1.on('connect_error', done);
      client2.on('connect_error', done);
    });

    test('should handle room-based chat', (done) => {
      const client1 = new Client(`http://localhost:${httpServer.address().port}`);
      const client2 = new Client(`http://localhost:${httpServer.address().port}`);
      
      let client1Ready = false;
      let client2Ready = false;
      let chatReceived = false;

      client1.on('gameMasterMessage', (data) => {
        if (data.text.includes('Welcome')) {
          client1Ready = true;
          checkBothReady();
        }
      });

      client2.on('gameMasterMessage', (data) => {
        if (data.text.includes('Welcome')) {
          client2Ready = true;
          checkBothReady();
        }
      });

      client1.on('roomChatMessage', (data) => {
        if (data.isSelf) {
          assert.match(data.text, /You say: "Hello from client1"/);
        }
      });

      client2.on('roomChatMessage', (data) => {
        if (!data.isSelf) {
          assert.match(data.text, /TestPlayer.*says: "Hello from client1"/);
          chatReceived = true;
          client1.disconnect();
          client2.disconnect();
          done();
        }
      });

      function checkBothReady() {
        if (client1Ready && client2Ready && !chatReceived) {
          // Both ready, send chat message
          client1.emit('playerMessage', { text: '/chat Hello from client1' });
        }
      }

      client1.on('connect_error', done);
      client2.on('connect_error', done);
    });

    test('should handle chat in empty room', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let moved = false;

      client.on('gameMasterMessage', (data) => {
        if (data.text.includes('Welcome') && !moved) {
          // Move to test room (should be empty)
          client.emit('playerMessage', { text: '/go north' });
          moved = true;
        } else if (data.text.includes('Test Room') && moved) {
          // Now in test room, try to chat
          client.emit('playerMessage', { text: '/chat Hello empty room' });
        } else if (data.text.includes('speak to the empty air')) {
          // Should get empty room message
          assert.match(data.text, /speak to the empty air.*no one is here/);
          client.disconnect();
          done();
        }
      });

      client.on('connect_error', done);
    });
  });

  describe('Complex Navigation Scenarios', () => {
    test('should handle multi-step navigation', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let step = 0;
      const expectedRooms = ['start_room', 'test_room', 'special_room', 'test_room', 'start_room'];

      client.on('gameMasterMessage', (data) => {
        if (data.text.includes('Welcome')) {
          step = 1;
          client.emit('playerMessage', { text: '/go north' });
        }
      });

      client.on('navigationSuccess', (data) => {
        assert.strictEqual(data.fromRoom, expectedRooms[step - 1]);
        assert.strictEqual(data.toRoom, expectedRooms[step]);
        
        step++;
        
        if (step === 2) {
          // Now in test_room, go east
          client.emit('playerMessage', { text: '/go east' });
        } else if (step === 3) {
          // Now in special_room, go back west
          client.emit('playerMessage', { text: '/go west' });
        } else if (step === 4) {
          // Back in test_room, go south
          client.emit('playerMessage', { text: '/go south' });
        } else if (step === 5) {
          // Back to start - test complete
          assert.strictEqual(data.toRoom, 'start_room');
          client.disconnect();
          done();
        }
      });

      client.on('connect_error', done);
    });

    test('should handle case-insensitive commands', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let connected = false;

      client.on('gameMasterMessage', (data) => {
        if (!connected && data.text.includes('Welcome')) {
          connected = true;
          // Try uppercase command
          client.emit('playerMessage', { text: '/GO NORTH' });
        }
      });

      client.on('navigationSuccess', (data) => {
        assert.strictEqual(data.toRoom, 'test_room');
        client.disconnect();
        done();
      });

      client.on('connect_error', done);
    });

    test('should handle abbreviated look command', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let connected = false;

      client.on('gameMasterMessage', (data) => {
        if (!connected && data.text.includes('Welcome')) {
          connected = true;
          // Try abbreviated look command
          client.emit('playerMessage', { text: '/l' });
        } else if (connected && data.text.includes('Starting Room')) {
          // Should work the same as /look
          assert.match(data.text, /Starting Room/);
          client.disconnect();
          done();
        }
      });

      client.on('connect_error', done);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed commands gracefully', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let connected = false;

      client.on('gameMasterMessage', (data) => {
        if (!connected && data.text.includes('Welcome')) {
          connected = true;
          // Send empty chat command
          client.emit('playerMessage', { text: '/chat' });
        } else if (data.text.includes('Say what?')) {
          assert.match(data.text, /Say what\? Please provide a message/);
          client.disconnect();
          done();
        }
      });

      client.on('connect_error', done);
    });

    test('should handle invalid command format', (done) => {
      const client = new Client(`http://localhost:${httpServer.address().port}`);
      let connected = false;

      client.on('gameMasterMessage', (data) => {
        if (!connected && data.text.includes('Welcome')) {
          connected = true;
          // Send command with just /go and spaces
          client.emit('playerMessage', { text: '/go   ' });
        } else if (data.text.includes('Go where?')) {
          assert.match(data.text, /Go where\?/);
          client.disconnect();
          done();
        }
      });

      client.on('connect_error', done);
    });
  });
});