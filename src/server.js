/**
 * JogoTesto - Text-based Multiplayer RPG Engine
 * Main server application with Express and Socket.IO
 * Enhanced with session management and match system support
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { validateMessage } = require('./utils/validation');
const socketConfig = require('./config/socket');
const RoomSystem = require('./systems/roomSystem');
const SessionManager = require('./systems/sessionManager');
const MatchManager = require('./systems/matchManager');
const { createSessionAuthMiddleware } = require('./middleware/sessionAuth');

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
const connectedPlayers = new Map(); // playerID -> player data
const socketConnections = new Map(); // playerID -> socket
const roomSystem = new RoomSystem(); // Legacy single-world system (will be replaced)
const sessionManager = new SessionManager();
const matchManager = new MatchManager();

// Add session authentication middleware
io.use(createSessionAuthMiddleware(sessionManager));

/**
 * Serve static files from public directory
 */
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Basic health check endpoint
 */
app.get('/health', (req, res) => {
  const sessionStats = sessionManager.getStats();
  const matchStats = matchManager.getStats();
  res.json({ 
    status: 'ok', 
    players: connectedPlayers.size,
    sessions: sessionStats,
    matches: matchStats,
    timestamp: new Date().toISOString()
  });
});

/**
 * Socket.IO connection handling with session management
 */
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.playerID} (${socket.username}) via socket ${socket.id}`);
  
  // Send session data to client for persistence
  socket.emit('session', {
    sessionID: socket.sessionID,
    playerID: socket.playerID,
    username: socket.username
  });
  
  // Check if player is reconnecting to existing match
  const existingMatch = matchManager.getPlayerMatch(socket.playerID);
  if (existingMatch && existingMatch.status === 'active') {
    console.log(`Player ${socket.playerID} reconnecting to existing match ${existingMatch.matchId}`);
    
    // Add player back to their match
    existingMatch.addPlayerSocket(socket.playerID, socket);
    
    // Update session with match information
    sessionManager.updatePlayerMatch(socket.sessionID, existingMatch.matchId);
    
    // Calculate match duration for reconnection
    const matchDuration = existingMatch.startedAt ? Date.now() - existingMatch.startedAt : 0;
    
    // Send reconnection status using the correct event name
    socket.emit('reconnection', {
      status: 'match',
      matchId: existingMatch.matchId,
      matchDuration: matchDuration,
      message: `Reconnected to active match ${existingMatch.matchId}`
    });
    
    console.log(`Player ${socket.playerID} successfully reconnected to match ${existingMatch.matchId}`);
  } else {
    // New connection or no active match - send to lobby
    socket.emit('reconnection', {
      status: 'lobby',
      message: 'Welcome to JogoTesto! Join the matchmaking queue to start playing.',
      queueStatus: {
        queueSize: matchManager.waitingQueue.size,
        activeMatches: matchManager.activeMatches.size
      }
    });
    
    console.log(`Player ${socket.playerID} connected to lobby`);
  }
  
  // Add player to legacy game room for backward compatibility
  socket.join('gameRoom');
  
  // Store player information with session-based tracking
  connectedPlayers.set(socket.playerID, {
    id: socket.playerID,
    sessionID: socket.sessionID,
    name: socket.username,
    socketId: socket.id,
    connectedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    currentRoom: roomSystem.defaultRoom
  });
  
  // Track socket connection
  socketConnections.set(socket.playerID, socket);
  
  // Legacy room system handling (only if not in a match)
  if (!existingMatch && roomSystem.isLoaded) {
    roomSystem.addPlayer(socket.playerID);
    
    // Send initial room description for lobby/legacy mode
    const roomDescription = roomSystem.getRoomDescription(
      roomSystem.defaultRoom, 
      socket.playerID, 
      connectedPlayers
    );
    
    if (roomDescription) {
      socket.emit('gameMasterMessage', {
        text: `Welcome to the lobby, ${socket.username}! Use the interface to join a match.`,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Notify other players about new connection
  socket.to('gameRoom').emit('playerJoined', {
    playerId: socket.playerID,
    playerName: socket.username,
    message: `${socket.username} has joined the game`,
    timestamp: new Date().toISOString()
  });

  // Send current player count to all players
  io.to('gameRoom').emit('playerCount', {
    count: connectedPlayers.size,
    timestamp: new Date().toISOString()
  });

  /**
   * Handle matchmaking - player wants to join queue
   */
  socket.on('joinMatch', (data) => {
    try {
      console.log(`Player ${socket.playerID} requesting to join matchmaking`);
      
      // Update username if provided
      if (data && data.username && data.username.trim()) {
        const newUsername = data.username.trim();
        sessionManager.updateUsername(socket.sessionID, newUsername);
        socket.username = newUsername;
        
        // Update connected player data
        if (connectedPlayers.has(socket.playerID)) {
          connectedPlayers.get(socket.playerID).name = newUsername;
        }
      }
      
      // Add player to matchmaking queue
      const queueResult = matchManager.addPlayerToQueue(socket.playerID, socket.username);
      
      if (queueResult.success) {
        socket.emit('matchmaking', {
          status: 'queued',
          queuePosition: queueResult.queuePosition,
          queueSize: queueResult.queueSize,
          estimatedWaitTime: queueResult.estimatedWaitTime,
          message: `You are in position ${queueResult.queuePosition} in the matchmaking queue.`
        });
        
        console.log(`Player ${socket.playerID} added to matchmaking queue at position ${queueResult.queuePosition}`);
      } else {
        socket.emit('error', {
          message: queueResult.error || 'Failed to join matchmaking queue',
          action: 'SHOW_LOBBY'
        });
        
        console.log(`Failed to add player ${socket.playerID} to queue: ${queueResult.error}`);
      }
      
    } catch (error) {
      console.error('Error handling joinMatch:', error);
      socket.emit('error', {
        message: 'Failed to join matchmaking',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Handle match forfeit - player wants to leave current match
   */
  socket.on('forfeitMatch', () => {
    try {
      console.log(`Player ${socket.playerID} requesting to forfeit match`);
      
      const currentMatch = matchManager.getPlayerMatch(socket.playerID);
      if (!currentMatch) {
        socket.emit('error', {
          message: 'You are not currently in a match',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Handle forfeit in the match
      const forfeitSuccess = currentMatch.handlePlayerForfeit(socket.playerID);
      
      if (forfeitSuccess) {
        // Remove player from match manager tracking
        matchManager.removePlayerFromMatch(socket.playerID);
        
        // Update session
        sessionManager.updatePlayerMatch(socket.sessionID, null);
        
        // Send player back to lobby using correct event
        socket.emit('reconnection', {
          status: 'lobby',
          message: 'You have forfeited the match. You can join a new match when ready.',
          queueStatus: {
            queueSize: matchManager.waitingQueue.size,
            activeMatches: matchManager.activeMatches.size
          }
        });
        
        console.log(`Player ${socket.playerID} successfully forfeited match ${currentMatch.matchId}`);
      } else {
        socket.emit('error', {
          message: 'Failed to forfeit match',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Error handling forfeitMatch:', error);
      socket.emit('error', {
        message: 'Failed to forfeit match',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Handle queue cancellation - player wants to leave matchmaking queue
   */
  socket.on('cancelQueue', () => {
    try {
      console.log(`Player ${socket.playerID} requesting to cancel queue`);
      
      const cancelResult = matchManager.removePlayerFromQueue(socket.playerID);
      
      if (cancelResult) {
        socket.emit('matchmaking', {
          status: 'cancelled',
          message: 'You have left the matchmaking queue.'
        });
        
        console.log(`Player ${socket.playerID} successfully cancelled queue`);
      } else {
        socket.emit('error', {
          message: 'You are not currently in the queue',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Error handling cancelQueue:', error);
      socket.emit('error', {
        message: 'Failed to cancel queue',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * Handle player messages - route to match or lobby
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
      if (connectedPlayers.has(socket.playerID)) {
        connectedPlayers.get(socket.playerID).lastActivity = new Date().toISOString();
      }
      
      // Update session activity
      sessionManager.updateActivity(socket.sessionID);

      // Check if player is in a match
      const currentMatch = matchManager.getPlayerMatch(socket.playerID);
      
      if (currentMatch && currentMatch.status === 'active') {
        // Route to match handling
        handleMatchMessage(socket, currentMatch, data);
      } else {
        // Player is in lobby - handle as legacy system for now
        socket.emit('gameMasterMessage', {
          text: 'You are in the lobby. Join a match to start playing!',
          timestamp: new Date().toISOString()
        });
      }
      
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
    console.log(`Player disconnected: ${socket.playerID} (${socket.username}), reason: ${reason}`);
    
    // Get player info before removal
    const playerData = connectedPlayers.get(socket.playerID);
    
    // Handle match disconnection
    const currentMatch = matchManager.getPlayerMatch(socket.playerID);
    if (currentMatch) {
      // Remove player socket from match (but keep them in match for potential reconnection)
      currentMatch.removePlayerSocket(socket.playerID);
      console.log(`Player ${socket.playerID} disconnected from match ${currentMatch.matchId}`);
    } else {
      // Remove from matchmaking queue if they were waiting
      const removedFromQueue = matchManager.removePlayerFromQueue(socket.playerID);
      if (removedFromQueue) {
        console.log(`Player ${socket.playerID} removed from matchmaking queue due to disconnect`);
      }
      
      // Legacy room system cleanup (for lobby players)
      const playerRoom = roomSystem.getPlayerRoom(socket.playerID);
      roomSystem.removePlayer(socket.playerID);
      
      // Notify players in the same room about departure (legacy lobby)
      if (playerRoom && playerData) {
        const playersInRoom = roomSystem.getPlayersInRoom(playerRoom);
        if (playersInRoom.length > 0) {
          for (const playerId of playersInRoom) {
            const playerSocket = socketConnections.get(playerId);
            if (playerSocket) {
              playerSocket.emit('gameMasterMessage', {
                text: `${playerData.name} has left the area.`,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
    }
    
    // Remove player from connected players and socket connections
    connectedPlayers.delete(socket.playerID);
    socketConnections.delete(socket.playerID);
    
    // Note: Session persists for reconnection - not deleted here
    
    // Notify other players about disconnection (legacy)
    socket.to('gameRoom').emit('playerLeft', {
      playerId: socket.playerID,
      playerName: socket.username,
      message: `${socket.username} has left the game`,
      timestamp: new Date().toISOString()
    });

    // Send updated player count (legacy)
    io.to('gameRoom').emit('playerCount', {
      count: connectedPlayers.size,
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Handle connection errors
   */
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.playerID} (${socket.username}):`, error);
  });
});

/**
 * Handle messages within a match context
 * @param {Object} socket - Socket.IO socket object
 * @param {Object} match - Match instance
 * @param {Object} data - Message data
 */
function handleMatchMessage(socket, match, data) {
  const message = data.text.trim();
  
  // Handle movement commands
  if (message.startsWith('/go ')) {
    const direction = message.substring(4).trim().toLowerCase();
    
    if (!direction) {
      socket.emit('gameMasterMessage', {
        text: 'Go where? Please specify a direction (e.g., "/go north").',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    const moveResult = match.handlePlayerMovement(socket.playerID, direction);
    
    if (!moveResult.success) {
      socket.emit('gameMasterMessage', {
        text: moveResult.error,
        timestamp: new Date().toISOString()
      });
    }
    return;
  }
  
  // Handle look commands
  if (message.startsWith('/look') || message === '/l') {
    match.sendRoomDescription(socket.playerID);
    return;
  }
  
  // Handle forfeit command
  if (message === '/forfeit') {
    // Trigger forfeit handler
    socket.emit('forfeitMatch');
    return;
  }
  
  // Default: Handle as room-based chat within the match
  const chatSuccess = match.handleChatMessage(socket.playerID, message);
  
  if (!chatSuccess) {
    socket.emit('gameMasterMessage', {
      text: 'Failed to send message. You may not be in a valid location.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle player movement commands (/go direction) - Legacy function
 * @param {Object} socket - Socket.IO socket object
 * @param {string} message - The movement command message
 */
// eslint-disable-next-line no-unused-vars
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
  const playerData = connectedPlayers.get(socket.playerID);
  if (!playerData) {
    socket.emit('gameMasterMessage', {
      text: 'Player data not found. Please reconnect.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Attempt to move player
  const moveResult = roomSystem.movePlayer(socket.playerID, direction);
  
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
    const playerSocket = socketConnections.get(playerId);
    if (playerSocket && playerId !== socket.playerID) {
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
    socket.playerID, 
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
    const playerSocket = socketConnections.get(playerId);
    if (playerSocket && playerId !== socket.playerID) {
      playerSocket.emit('gameMasterMessage', {
        text: `${playerData.name} arrives from the ${getOppositeDirection(moveResult.direction)}.`,
        timestamp: new Date().toISOString()
      });
    }
  }

  console.log(`Player ${socket.playerID} (${socket.username}) moved from ${moveResult.fromRoom} to ${moveResult.toRoom}`);
}

/**
 * Handle look commands (/look, /l)
 * @param {Object} socket - Socket.IO socket object
 */
// eslint-disable-next-line no-unused-vars
function handleLookCommand(socket) {
  if (!roomSystem.isLoaded) {
    socket.emit('gameMasterMessage', {
      text: 'The world is still loading. Please wait a moment.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const playerRoom = roomSystem.getPlayerRoom(socket.playerID);
  if (!playerRoom) {
    socket.emit('gameMasterMessage', {
      text: 'You seem to be lost in the void. Please reconnect.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const roomDescription = roomSystem.getRoomDescription(
    playerRoom, 
    socket.playerID, 
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
// eslint-disable-next-line no-unused-vars
function handleDefaultRoomChat(socket, chatText) {
  if (!roomSystem.isLoaded) {
    socket.emit('gameMasterMessage', {
      text: 'The world is still loading. Please wait a moment.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Get player data
  const playerData = connectedPlayers.get(socket.playerID);
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
  const currentRoom = roomSystem.getPlayerRoom(socket.playerID);
  if (!currentRoom) {
    socket.emit('gameMasterMessage', {
      text: 'You seem to be lost in the void. Please reconnect.',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const playersInRoom = roomSystem.getPlayersInRoom(currentRoom);
  const otherPlayersInRoom = playersInRoom.filter(playerId => playerId !== socket.playerID);

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
    playerId: socket.playerID,
    playerName: playerData.name,
    text: trimmedText,
    timestamp: new Date().toISOString(),
    roomId: currentRoom,
    messageType: 'roomChat'
  };

  // Send chat message to all players in the room (including sender)
  for (const playerId of playersInRoom) {
    const playerSocket = socketConnections.get(playerId);
    if (playerSocket) {
      if (playerId === socket.playerID) {
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

  console.log(`Room chat in ${currentRoom} from ${socket.playerID} (${socket.username}): ${trimmedText}`);
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
  
  // Cleanup managers
  sessionManager.destroy();
  matchManager.destroy();
  
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