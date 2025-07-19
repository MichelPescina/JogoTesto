/**
 * JogoTesto - Text-based Multiplayer RPG Engine
 * Main server application with Express and Socket.IO
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { validateMessage } = require('./utils/validation');
const socketConfig = require('./config/socket');
const RoomSystem = require('./systems/roomSystem');

/**
 * Initialize Express application and HTTP server
 */
const app = express();
const server = createServer(app);
const io = new Server(server, socketConfig);

/**
 * Server configuration
 */
const PORT = process.env.PORT || 3000;
const connectedPlayers = new Map();
const roomSystem = new RoomSystem();

/**
 * Serve static files from public directory
 */
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Basic health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    players: connectedPlayers.size,
    timestamp: new Date().toISOString()
  });
});

/**
 * Socket.IO connection handling
 */
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Add player to game room
  socket.join('gameRoom');
  
  // Store player information with room tracking
  const playerName = `Player ${socket.id.substring(0, 8)}`;
  connectedPlayers.set(socket.id, {
    id: socket.id,
    name: playerName,
    connectedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    currentRoom: roomSystem.defaultRoom
  });
  
  // Add player to room system
  if (roomSystem.isLoaded) {
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
  } else {
    socket.emit('gameMasterMessage', {
      text: 'Welcome to JogoTesto! The world is still loading...',
      timestamp: new Date().toISOString()
    });
  }

  // Notify other players about new connection
  socket.to('gameRoom').emit('playerJoined', {
    playerId: socket.id,
    message: 'A new player has joined the game',
    timestamp: new Date().toISOString()
  });

  // Send current player count to all players
  io.to('gameRoom').emit('playerCount', {
    count: connectedPlayers.size,
    timestamp: new Date().toISOString()
  });

  /**
   * Handle player messages
   */
  socket.on('playerMessage', (data) => {
    try {
      // Validate message
      const validationResult = validateMessage(data);
      if (!validationResult.isValid) {
        socket.emit('error', {
          message: validationResult.error,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Update player last activity
      if (connectedPlayers.has(socket.id)) {
        connectedPlayers.get(socket.id).lastActivity = new Date().toISOString();
      }

      const message = data.text.trim();
      
      // Handle room commands
      if (message.startsWith('/go ')) {
        handleMoveCommand(socket, message);
        return;
      }
      
      if (message.startsWith('/look') || message === '/l') {
        handleLookCommand(socket);
        return;
      }
      
      // Default: Handle as room-based chat message
      handleDefaultRoomChat(socket, data.text);
    } catch (error) {
      console.error('Error handling player message:', error);
      socket.emit('error', {
        message: 'Failed to process message',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Handle player disconnection
   */
  socket.on('disconnect', (reason) => {
    console.log(`Player disconnected: ${socket.id}, reason: ${reason}`);
    
    // Get player info before removal
    const playerData = connectedPlayers.get(socket.id);
    const playerRoom = roomSystem.getPlayerRoom(socket.id);
    
    // Remove player from room system
    roomSystem.removePlayer(socket.id);
    
    // Notify players in the same room about departure
    if (playerRoom && playerData) {
      const playersInRoom = roomSystem.getPlayersInRoom(playerRoom);
      if (playersInRoom.length > 0) {
        for (const playerId of playersInRoom) {
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            playerSocket.emit('gameMasterMessage', {
              text: `${playerData.name} has left the area.`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
    
    // Remove player from connected players
    connectedPlayers.delete(socket.id);
    
    // Notify other players about disconnection
    socket.to('gameRoom').emit('playerLeft', {
      playerId: socket.id,
      message: 'A player has left the game',
      timestamp: new Date().toISOString()
    });

    // Send updated player count
    io.to('gameRoom').emit('playerCount', {
      count: connectedPlayers.size,
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Handle connection errors
   */
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

/**
 * Handle player movement commands (/go direction)
 * @param {Object} socket - Socket.IO socket object
 * @param {string} message - The movement command message
 */
function handleMoveCommand(socket, message) {
  if (!roomSystem.isLoaded) {
    socket.emit('gameMasterMessage', {
      text: 'The world is still loading. Please wait a moment.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Extract direction from "/go direction"
  const direction = message.substring(4).trim().toLowerCase();
  
  if (!direction) {
    socket.emit('gameMasterMessage', {
      text: 'Go where? Please specify a direction (e.g., "/go north").',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Get player data
  const playerData = connectedPlayers.get(socket.id);
  if (!playerData) {
    socket.emit('gameMasterMessage', {
      text: 'Player data not found. Please reconnect.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Attempt to move player
  const moveResult = roomSystem.movePlayer(socket.id, direction);
  
  if (!moveResult.success) {
    socket.emit('gameMasterMessage', {
      text: moveResult.error,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Update player's current room in connected players
  playerData.currentRoom = moveResult.toRoom;

  // Notify players in the departure room
  const playersInOldRoom = roomSystem.getPlayersInRoom(moveResult.fromRoom);
  for (const playerId of playersInOldRoom) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket && playerId !== socket.id) {
      playerSocket.emit('gameMasterMessage', {
        text: `${playerData.name} heads ${moveResult.direction}.`,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Send movement description to the moving player
  socket.emit('gameMasterMessage', {
    text: moveResult.exitDescription,
    timestamp: new Date().toISOString()
  });

  // Get and send new room description
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

  // Notify players in the arrival room
  const playersInNewRoom = roomSystem.getPlayersInRoom(moveResult.toRoom);
  for (const playerId of playersInNewRoom) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket && playerId !== socket.id) {
      playerSocket.emit('gameMasterMessage', {
        text: `${playerData.name} arrives from the ${getOppositeDirection(moveResult.direction)}.`,
        timestamp: new Date().toISOString()
      });
    }
  }

  console.log(`Player ${socket.id} moved from ${moveResult.fromRoom} to ${moveResult.toRoom}`);
}

/**
 * Handle look commands (/look, /l)
 * @param {Object} socket - Socket.IO socket object
 */
function handleLookCommand(socket) {
  if (!roomSystem.isLoaded) {
    socket.emit('gameMasterMessage', {
      text: 'The world is still loading. Please wait a moment.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const playerRoom = roomSystem.getPlayerRoom(socket.id);
  if (!playerRoom) {
    socket.emit('gameMasterMessage', {
      text: 'You seem to be lost in the void. Please reconnect.',
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
 * Handle default room-based chat for all non-command messages
 * @param {Object} socket - Socket.IO socket object
 * @param {string} chatText - The chat message text
 */
function handleDefaultRoomChat(socket, chatText) {
  if (!roomSystem.isLoaded) {
    socket.emit('gameMasterMessage', {
      text: 'The world is still loading. Please wait a moment.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Get player data
  const playerData = connectedPlayers.get(socket.id);
  if (!playerData) {
    socket.emit('gameMasterMessage', {
      text: 'Player data not found. Please reconnect.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Trim and validate chat text
  const trimmedText = chatText ? chatText.trim() : '';
  
  // Validate chat message using existing validation
  const validationResult = validateMessage({ text: trimmedText });
  if (!validationResult.isValid) {
    socket.emit('gameMasterMessage', {
      text: `Cannot send message: ${validationResult.error}`,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Get current room and other players in the room
  const currentRoom = roomSystem.getPlayerRoom(socket.id);
  if (!currentRoom) {
    socket.emit('gameMasterMessage', {
      text: 'You seem to be lost in the void. Please reconnect.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const playersInRoom = roomSystem.getPlayersInRoom(currentRoom);
  const otherPlayersInRoom = playersInRoom.filter(playerId => playerId !== socket.id);

  // Check if there are other players in the room
  if (otherPlayersInRoom.length === 0) {
    socket.emit('gameMasterMessage', {
      text: 'You speak to the empty air, but no one is here to listen. Your words echo in the silence.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Prepare chat message data
  const chatMessageData = {
    playerId: socket.id,
    playerName: playerData.name,
    text: trimmedText,
    timestamp: new Date().toISOString(),
    roomId: currentRoom,
    messageType: 'roomChat'
  };

  // Send chat message to all players in the room (including sender)
  for (const playerId of playersInRoom) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      if (playerId === socket.id) {
        // Send to sender with "You say:" format
        playerSocket.emit('roomChatMessage', {
          ...chatMessageData,
          text: `You say: "${trimmedText}"`,
          isSelf: true
        });
      } else {
        // Send to other players with player name
        playerSocket.emit('roomChatMessage', {
          ...chatMessageData,
          text: `${playerData.name} says: "${trimmedText}"`,
          isSelf: false
        });
      }
    }
  }

  console.log(`Room chat in ${currentRoom} from ${socket.id}: ${trimmedText}`);
}


/**
 * Get opposite direction for arrival messages
 * @param {string} direction - The original direction
 * @returns {string} The opposite direction
 */
function getOppositeDirection(direction) {
  const opposites = {
    'north': 'south',
    'south': 'north',
    'east': 'west',
    'west': 'east',
    'up': 'down',
    'down': 'up',
    'northeast': 'southwest',
    'northwest': 'southeast',
    'southeast': 'northwest',
    'southwest': 'northeast'
  };
  
  return opposites[direction.toLowerCase()] || direction;
}

/**
 * Global error handlers
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Graceful shutdown handling
 */
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

/**
 * Initialize room system and start the server
 */
async function startServer() {
  // Load room data
  const roomsLoaded = await roomSystem.loadRoomsFromJSON('data/rooms.json');
  
  if (!roomsLoaded) {
    console.error('Failed to load room data. Server will start but room functionality will be disabled.');
  }
  
  // Start the server
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Game client available at http://localhost:${PORT}`);
    console.log(`Room system loaded: ${roomSystem.isLoaded}`);
    
    if (roomSystem.isLoaded) {
      const stats = roomSystem.getStats();
      console.log(`Loaded ${stats.totalRooms} rooms, default room: ${stats.defaultRoom}`);
    }
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = { app, server, io };