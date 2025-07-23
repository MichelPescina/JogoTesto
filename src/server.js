const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const { GAME_CONFIG } = require('./utils/constants');
const MatchManager = require('./game/MatchManager');
const socketHandlers = require('./handlers/socketHandlers');
const httpHandlers = require('./handlers/httpHandlers');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize game systems
const matchManager = new MatchManager();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// HTTP routes
app.get('/api/status', httpHandlers.getStatus);
app.get('/api/matches', httpHandlers.getMatches(matchManager));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Initialize socket handlers with dependencies
  socketHandlers.initializeHandlers(socket, io, matchManager);

  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
    matchManager.handlePlayerDisconnection(socket.id);
  });

  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
});

// Graceful shutdown handling
const shutdown = () => {
  console.log('Shutting down server gracefully...');
  server.close(() => {
    console.log('Server closed gracefully');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

const PORT = process.env.PORT || GAME_CONFIG.DEFAULT_PORT;

server.listen(PORT, () => {
  console.log(`JogoTesto server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to play`);
});

module.exports = { app, server, io };