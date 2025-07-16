/**
 * Integration tests for JogoTesto server
 * Tests multi-client scenarios and real Socket.IO communication
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

// Import server components
const express = require('express');
const socketConfig = require('../src/config/socket');
const { validateMessage } = require('../src/utils/validation');

describe('Integration Tests', () => {
  let server;
  let io;
  let clientSocket1;
  let clientSocket2;
  let serverPort;

  before(async () => {
    // Create a test server
    const app = express();
    server = createServer(app);
    io = new Server(server, {
      ...socketConfig,
      cors: {
        origin: true,
        methods: ['GET', 'POST']
      }
    });

    // Set up basic server logic (simplified version of main server)
    const connectedPlayers = new Map();

    io.on('connection', (socket) => {
      console.log(`Test: Player connected: ${socket.id}`);
      
      socket.join('gameRoom');
      connectedPlayers.set(socket.id, {
        id: socket.id,
        connectedAt: new Date().toISOString()
      });

      // Notify about player count
      io.to('gameRoom').emit('playerCount', {
        count: connectedPlayers.size
      });

      socket.on('playerMessage', (data) => {
        const validationResult = validateMessage(data);
        if (!validationResult.isValid) {
          socket.emit('error', { message: validationResult.error });
          return;
        }

        const messageData = {
          playerId: socket.id,
          text: data.text,
          timestamp: new Date().toISOString()
        };

        io.to('gameRoom').emit('messageReceived', messageData);
      });

      socket.on('disconnect', () => {
        console.log(`Test: Player disconnected: ${socket.id}`);
        connectedPlayers.delete(socket.id);
        
        io.to('gameRoom').emit('playerCount', {
          count: connectedPlayers.size
        });
      });
    });

    // Start server on random port
    return new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        console.log(`Test server listening on port ${serverPort}`);
        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      // Close all client connections
      if (clientSocket1) clientSocket1.close();
      if (clientSocket2) clientSocket2.close();
      
      // Close server
      server.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
  });

  test('should connect single client to server', (t, done) => {
    clientSocket1 = new Client(`http://localhost:${serverPort}`);

    clientSocket1.on('connect', () => {
      assert.ok(clientSocket1.connected);
      done();
    });

    clientSocket1.on('connect_error', (error) => {
      done(error);
    });
  });

  test('should receive player count update on connection', (t, done) => {
    if (clientSocket1) clientSocket1.close();
    
    clientSocket1 = new Client(`http://localhost:${serverPort}`);

    clientSocket1.on('playerCount', (data) => {
      assert.strictEqual(typeof data.count, 'number');
      assert.ok(data.count >= 1);
      done();
    });

    clientSocket1.on('connect_error', (error) => {
      done(error);
    });
  });

  test('should broadcast messages between multiple clients', (t, done) => {
    let messagesReceived = 0;
    const testMessage = 'Hello from integration test!';

    // Close existing connections
    if (clientSocket1) clientSocket1.close();
    if (clientSocket2) clientSocket2.close();

    // Create two clients
    clientSocket1 = new Client(`http://localhost:${serverPort}`);
    clientSocket2 = new Client(`http://localhost:${serverPort}`);

    // Wait for both to connect
    let connectCount = 0;
    const onConnect = () => {
      connectCount++;
      if (connectCount === 2) {
        // Both clients connected, send message from client1
        clientSocket1.emit('playerMessage', {
          text: testMessage,
          timestamp: new Date().toISOString()
        });
      }
    };

    clientSocket1.on('connect', onConnect);
    clientSocket2.on('connect', onConnect);

    // Both clients should receive the message
    const onMessage = (data) => {
      assert.strictEqual(data.text, testMessage);
      assert.ok(data.playerId);
      assert.ok(data.timestamp);
      
      messagesReceived++;
      if (messagesReceived === 2) {
        done(); // Both clients received the message
      }
    };

    clientSocket1.on('messageReceived', onMessage);
    clientSocket2.on('messageReceived', onMessage);

    // Error handling
    clientSocket1.on('connect_error', done);
    clientSocket2.on('connect_error', done);
  });

  test('should handle invalid messages', (t, done) => {
    if (clientSocket1) clientSocket1.close();
    
    clientSocket1 = new Client(`http://localhost:${serverPort}`);

    clientSocket1.on('connect', () => {
      // Send invalid message (empty text)
      clientSocket1.emit('playerMessage', {
        text: '',
        timestamp: new Date().toISOString()
      });
    });

    clientSocket1.on('error', (data) => {
      assert.ok(data.message);
      assert.match(data.message, /at least.*character/i);
      done();
    });

    clientSocket1.on('connect_error', (error) => {
      done(error);
    });
  });

  test('should handle message length validation', (t, done) => {
    if (clientSocket1) clientSocket1.close();
    
    clientSocket1 = new Client(`http://localhost:${serverPort}`);

    clientSocket1.on('connect', () => {
      // Send message that's too long
      const longMessage = 'a'.repeat(501);
      clientSocket1.emit('playerMessage', {
        text: longMessage,
        timestamp: new Date().toISOString()
      });
    });

    clientSocket1.on('error', (data) => {
      assert.ok(data.message);
      assert.match(data.message, /exceed.*characters/i);
      done();
    });

    clientSocket1.on('connect_error', (error) => {
      done(error);
    });
  });

  test('should update player count when clients disconnect', (t, done) => {
    // Close existing connections
    if (clientSocket1) clientSocket1.close();
    if (clientSocket2) clientSocket2.close();

    let step = 0;
    
    // Create first client
    clientSocket1 = new Client(`http://localhost:${serverPort}`);
    
    clientSocket1.on('playerCount', (data) => {
      step++;
      
      if (step === 1) {
        // First connection: should show 1 player
        assert.strictEqual(data.count, 1);
        
        // Create second client
        clientSocket2 = new Client(`http://localhost:${serverPort}`);
        
        clientSocket2.on('connect', () => {
          // After second client connects, disconnect it
          setTimeout(() => {
            clientSocket2.close();
          }, 50);
        });
        
      } else if (step === 2) {
        // After second client connects: should show 2 players
        assert.strictEqual(data.count, 2);
        
      } else if (step === 3) {
        // After second client disconnects: should show 1 player
        assert.strictEqual(data.count, 1);
        done();
      }
    });

    clientSocket1.on('connect_error', (error) => {
      done(error);
    });
  });

  test('should handle rapid message sending', (t, done) => {
    if (clientSocket1) clientSocket1.close();
    
    clientSocket1 = new Client(`http://localhost:${serverPort}`);
    let messagesReceived = 0;
    const messagesToSend = 5;

    clientSocket1.on('connect', () => {
      // Send multiple messages rapidly
      for (let i = 0; i < messagesToSend; i++) {
        clientSocket1.emit('playerMessage', {
          text: `Rapid message ${i + 1}`,
          timestamp: new Date().toISOString()
        });
      }
    });

    clientSocket1.on('messageReceived', (data) => {
      messagesReceived++;
      assert.ok(data.text.includes('Rapid message'));
      
      if (messagesReceived === messagesToSend) {
        done(); // All messages received
      }
    });

    clientSocket1.on('connect_error', (error) => {
      done(error);
    });

    // Timeout in case not all messages are received
    setTimeout(() => {
      if (messagesReceived < messagesToSend) {
        done(new Error(`Only received ${messagesReceived}/${messagesToSend} messages`));
      }
    }, 2000);
  });
});