/**
 * Socket.IO configuration for JogoTesto
 * Optimized for 20 concurrent players with stable performance
 */

/**
 * Socket.IO server configuration
 * Based on PRP performance recommendations
 */
const socketConfig = {
  // Connection settings optimized for multiplayer gaming
  pingInterval: 10000,     // Send ping packet every 10 seconds
  pingTimeout: 5000,       // Wait 5 seconds for pong response before disconnect
  maxHttpBufferSize: 1e6,  // 1MB max buffer size for messages
  
  // CORS configuration for local development
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false  // Configure specific origins in production
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  
  // Connection state recovery for reliability
  connectionStateRecovery: {
    // Recovery will be enabled for a given connection if all the following conditions are met
    maxDisconnectionDuration: 2 * 60 * 1000,  // 2 minutes
    skipMiddlewares: true  // Skip middlewares during recovery
  },
  
  // Transport configuration
  transports: ['websocket', 'polling'],
  
  // Allow upgrading from HTTP long-polling to WebSocket
  allowUpgrades: true,
  
  // Compression settings
  compression: true,
  
  // Cleanup settings
  cleanupEmptyChildNamespaces: true
};

module.exports = socketConfig;