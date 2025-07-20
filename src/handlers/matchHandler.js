/**
 * Match Handler - Manages match-related socket events and countdown timers
 * Handles match lifecycle, room transitions, and player interactions within matches
 */

const { validateMessage } = require('../utils/validation');
const sessionManager = require('../utils/sessionManager');

/**
 * MatchHandler class manages match-specific socket events
 */
class MatchHandler {
  /**
   * Initialize match handler
   * @param {Object} io - Socket.IO server instance
   * @param {Object} matchManager - MatchManager instance
   */
  constructor(io, matchManager) {
    this.io = io;
    this.matchManager = matchManager;
    
    /** @type {Map<string, NodeJS.Timeout>} Active countdown timers by match ID */
    this.countdownTimers = new Map();
  }

  /**
   * Handle player joining a match
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Join match data
   */
  handleJoinMatch(socket, data) {
    try {
      const { playerName } = data;
      
      // Validate player name
      if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
        socket.emit('error', {
          message: 'Invalid player name',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const trimmedName = playerName.trim();
      if (trimmedName.length > 50) {
        socket.emit('error', {
          message: 'Player name too long (max 50 characters)',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Find or create match
      const result = this.matchManager.findOrCreateMatch(socket.id, trimmedName);
      
      if (!result.success) {
        socket.emit('error', {
          message: result.error,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const match = this.matchManager.getMatch(result.matchId);
      if (!match) {
        socket.emit('error', {
          message: 'Match not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Move socket from lobby to match room
      socket.leave('lobby');
      socket.join(`match_${result.matchId}`);

      // Create session for player
      const sessionResult = sessionManager.createSession(socket.id, result.matchId, trimmedName);
      
      // Send match assignment
      socket.emit('matchAssigned', {
        matchId: result.matchId,
        playerId: socket.id,
        playerName: trimmedName,
        sessionToken: sessionResult.success ? sessionResult.sessionToken : null,
        action: result.action,
        playerCount: result.playerCount,
        matchState: match.state,
        timeLeft: match.timeLeft,
        timestamp: new Date().toISOString()
      });

      // Notify other players in match
      socket.to(`match_${result.matchId}`).emit('playerJoinedMatch', {
        playerId: socket.id,
        playerName: trimmedName,
        playerCount: result.playerCount,
        timestamp: new Date().toISOString()
      });

      // Start countdown if conditions are met
      if (match.state === 'countdown' && !this.countdownTimers.has(result.matchId)) {
        this.startCountdownTimer(result.matchId);
      }

      console.log(`Player ${socket.id} (${trimmedName}) ${result.action} match ${result.matchId}`);

    } catch (error) {
      console.error('Error in handleJoinMatch:', error);
      socket.emit('error', {
        message: 'Failed to join match',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle player reconnection to match
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Reconnection data
   */
  handleReconnectToMatch(socket, data) {
    try {
      const { matchId, playerId, sessionToken } = data;

      // Validate session
      if (sessionToken) {
        const sessionValidation = sessionManager.validateSession(sessionToken);
        if (sessionValidation.success) {
          const sessionData = sessionValidation.sessionData;
          
          // Validate session matches provided data
          if (sessionData.playerId === socket.id && sessionData.matchId === matchId) {
            return this.performReconnection(socket, sessionData);
          }
        }
      }

      // Fallback: try match manager validation
      if (this.matchManager.validateSession(matchId, socket.id)) {
        const match = this.matchManager.getMatch(matchId);
        if (match) {
          const playerData = match.getPlayer(socket.id);
          if (playerData) {
            const sessionData = {
              playerId: socket.id,
              matchId: matchId,
              playerName: playerData.name
            };
            return this.performReconnection(socket, sessionData);
          }
        }
      }

      // Invalid session - redirect to lobby
      socket.emit('sessionInvalid', {
        message: 'Session expired or invalid',
        timestamp: new Date().toISOString()
      });
      
      socket.join('lobby');

    } catch (error) {
      console.error('Error in handleReconnectToMatch:', error);
      socket.emit('reconnectionFailed', {
        message: 'Reconnection failed',
        timestamp: new Date().toISOString()
      });
      
      socket.join('lobby');
    }
  }

  /**
   * Perform the actual reconnection process
   * @param {Object} socket - Socket.IO socket
   * @param {Object} sessionData - Valid session data
   * @private
   */
  performReconnection(socket, sessionData) {
    const { playerId, matchId, playerName } = sessionData;
    const match = this.matchManager.getMatch(matchId);
    
    if (!match) {
      socket.emit('sessionInvalid', {
        message: 'Match no longer exists',
        timestamp: new Date().toISOString()
      });
      socket.join('lobby');
      return;
    }

    // Reconnect player in match
    const reconnectResult = match.reconnectPlayer(playerId, socket);
    if (!reconnectResult.success) {
      socket.emit('reconnectionFailed', {
        message: reconnectResult.error,
        timestamp: new Date().toISOString()
      });
      socket.join('lobby');
      return;
    }

    // Join match room
    socket.join(`match_${matchId}`);

    // Send reconnection success
    socket.emit('reconnectionSuccess', {
      matchId: matchId,
      playerId: playerId,
      playerName: playerName,
      matchState: match.state,
      timeLeft: match.timeLeft,
      playerCount: match.players.size,
      timestamp: new Date().toISOString()
    });

    // Send room description if match is active
    if (match.state === 'active') {
      const roomDescription = match.getRoomDescription(playerId);
      if (roomDescription) {
        socket.emit('gameMasterMessage', {
          text: `${roomDescription.name}\n\n${roomDescription.description}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    console.log(`Player ${playerId} reconnected to match ${matchId}`);
  }

  /**
   * Handle player movement within match
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Movement data
   */
  handleMatchMovement(socket, data) {
    try {
      const matchId = this.matchManager.getPlayerMatchId(socket.id);
      if (!matchId) {
        socket.emit('error', {
          message: 'Not in any match',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const match = this.matchManager.getMatch(matchId);
      if (!match || match.state !== 'active') {
        socket.emit('gameMasterMessage', {
          text: 'Movement not allowed - match not active',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const direction = data.direction;
      if (!direction) {
        socket.emit('gameMasterMessage', {
          text: 'Go where? Please specify a direction.',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Attempt movement
      const moveResult = match.movePlayer(socket.id, direction);
      
      if (!moveResult.success) {
        socket.emit('gameMasterMessage', {
          text: moveResult.error,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const playerData = match.getPlayer(socket.id);
      if (!playerData) {
        return;
      }

      // Notify players in departure room
      const playersInOldRoom = match.roomSystem.getPlayersInRoom(moveResult.fromRoom);
      for (const playerId of playersInOldRoom) {
        if (playerId !== socket.id) {
          const playerSocket = this.io.sockets.sockets.get(playerId);
          if (playerSocket) {
            playerSocket.emit('gameMasterMessage', {
              text: `${playerData.name} heads ${moveResult.direction}.`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Send movement confirmation to moving player
      socket.emit('gameMasterMessage', {
        text: moveResult.exitDescription,
        timestamp: new Date().toISOString()
      });

      // Send new room description
      const roomDescription = match.getRoomDescription(socket.id);
      if (roomDescription) {
        socket.emit('gameMasterMessage', {
          text: `${roomDescription.name}\n\n${roomDescription.description}`,
          timestamp: new Date().toISOString()
        });
      }

      // Notify players in arrival room
      const playersInNewRoom = match.roomSystem.getPlayersInRoom(moveResult.toRoom);
      for (const playerId of playersInNewRoom) {
        if (playerId !== socket.id) {
          const playerSocket = this.io.sockets.sockets.get(playerId);
          if (playerSocket) {
            playerSocket.emit('gameMasterMessage', {
              text: `${playerData.name} arrives.`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

    } catch (error) {
      console.error('Error in handleMatchMovement:', error);
      socket.emit('error', {
        message: 'Movement failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle match chat messages
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Chat message data
   */
  handleMatchChat(socket, data) {
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

      const matchId = this.matchManager.getPlayerMatchId(socket.id);
      if (!matchId) {
        socket.emit('error', {
          message: 'Not in any match',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const match = this.matchManager.getMatch(matchId);
      if (!match) {
        return;
      }

      const playerData = match.getPlayer(socket.id);
      if (!playerData) {
        return;
      }

      const chatText = data.text.trim();

      // Broadcast to all players in match
      this.io.to(`match_${matchId}`).emit('matchChatMessage', {
        playerId: socket.id,
        playerName: playerData.name,
        text: chatText,
        timestamp: new Date().toISOString(),
        matchId: matchId
      });

    } catch (error) {
      console.error('Error in handleMatchChat:', error);
      socket.emit('error', {
        message: 'Failed to send message',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Start countdown timer for a match
   * @param {string} matchId - Match identifier
   */
  startCountdownTimer(matchId) {
    const match = this.matchManager.getMatch(matchId);
    if (!match || match.state !== 'countdown') {
      return;
    }

    // Clear existing timer if any
    this.clearCountdownTimer(matchId);

    let timeLeft = match.countdownDuration;
    match.updateCountdown(timeLeft);

    console.log(`Starting countdown timer for match ${matchId}`);

    const timer = setInterval(() => {
      timeLeft--;
      match.updateCountdown(timeLeft);

      // Broadcast countdown update
      this.io.to(`match_${matchId}`).emit('countdownUpdate', {
        timeLeft: timeLeft,
        timestamp: new Date().toISOString()
      });

      if (timeLeft <= 0) {
        this.finishCountdown(matchId);
      }
    }, 1000);

    this.countdownTimers.set(matchId, timer);

    // Send initial countdown update
    this.io.to(`match_${matchId}`).emit('countdownStarted', {
      timeLeft: timeLeft,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Finish countdown and start match
   * @param {string} matchId - Match identifier
   * @private
   */
  finishCountdown(matchId) {
    this.clearCountdownTimer(matchId);
    
    const match = this.matchManager.getMatch(matchId);
    if (match) {
      match.startMatch();
      
      // Notify all players that game has started
      this.io.to(`match_${matchId}`).emit('gameStarted', {
        timestamp: new Date().toISOString()
      });

      // Send initial room descriptions to all players
      for (const playerId of match.players.keys()) {
        const playerSocket = this.io.sockets.sockets.get(playerId);
        if (playerSocket) {
          const roomDescription = match.getRoomDescription(playerId);
          if (roomDescription) {
            playerSocket.emit('gameMasterMessage', {
              text: `Welcome to the match!\n\n${roomDescription.name}\n\n${roomDescription.description}`,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      console.log(`Match ${matchId} started with ${match.players.size} players`);
    }
  }

  /**
   * Clear countdown timer for a match
   * @param {string} matchId - Match identifier
   */
  clearCountdownTimer(matchId) {
    const timer = this.countdownTimers.get(matchId);
    if (timer) {
      clearInterval(timer);
      this.countdownTimers.delete(matchId);
    }
  }

  /**
   * Handle match cleanup when empty
   * @param {string} matchId - Match identifier
   */
  handleMatchCleanup(matchId) {
    this.clearCountdownTimer(matchId);
    
    // Notify any remaining players
    this.io.to(`match_${matchId}`).emit('matchClosed', {
      message: 'Match has been closed',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get handler statistics
   * @returns {Object} Handler statistics
   */
  getStats() {
    return {
      activeCountdowns: this.countdownTimers.size,
      matchManagerStats: this.matchManager.getStats()
    };
  }
}

module.exports = MatchHandler;