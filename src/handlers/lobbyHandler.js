/**
 * Lobby Handler - Manages lobby experience and player name registration
 * Handles pre-match player interactions and lobby chat
 */

const { validateMessage } = require('../utils/validation');

/**
 * LobbyHandler class manages lobby-specific functionality
 */
class LobbyHandler {
  /**
   * Initialize lobby handler
   * @param {Object} io - Socket.IO server instance
   * @param {Object} matchManager - MatchManager instance
   * @param {Object} playerHandler - PlayerHandler instance
   */
  constructor(io, matchManager, playerHandler) {
    this.io = io;
    this.matchManager = matchManager;
    this.playerHandler = playerHandler;
    
    /** @type {Array<string>} Queue of players waiting for matches */
    this.lobbyQueue = [];
    
    /** @type {Map<string, Object>} Lobby player data */
    this.lobbyPlayers = new Map();
  }

  /**
   * Handle player entering lobby
   * @param {Object} socket - Socket.IO socket
   */
  handleLobbyJoin(socket) {
    try {
      console.log(`Player ${socket.id} joined lobby`);
      
      // Add to lobby queue if not already present
      if (!this.lobbyQueue.includes(socket.id)) {
        this.lobbyQueue.push(socket.id);
      }

      // Store lobby player data
      this.lobbyPlayers.set(socket.id, {
        id: socket.id,
        joinedLobbyAt: new Date(),
        isWaitingForMatch: false
      });

      // Send lobby welcome and instructions
      socket.emit('lobbyJoined', {
        message: 'Welcome to the JogoTesto lobby! Enter your name to join a match.',
        queuePosition: this.lobbyQueue.indexOf(socket.id) + 1,
        totalInQueue: this.lobbyQueue.length,
        timestamp: new Date().toISOString()
      });

      // Send current lobby statistics
      this.sendLobbyStats(socket);

      // Broadcast updated lobby count
      this.broadcastLobbyCount();

    } catch (error) {
      console.error('Error in handleLobbyJoin:', error);
      socket.emit('error', {
        message: 'Failed to join lobby',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle player leaving lobby
   * @param {Object} socket - Socket.IO socket
   */
  handleLobbyLeave(socket) {
    try {
      console.log(`Player ${socket.id} left lobby`);
      
      // Remove from lobby queue
      const queueIndex = this.lobbyQueue.indexOf(socket.id);
      if (queueIndex !== -1) {
        this.lobbyQueue.splice(queueIndex, 1);
      }

      // Remove lobby player data
      this.lobbyPlayers.delete(socket.id);

      // Broadcast updated lobby count
      this.broadcastLobbyCount();

    } catch (error) {
      console.error('Error in handleLobbyLeave:', error);
    }
  }

  /**
   * Handle lobby chat messages
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Chat message data
   */
  handleLobbyChat(socket, data) {
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

      const playerData = this.playerHandler.getPlayerData(socket.id);
      const playerName = playerData?.name || `Player ${socket.id.substring(0, 8)}`;
      
      const chatText = data.text.trim();

      // Check for lobby commands
      if (chatText.startsWith('/')) {
        this.handleLobbyCommand(socket, chatText);
        return;
      }

      // Broadcast lobby chat to all lobby players
      this.io.to('lobby').emit('lobbyChatMessage', {
        playerId: socket.id,
        playerName: playerName,
        text: chatText,
        timestamp: new Date().toISOString(),
        messageType: 'lobbyChat'
      });

      console.log(`Lobby chat from ${socket.id}: ${chatText}`);

    } catch (error) {
      console.error('Error in handleLobbyChat:', error);
      socket.emit('error', {
        message: 'Failed to send lobby message',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle lobby-specific commands
   * @param {Object} socket - Socket.IO socket
   * @param {string} command - Command text
   * @private
   */
  handleLobbyCommand(socket, command) {
    const parts = command.toLowerCase().split(' ');
    const cmd = parts[0];

    switch (cmd) {
    case '/help':
      this.sendLobbyHelp(socket);
      break;
        
    case '/stats':
      this.sendLobbyStats(socket);
      break;
        
    case '/queue':
      this.sendQueueStatus(socket);
      break;
        
    case '/matches':
      this.sendMatchList(socket);
      break;
        
    default:
      socket.emit('lobbyMessage', {
        text: `Unknown command: ${cmd}. Type /help for available commands.`,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Send lobby help information
   * @param {Object} socket - Socket.IO socket
   * @private
   */
  sendLobbyHelp(socket) {
    const helpText = `
Available Lobby Commands:
/help - Show this help message
/stats - Show lobby and match statistics
/queue - Show your position in lobby queue
/matches - Show current active matches

To join a match, simply enter your player name when prompted.
    `.trim();

    socket.emit('lobbyMessage', {
      text: helpText,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send lobby statistics
   * @param {Object} socket - Socket.IO socket
   * @private
   */
  sendLobbyStats(socket) {
    const matchStats = this.matchManager.getStats();
    const playerStats = this.playerHandler.getStats();
    
    const statsText = `
Lobby Statistics:
- Players in lobby: ${this.lobbyQueue.length}
- Total connected players: ${playerStats.totalConnectedPlayers}
- Active matches: ${matchStats.totalMatches}
- Waiting matches: ${matchStats.matchStates.waiting || 0}
- Countdown matches: ${matchStats.matchStates.countdown || 0}
- Active matches: ${matchStats.matchStates.active || 0}
    `.trim();

    socket.emit('lobbyMessage', {
      text: statsText,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send queue status to player
   * @param {Object} socket - Socket.IO socket
   * @private
   */
  sendQueueStatus(socket) {
    const position = this.lobbyQueue.indexOf(socket.id);
    const queueText = position === -1 
      ? 'You are not in the lobby queue.'
      : `You are #${position + 1} in the lobby queue (${this.lobbyQueue.length} total players).`;

    socket.emit('lobbyMessage', {
      text: queueText,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send current match list
   * @param {Object} socket - Socket.IO socket
   * @private
   */
  sendMatchList(socket) {
    const matchStats = this.matchManager.getStats();
    
    if (matchStats.totalMatches === 0) {
      socket.emit('lobbyMessage', {
        text: 'No active matches currently.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const matchText = `
Current Matches:
- Waiting for players: ${matchStats.matchStates.waiting || 0}
- Countdown in progress: ${matchStats.matchStates.countdown || 0}
- Games in progress: ${matchStats.matchStates.active || 0}
- Total matches: ${matchStats.totalMatches}
    `.trim();

    socket.emit('lobbyMessage', {
      text: matchText,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle name validation for match joining
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Name validation data
   */
  handleNameValidation(socket, data) {
    try {
      const { playerName } = data;
      
      // Validate player name
      const validation = this.validatePlayerName(playerName);
      
      if (!validation.isValid) {
        socket.emit('nameValidationResult', {
          isValid: false,
          error: validation.error,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check for name conflicts in active matches
      const nameConflict = this.checkNameConflict(playerName.trim());
      
      if (nameConflict.hasConflict) {
        socket.emit('nameValidationResult', {
          isValid: false,
          error: `Name "${playerName.trim()}" is already in use. Please choose a different name.`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      socket.emit('nameValidationResult', {
        isValid: true,
        playerName: playerName.trim(),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in handleNameValidation:', error);
      socket.emit('error', {
        message: 'Name validation failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Validate player name format
   * @param {string} playerName - Name to validate
   * @returns {Object} Validation result
   * @private
   */
  validatePlayerName(playerName) {
    if (!playerName || typeof playerName !== 'string') {
      return {
        isValid: false,
        error: 'Name is required'
      };
    }

    const trimmed = playerName.trim();
    
    if (trimmed.length === 0) {
      return {
        isValid: false,
        error: 'Name cannot be empty'
      };
    }

    if (trimmed.length > 50) {
      return {
        isValid: false,
        error: 'Name too long (max 50 characters)'
      };
    }

    if (trimmed.length < 2) {
      return {
        isValid: false,
        error: 'Name too short (min 2 characters)'
      };
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(trimmed)) {
      return {
        isValid: false,
        error: 'Name contains invalid characters (only letters, numbers, underscore, hyphen, and spaces allowed)'
      };
    }

    return {
      isValid: true
    };
  }

  /**
   * Check for name conflicts across active matches
   * @param {string} playerName - Name to check
   * @returns {Object} Conflict check result
   * @private
   */
  checkNameConflict(playerName) {
    const normalizedName = playerName.toLowerCase().trim();
    
    // Check all active matches for name conflicts
    for (const [matchId, match] of this.matchManager.matches) {
      for (const [playerId, playerData] of match.players) {
        if (playerData.name.toLowerCase().trim() === normalizedName) {
          return {
            hasConflict: true,
            matchId: matchId,
            conflictingPlayerId: playerId
          };
        }
      }
    }

    return {
      hasConflict: false
    };
  }

  /**
   * Broadcast lobby player count
   * @private
   */
  broadcastLobbyCount() {
    this.io.to('lobby').emit('lobbyPlayerCount', {
      count: this.lobbyQueue.length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Clean up lobby data for disconnected player
   * @param {string} socketId - Socket identifier
   */
  cleanupLobbyPlayer(socketId) {
    this.handleLobbyLeave({ id: socketId });
  }

  /**
   * Get lobby statistics
   * @returns {Object} Lobby statistics
   */
  getStats() {
    return {
      playersInLobby: this.lobbyQueue.length,
      totalLobbyPlayers: this.lobbyPlayers.size
    };
  }
}

module.exports = LobbyHandler;