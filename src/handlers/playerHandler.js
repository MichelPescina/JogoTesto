/**
 * Player Handler - Manages player connections, disconnections, and state
 * Handles player lifecycle within the match system
 */

const sessionManager = require('../utils/sessionManager');

/**
 * PlayerHandler class manages player connection lifecycle
 */
class PlayerHandler {
  /**
   * Initialize player handler
   * @param {Object} io - Socket.IO server instance
   * @param {Object} matchManager - MatchManager instance
   */
  constructor(io, matchManager) {
    this.io = io;
    this.matchManager = matchManager;
    
    /** @type {Map<string, Object>} Map of socket ID to player data */
    this.connectedPlayers = new Map();
  }

  /**
   * Handle new player connection
   * @param {Object} socket - Socket.IO socket
   */
  handleConnection(socket) {
    try {
      console.log(`Player connected: ${socket.id}`);
      
      // Add player to lobby initially
      socket.join('lobby');
      
      // Store basic player information
      this.connectedPlayers.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        lastActivity: new Date(),
        currentRoom: 'lobby',
        isInMatch: false
      });

      // Send lobby welcome message
      socket.emit('lobbyWelcome', {
        message: 'Welcome to JogoTesto! Please enter your player name to join or create a match.',
        timestamp: new Date().toISOString()
      });

      // Send current lobby status
      this.sendLobbyStatus(socket);

      // Update all players with new connection count
      this.broadcastConnectionCount();

    } catch (error) {
      console.error('Error in handleConnection:', error);
      socket.emit('error', {
        message: 'Connection failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle player disconnection
   * @param {Object} socket - Socket.IO socket
   * @param {string} reason - Disconnection reason
   */
  handleDisconnection(socket, reason) {
    try {
      console.log(`Player disconnected: ${socket.id}, reason: ${reason}`);
      
      const playerData = this.connectedPlayers.get(socket.id);
      
      // Remove player from their current match if any
      const matchId = this.matchManager.getPlayerMatchId(socket.id);
      if (matchId) {
        const match = this.matchManager.getMatch(matchId);
        if (match) {
          const matchPlayerData = match.getPlayer(socket.id);
          
          // Mark player as disconnected but don't remove yet (for reconnection)
          if (matchPlayerData) {
            matchPlayerData.isConnected = false;
            matchPlayerData.disconnectedAt = new Date();
            
            // Notify other players in match about disconnection
            socket.to(`match_${matchId}`).emit('playerDisconnectedFromMatch', {
              playerId: socket.id,
              playerName: matchPlayerData.name,
              message: `${matchPlayerData.name} has disconnected`,
              timestamp: new Date().toISOString()
            });

            // If match is in waiting/countdown state and falls below minimum, handle appropriately
            if (match.state === 'countdown' && match.getConnectedPlayers().length < match.minPlayers) {
              match.cancelCountdown();
              this.io.to(`match_${matchId}`).emit('countdownCancelled', {
                message: 'Countdown cancelled - not enough players',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
      
      // Clean up player data
      this.connectedPlayers.delete(socket.id);
      
      // Update connection count
      this.broadcastConnectionCount();

      // Schedule cleanup of abandoned player from match after timeout
      setTimeout(() => {
        this.cleanupAbandonedPlayer(socket.id);
      }, 60000); // 1 minute grace period for reconnection

    } catch (error) {
      console.error('Error in handleDisconnection:', error);
    }
  }

  /**
   * Handle player activity update
   * @param {Object} socket - Socket.IO socket
   */
  updatePlayerActivity(socket) {
    const playerData = this.connectedPlayers.get(socket.id);
    if (playerData) {
      playerData.lastActivity = new Date();
    }
  }

  /**
   * Send lobby status to a player
   * @param {Object} socket - Socket.IO socket
   * @private
   */
  sendLobbyStatus(socket) {
    const stats = this.matchManager.getStats();
    
    socket.emit('lobbyStatus', {
      totalPlayers: this.connectedPlayers.size,
      totalMatches: stats.totalMatches,
      waitingPlayers: stats.lobbyQueue,
      matchStates: stats.matchStates,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast connection count to all players
   * @private
   */
  broadcastConnectionCount() {
    const connectionCount = this.connectedPlayers.size;
    
    this.io.emit('connectionCount', {
      count: connectionCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Clean up abandoned player from match system
   * @param {string} playerId - Player identifier
   * @private
   */
  cleanupAbandonedPlayer(playerId) {
    try {
      // Check if player has reconnected
      if (this.connectedPlayers.has(playerId)) {
        return; // Player reconnected, don't clean up
      }

      const matchId = this.matchManager.getPlayerMatchId(playerId);
      if (matchId) {
        const match = this.matchManager.getMatch(matchId);
        if (match) {
          const playerData = match.getPlayer(playerId);
          
          // Only remove if player is still disconnected
          if (playerData && !playerData.isConnected) {
            console.log(`Cleaning up abandoned player ${playerId} from match ${matchId}`);
            
            // Remove from match
            this.matchManager.removePlayerFromMatch(playerId);
            
            // Notify remaining players
            this.io.to(`match_${matchId}`).emit('playerLeftMatch', {
              playerId: playerId,
              playerName: playerData.name,
              message: `${playerData.name} has left the match`,
              timestamp: new Date().toISOString()
            });

            // Invalidate session
            const playerSession = sessionManager.getPlayerSession(playerId);
            if (playerSession) {
              sessionManager.invalidateSession(playerSession.sessionToken);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up abandoned player:', error);
    }
  }

  /**
   * Handle player name change request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Name change data
   */
  handleNameChange(socket, data) {
    try {
      const { newName } = data;
      
      // Validate new name
      if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
        socket.emit('error', {
          message: 'Invalid player name',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const trimmedName = newName.trim();
      if (trimmedName.length > 50) {
        socket.emit('error', {
          message: 'Player name too long (max 50 characters)',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Update player data
      const playerData = this.connectedPlayers.get(socket.id);
      if (playerData) {
        const oldName = playerData.name;
        playerData.name = trimmedName;
        
        // Update in match if player is in one
        const matchId = this.matchManager.getPlayerMatchId(socket.id);
        if (matchId) {
          const match = this.matchManager.getMatch(matchId);
          if (match) {
            const matchPlayerData = match.getPlayer(socket.id);
            if (matchPlayerData) {
              matchPlayerData.name = trimmedName;
              
              // Notify other players in match
              socket.to(`match_${matchId}`).emit('playerNameChanged', {
                playerId: socket.id,
                oldName: oldName,
                newName: trimmedName,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        
        socket.emit('nameChangeConfirmed', {
          newName: trimmedName,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Error in handleNameChange:', error);
      socket.emit('error', {
        message: 'Failed to change name',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle player status request
   * @param {Object} socket - Socket.IO socket
   */
  handleStatusRequest(socket) {
    try {
      const playerData = this.connectedPlayers.get(socket.id);
      if (!playerData) {
        socket.emit('error', {
          message: 'Player data not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const matchId = this.matchManager.getPlayerMatchId(socket.id);
      let matchData = null;
      
      if (matchId) {
        const match = this.matchManager.getMatch(matchId);
        if (match) {
          matchData = {
            matchId: matchId,
            state: match.state,
            playerCount: match.players.size,
            timeLeft: match.timeLeft,
            isActive: match.state === 'active'
          };
        }
      }

      socket.emit('playerStatus', {
        playerId: socket.id,
        playerData: playerData,
        matchData: matchData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in handleStatusRequest:', error);
      socket.emit('error', {
        message: 'Failed to get status',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get player data by socket ID
   * @param {string} socketId - Socket identifier
   * @returns {Object|null} Player data or null if not found
   */
  getPlayerData(socketId) {
    return this.connectedPlayers.get(socketId) || null;
  }

  /**
   * Check if player is connected
   * @param {string} socketId - Socket identifier
   * @returns {boolean} True if player is connected
   */
  isPlayerConnected(socketId) {
    return this.connectedPlayers.has(socketId);
  }

  /**
   * Get handler statistics
   * @returns {Object} Handler statistics
   */
  getStats() {
    const now = new Date();
    let recentConnections = 0;
    
    for (const playerData of this.connectedPlayers.values()) {
      const connectionAge = now - playerData.connectedAt;
      if (connectionAge < 60000) { // Connected in last minute
        recentConnections++;
      }
    }

    return {
      totalConnectedPlayers: this.connectedPlayers.size,
      recentConnections: recentConnections
    };
  }
}

module.exports = PlayerHandler;