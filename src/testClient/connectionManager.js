/**
 * Connection Manager for Terminal Game Client
 * Handles Socket.IO connection, reconnection, and all socket event management
 */

const { io } = require('socket.io-client');
const { 
  SOCKET_CONFIG, 
  SOCKET_EVENTS, 
  SERVER_CONFIG 
} = require('./config');

/**
 * ConnectionManager class manages Socket.IO connection and events
 */
class ConnectionManager {
  /**
   * Initialize the connection manager
   * @param {string} serverUrl - Server URL to connect to
   * @param {Object} messageHandler - Message handler instance for displaying messages
   */
  constructor(serverUrl, messageHandler) {
    this.serverUrl = serverUrl || SERVER_CONFIG.DEFAULT_URL;
    this.messageHandler = messageHandler;
    this.socket = null;
    this.isConnected = false;
    this.playerId = null;
    this.pingInterval = null;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = SOCKET_CONFIG.reconnectionAttempts;
    
    // Event callbacks that can be set by the main client
    this.onConnectionStatusChange = null;
    this.onPlayerIdChange = null;
  }

  /**
   * Connect to the server
   * Replicates the connectToServer functionality from web client
   * @returns {Promise<boolean>} True if connection successful, false otherwise
   */
  async connect() {
    try {
      this.messageHandler.displayConnectionStatus('connecting');
      
      // Initialize Socket.IO connection with configuration from web client
      this.socket = io(this.serverUrl, {
        ...SOCKET_CONFIG,
        forceNew: true // Ensure fresh connection
      });

      // Set up all socket event listeners
      this.setupSocketListeners();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, SERVER_CONFIG.CONNECTION_TIMEOUT);

        this.socket.on(SOCKET_EVENTS.CONNECT, () => {
          clearTimeout(timeout);
          resolve(true);
        });

        this.socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      this.messageHandler.displayError('Failed to connect to server', error);
      return false;
    }
  }

  /**
   * Disconnect from the server
   * @param {boolean} graceful - Whether to disconnect gracefully
   */
  disconnect(graceful = true) {
    if (this.socket) {
      this.stopPingMonitoring();
      
      if (graceful) {
        this.socket.disconnect();
      } else {
        this.socket.close();
      }
      
      this.socket = null;
    }
    
    this.isConnected = false;
    this.playerId = null;
    
    if (this.onConnectionStatusChange) {
      this.onConnectionStatusChange(false);
    }
  }

  /**
   * Set up all socket event listeners
   * Replicates the setupSocketListeners functionality from web client
   */
  setupSocketListeners() {
    if (!this.socket) {
      return;
    }

    // Connection established
    this.socket.on(SOCKET_EVENTS.CONNECT, () => {
      console.log('Connected to server');
      this.isConnected = true;
      this.playerId = this.socket.id;
      this.connectionAttempts = 0;
      
      this.messageHandler.displayConnectionStatus('connected');
      
      // Start ping monitoring
      this.startPingMonitoring();
      
      // Notify callback
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(true);
      }
      
      if (this.onPlayerIdChange) {
        this.onPlayerIdChange(this.playerId);
      }
    });

    // Connection error
    this.socket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
      console.error('Connection error:', error);
      this.isConnected = false;
      this.connectionAttempts++;
      
      this.messageHandler.displayError(`Connection error: ${error.message}`);
      
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(false);
      }
    });

    // Disconnection
    this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      console.log('Disconnected from server:', reason);
      this.isConnected = false;
      this.stopPingMonitoring();
      
      if (reason === 'io server disconnect') {
        this.messageHandler.displayConnectionStatus('disconnected', 'Server closed the connection');
      } else {
        this.messageHandler.displayConnectionStatus('disconnected', 'Connection lost. Attempting to reconnect...');
      }
      
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(false);
      }
    });

    // Reconnection attempt
    this.socket.on(SOCKET_EVENTS.RECONNECT_ATTEMPT, (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`);
      this.messageHandler.displayConnectionStatus('reconnecting', `(attempt ${attemptNumber})`);
    });

    // Reconnection successful
    this.socket.on(SOCKET_EVENTS.RECONNECT, (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`);
      this.messageHandler.displaySystemMessage('Reconnected successfully!', 'connection');
    });

    // Reconnection failed
    this.socket.on(SOCKET_EVENTS.RECONNECT_FAILED, () => {
      console.error('Failed to reconnect');
      this.messageHandler.displayError('Failed to reconnect. Please restart the client.');
    });

    // Message received from other players
    this.socket.on(SOCKET_EVENTS.MESSAGE_RECEIVED, (data) => {
      this.messageHandler.displayPlayerMessage(data, this.playerId);
    });

    // Player joined notification
    this.socket.on(SOCKET_EVENTS.PLAYER_JOINED, (data) => {
      this.messageHandler.displaySystemMessage(data.message, 'join');
    });

    // Player left notification
    this.socket.on(SOCKET_EVENTS.PLAYER_LEFT, (data) => {
      this.messageHandler.displaySystemMessage(data.message, 'leave');
    });

    // Player count update
    this.socket.on(SOCKET_EVENTS.PLAYER_COUNT, (data) => {
      this.messageHandler.displayPlayerCount(data);
    });

    // Server error
    this.socket.on(SOCKET_EVENTS.ERROR, (data) => {
      console.error('Server error:', data);
      this.messageHandler.displayError(data.message || 'Server error occurred');
    });

    // Pong response for ping monitoring
    this.socket.on(SOCKET_EVENTS.PONG, (latency) => {
      // Optional: Could display ping if needed for debugging
      console.log(`Ping: ${latency}ms`);
    });

    // Game Master message
    this.socket.on(SOCKET_EVENTS.GAME_MASTER_MESSAGE, (data) => {
      this.messageHandler.displayGameMasterMessage(data);
    });

    // Room chat message
    this.socket.on(SOCKET_EVENTS.ROOM_CHAT_MESSAGE, (data) => {
      this.messageHandler.displayRoomChatMessage(data);
    });
  }

  /**
   * Send a player message to the server
   * @param {string} text - Message text to send
   * @returns {boolean} True if sent successfully, false otherwise
   */
  sendPlayerMessage(text) {
    if (!this.isConnected || !this.socket) {
      this.messageHandler.displayError('Not connected to server');
      return false;
    }

    try {
      this.socket.emit(SOCKET_EVENTS.PLAYER_MESSAGE, {
        text: text,
        timestamp: new Date().toISOString()
      });
      return true;
    } catch (error) {
      this.messageHandler.displayError('Failed to send message', error);
      return false;
    }
  }

  /**
   * Send a ping to the server for connection monitoring
   */
  sendPing() {
    if (this.isConnected && this.socket) {
      const start = Date.now();
      this.socket.emit(SOCKET_EVENTS.PING, start);
    }
  }

  /**
   * Start ping monitoring
   * Replicates the startPingMonitoring functionality from web client
   */
  startPingMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, SERVER_CONFIG.PING_INTERVAL);
  }

  /**
   * Stop ping monitoring
   * Replicates the stopPingMonitoring functionality from web client
   */
  stopPingMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get current connection status
   * @returns {boolean} True if connected, false otherwise
   */
  getConnectionStatus() {
    return this.isConnected && this.socket && this.socket.connected;
  }

  /**
   * Get current player ID
   * @returns {string|null} Player ID if connected, null otherwise
   */
  getPlayerId() {
    return this.playerId;
  }

  /**
   * Get socket instance (for advanced usage)
   * @returns {Object|null} Socket instance if connected, null otherwise
   */
  getSocket() {
    return this.socket;
  }

  /**
   * Set connection status change callback
   * @param {Function} callback - Callback function to call on connection status change
   */
  setConnectionStatusCallback(callback) {
    this.onConnectionStatusChange = callback;
  }

  /**
   * Set player ID change callback
   * @param {Function} callback - Callback function to call on player ID change
   */
  setPlayerIdCallback(callback) {
    this.onPlayerIdChange = callback;
  }

  /**
   * Force reconnection attempt
   */
  forceReconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  }

  /**
   * Get connection statistics
   * @returns {Object} Object with connection statistics
   */
  getConnectionStats() {
    return {
      isConnected: this.isConnected,
      playerId: this.playerId,
      serverUrl: this.serverUrl,
      connectionAttempts: this.connectionAttempts,
      socketId: this.socket ? this.socket.id : null,
      socketConnected: this.socket ? this.socket.connected : false
    };
  }
}

module.exports = ConnectionManager;