/**
 * JogoTesto - Text-based Multiplayer Battle Royale RPG Engine
 * Main server application with Express, Socket.IO, and Match System
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import configuration
const socketConfig = require('./config/socket');

// Import match system components
const MatchManager = require('./systems/matchManager');
const MatchHandler = require('./handlers/matchHandler');
const PlayerHandler = require('./handlers/playerHandler');
const LobbyHandler = require('./handlers/lobbyHandler');

// Import utilities
const { validateMessage } = require('./utils/validation');
const sessionManager = require('./utils/sessionManager');

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

/**
 * Initialize match system components
 */
const matchManager = new MatchManager();
const matchHandler = new MatchHandler(io, matchManager);
const playerHandler = new PlayerHandler(io, matchManager);
const lobbyHandler = new LobbyHandler(io, matchManager, playerHandler);

/**
 * Serve static files from public directory
 */
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Health check endpoint with match system statistics
 */
app.get('/health', (req, res) => {
  const matchStats = matchManager.getStats();
  const playerStats = playerHandler.getStats();
  const lobbyStats = lobbyHandler.getStats();
  
  res.json({ 
    status: 'ok',
    players: playerStats.totalConnectedPlayers,
    matches: matchStats.totalMatches,
    lobby: lobbyStats.playersInLobby,
    matchStates: matchStats.matchStates,
    timestamp: new Date().toISOString()
  });
});

/**
 * Match system statistics endpoint
 */
app.get('/stats', (req, res) => {
  res.json({
    matchManager: matchManager.getStats(),
    playerHandler: playerHandler.getStats(),
    lobbyHandler: lobbyHandler.getStats(),
    matchHandler: matchHandler.getStats(),
    sessionManager: sessionManager.getStats(),
    timestamp: new Date().toISOString()
  });
});

/**
 * Socket.IO connection handling with match system
 */
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Handle initial connection
  playerHandler.handleConnection(socket);
  lobbyHandler.handleLobbyJoin(socket);

  /**
   * Match System Events
   */
  
  // Join match with player name
  socket.on('joinMatch', (data) => {
    playerHandler.updatePlayerActivity(socket);
    matchHandler.handleJoinMatch(socket, data);
  });

  // Reconnect to existing match
  socket.on('reconnectToMatch', (data) => {
    playerHandler.updatePlayerActivity(socket);
    matchHandler.handleReconnectToMatch(socket, data);
  });

  // Match-specific chat
  socket.on('matchMessage', (data) => {
    playerHandler.updatePlayerActivity(socket);
    matchHandler.handleMatchChat(socket, data);
  });

  // Movement within match
  socket.on('moveInMatch', (data) => {
    playerHandler.updatePlayerActivity(socket);
    matchHandler.handleMatchMovement(socket, data);
  });

  /**
   * Lobby Events
   */
  
  // Lobby chat
  socket.on('lobbyMessage', (data) => {
    playerHandler.updatePlayerActivity(socket);
    lobbyHandler.handleLobbyChat(socket, data);
  });

  // Name validation
  socket.on('validateName', (data) => {
    playerHandler.updatePlayerActivity(socket);
    lobbyHandler.handleNameValidation(socket, data);
  });

  /**
   * Player Management Events
   */
  
  // Player name change
  socket.on('changeName', (data) => {
    playerHandler.updatePlayerActivity(socket);
    playerHandler.handleNameChange(socket, data);
  });

  // Player status request
  socket.on('getStatus', () => {
    playerHandler.updatePlayerActivity(socket);
    playerHandler.handleStatusRequest(socket);
  });

  /**
   * Legacy Message Handling (for backward compatibility)
   */
  socket.on('playerMessage', (data) => {
    try {
      playerHandler.updatePlayerActivity(socket);
      
      // Validate message
      const validationResult = validateMessage(data);
      if (!validationResult.isValid) {
        socket.emit('error', {
          message: validationResult.error,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const message = data.text.trim();
      
      // Check if player is in a match
      const matchId = matchManager.getPlayerMatchId(socket.id);
      if (matchId) {
        const match = matchManager.getMatch(matchId);
        
        if (match && match.state === 'active') {
          // Handle as game command in active match
          if (message.startsWith('/go ')) {
            const direction = message.substring(4).trim();
            matchHandler.handleMatchMovement(socket, { direction });
            return;
          }
          
          if (message.startsWith('/look') || message === '/l') {
            const roomDescription = match.getRoomDescription(socket.id);
            if (roomDescription) {
              socket.emit('gameMasterMessage', {
                text: `${roomDescription.name}\n\n${roomDescription.description}`,
                timestamp: new Date().toISOString()
              });
            }
            return;
          }
          
          // Handle as match chat
          matchHandler.handleMatchChat(socket, data);
          return;
        }
      }
      
      // Handle as lobby message
      lobbyHandler.handleLobbyChat(socket, data);
      
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
    
    // Clean up player from all handlers
    playerHandler.handleDisconnection(socket, reason);
    lobbyHandler.cleanupLobbyPlayer(socket.id);
  });

  /**
   * Handle connection errors
   */
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

/**
 * Periodic cleanup tasks
 */
setInterval(() => {
  // Clean up empty matches
  const stats = matchManager.getStats();
  if (stats.totalMatches > 0) {
    for (const [matchId, match] of matchManager.matches) {
      if (match.players.size === 0 && match.state !== 'active') {
        console.log(`Cleaning up empty match: ${matchId}`);
        matchHandler.handleMatchCleanup(matchId);
        matchManager.matches.delete(matchId);
      }
    }
  }
}, 60000); // Every minute

/**
 * Global error handlers
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  // Graceful shutdown with match cleanup
  console.log('Initiating graceful shutdown...');
  
  // Notify all connected players
  io.emit('serverShutdown', {
    message: 'Server is restarting. Please reconnect in a moment.',
    timestamp: new Date().toISOString()
  });
  
  // Clean up matches
  for (const [matchId, match] of matchManager.matches) {
    match.cleanup();
  }
  
  setTimeout(() => {
    process.exit(1);
  }, 5000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Don't exit for unhandled rejections in match system
  // Just log and continue
});

/**
 * Graceful shutdown handling
 */
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  
  // Notify all players
  io.emit('serverShutdown', {
    message: 'Server is shutting down gracefully.',
    timestamp: new Date().toISOString()
  });
  
  // Clean up all matches
  for (const [matchId, match] of matchManager.matches) {
    match.cleanup();
    matchHandler.clearCountdownTimer(matchId);
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

/**
 * Start the server
 */
async function startServer() {
  try {
    // Start the server
    server.listen(PORT, () => {
      console.log(`JogoTesto Match System Server listening on port ${PORT}`);
      console.log(`Game client available at http://localhost:${PORT}`);
      console.log(`Health check available at http://localhost:${PORT}/health`);
      console.log(`Statistics available at http://localhost:${PORT}/stats`);
      console.log('Match system initialized and ready for players');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = { app, server, io, matchManager, matchHandler, playerHandler, lobbyHandler };