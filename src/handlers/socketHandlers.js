const { SOCKET_EVENTS } = require('../utils/constants');
const validation = require('../utils/validation');

/**
 * Initializes Socket.io event handlers for a connected socket
 * @param {Socket} socket - Socket.io socket instance
 * @param {Server} io - Socket.io server instance
 * @param {MatchManager} matchManager - Match manager instance
 */
function initializeHandlers(socket, io, matchManager) {

  /**
   * Handle player joining a match
   */
  socket.on(SOCKET_EVENTS.JOIN_MATCH, async (data) => {
    try {
      // Validate input
      const validationResult = validation.validateJoinMatch(data);
      if (!validationResult.valid) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: validationResult.error,
          code: 'VALIDATION_ERROR'
        });
      }

      const { playerName } = validationResult.data;

      // Attempt to join match
      const joinResult = matchManager.joinMatch(socket.id, playerName);

      if (!joinResult.success) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: joinResult.error,
          code: joinResult.code || 'JOIN_FAILED'
        });
      }

      // Join socket room for match
      const matchRoom = `match-${joinResult.match.id}`;
      socket.join(matchRoom);

      // Send confirmation to player
      socket.emit(SOCKET_EVENTS.MATCH_JOINED, {
        player: joinResult.player,
        match: joinResult.match,
        room: joinResult.player.room
      });

      // Notify other players about new player
      socket.to(matchRoom).emit(SOCKET_EVENTS.PLAYER_ENTERED, {
        player: {
          id: joinResult.player.id,
          name: joinResult.player.name
        },
        playerCount: joinResult.match.playerCount
      });

      // Start match if conditions are met
      if (joinResult.shouldStart) {
        const startResult = matchManager.startMatch();
        if (startResult.success) {
          io.to(matchRoom).emit(SOCKET_EVENTS.MATCH_STARTED, {
            match: startResult.match,
            players: startResult.players,
            message: 'The battle begins! Find weapons and survive!'
          });
        }
      }

    } catch (error) {
      console.error('Error handling joinMatch:', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to join match',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * Handle player movement
   */
  socket.on(SOCKET_EVENTS.MOVE, async (data) => {
    try {
      // Validate input
      const validationResult = validation.validateMove(data);
      if (!validationResult.valid) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: validationResult.error,
          code: 'VALIDATION_ERROR'
        });
      }

      const { direction } = validationResult.data;

      // Process move
      const moveResult = matchManager.processPlayerMove(socket.id, direction);

      if (!moveResult.success) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: moveResult.error,
          code: 'MOVE_FAILED'
        });
      }

      const player = matchManager.getPlayerBySocket(socket.id);
      const matchRoom = `match-${matchManager.currentMatch.id}`;

      // Notify old room about player leaving
      if (moveResult.oldRoom) {
        io.to(matchRoom).emit(SOCKET_EVENTS.PLAYER_LEFT, {
          player: { id: player.id, name: player.name },
          room: moveResult.oldRoom
        });
      }

      // Send room update to moving player
      socket.emit(SOCKET_EVENTS.ROOM_UPDATE, {
        room: moveResult.roomData,
        playersInRoom: moveResult.playersInRoom,
        description: moveResult.roomDescription
      });

      // Notify new room about player entering
      socket.to(matchRoom).emit(SOCKET_EVENTS.PLAYER_ENTERED, {
        player: { id: player.id, name: player.name },
        room: moveResult.newRoom,
        playersInRoom: moveResult.playersInRoom
      });

    } catch (error) {
      console.error('Error handling move:', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to process move',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * Handle weapon search
   */
  socket.on(SOCKET_EVENTS.SEARCH, async (data) => {
    try {
      const player = matchManager.getPlayerBySocket(socket.id);
      if (!player) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Player not found',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      // Process weapon search
      const searchResult = matchManager.processWeaponSearch(socket.id);

      if (!searchResult.success) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: searchResult.error,
          code: 'SEARCH_FAILED'
        });
      }

      const matchRoom = `match-${matchManager.currentMatch.id}`;

      // Notify player search started
      socket.emit(SOCKET_EVENTS.SEARCH_STARTED, {
        duration: searchResult.searchDuration,
        message: searchResult.message
      });

      // Notify other players in room about vulnerability
      socket.to(matchRoom).emit(SOCKET_EVENTS.PLAYER_ENTERED, {
        player: {
          id: player.id,
          name: player.name,
          status: 'searching'
        },
        room: player.room,
        message: `${player.name} is searching for weapons and is vulnerable!`
      });

      // Handle search completion
      setTimeout(() => {
        const completionResult = matchManager.gameEngine.completeWeaponSearch(player.id);

        if (completionResult.success) {
          socket.emit(SOCKET_EVENTS.SEARCH_COMPLETED, {
            weaponFound: completionResult.weaponFound,
            weapon: completionResult.weapon,
            message: completionResult.message
          });

          if (completionResult.weaponFound) {
            // Notify room about weapon found
            socket.to(matchRoom).emit(SOCKET_EVENTS.WEAPON_FOUND, {
              player: { id: player.id, name: player.name },
              weapon: completionResult.weapon.name,
              room: player.room
            });
          }
        }
      }, searchResult.searchDuration);

    } catch (error) {
      console.error('Error handling search:', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to process search',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * Handle combat attack
   */
  socket.on(SOCKET_EVENTS.ATTACK, async (data) => {
    try {
      // Validate input
      const validationResult = validation.validateAttack(data);
      if (!validationResult.valid) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: validationResult.error,
          code: 'VALIDATION_ERROR'
        });
      }

      const { targetPlayerId } = validationResult.data;
      const attacker = matchManager.getPlayerBySocket(socket.id);

      if (!attacker) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Player not found',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      // Find target player by ID
      const allPlayers = matchManager.getAllPlayers();
      const target = allPlayers.find(p => p.id === targetPlayerId);

      if (!target) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Target player not found',
          code: 'TARGET_NOT_FOUND'
        });
      }

      // Check if players are in same room
      if (attacker.room !== target.room) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Target player not in same room',
          code: 'NOT_IN_SAME_ROOM'
        });
      }

      const matchRoom = `match-${matchManager.currentMatch.id}`;

      // Initiate combat prompt to target
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.emit(SOCKET_EVENTS.COMBAT_INITIATED, {
          attacker: { id: attacker.id, name: attacker.name },
          attackerStats: attacker.getStats(),
          message: `${attacker.name} wants to attack you! Choose your response.`,
          timeout: 10000 // 10 seconds to respond
        });

        // Set timeout for combat response
        const combatTimeout = setTimeout(() => {
          // If no response, treat as escape attempt
          const escapeResult = matchManager.processEscape(target.socketId);
          handleCombatResult(escapeResult, attacker, target, socket, targetSocket, io, matchRoom);
        }, 10000);

        // Store timeout reference for cleanup
        target.combatTimeout = combatTimeout;
        attacker.initiateCombat(target.id);
      }

    } catch (error) {
      console.error('Error handling attack:', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to process attack',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * Handle escape attempt
   */
  socket.on(SOCKET_EVENTS.ESCAPE, async (data) => {
    try {
      const player = matchManager.getPlayerBySocket(socket.id);
      if (!player) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Player not found',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      // Clear combat timeout if exists
      if (player.combatTimeout) {
        clearTimeout(player.combatTimeout);
        delete player.combatTimeout;
      }

      const escapeResult = matchManager.processEscape(socket.id);
      const matchRoom = `match-${matchManager.currentMatch.id}`;

      handleEscapeResult(escapeResult, player, socket, io, matchRoom);

    } catch (error) {
      console.error('Error handling escape:', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to process escape',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  /**
   * Handle combat response (attack back)
   */
  socket.on('combatResponse', async (data) => {
    try {
      const { response, attackerId } = data;
      const defender = matchManager.getPlayerBySocket(socket.id);

      if (!defender) {
        return socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Player not found',
          code: 'PLAYER_NOT_FOUND'
        });
      }

      // Clear combat timeout
      if (defender.combatTimeout) {
        clearTimeout(defender.combatTimeout);
        delete defender.combatTimeout;
      }

      const allPlayers = matchManager.getAllPlayers();
      const attacker = allPlayers.find(p => p.id === attackerId);
      const matchRoom = `match-${matchManager.currentMatch.id}`;

      if (response === 'attack') {
        // Process combat
        const combatResult = matchManager.processCombat(attacker.socketId, socket.id);
        handleCombatResult(combatResult, attacker, defender,
          io.sockets.sockets.get(attacker.socketId), socket, io, matchRoom);
      } else if (response === 'escape') {
        // Process escape
        const escapeResult = matchManager.processEscape(socket.id);
        handleEscapeResult(escapeResult, defender, socket, io, matchRoom);
      }

    } catch (error) {
      console.error('Error handling combat response:', error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to process combat response',
        code: 'INTERNAL_ERROR'
      });
    }
  });
}

/**
 * Handles combat result and notifications
 */
function handleCombatResult(combatResult, attacker, defender, attackerSocket, defenderSocket, io, matchRoom) {
  if (!combatResult.success) {
    if (attackerSocket) {attackerSocket.emit(SOCKET_EVENTS.ERROR, { message: combatResult.error });}
    if (defenderSocket) {defenderSocket.emit(SOCKET_EVENTS.ERROR, { message: combatResult.error });}
    return;
  }

  // Notify participants
  if (attackerSocket) {
    attackerSocket.emit(SOCKET_EVENTS.COMBAT_RESULT, {
      result: 'victory',
      winner: combatResult.winner,
      loser: combatResult.loser,
      reason: combatResult.reason,
      newStats: combatResult.winner.id === attacker.id ? combatResult.winner : combatResult.loser
    });
  }

  if (defenderSocket) {
    defenderSocket.emit(SOCKET_EVENTS.COMBAT_RESULT, {
      result: combatResult.winner.id === defender.id ? 'victory' : 'defeat',
      winner: combatResult.winner,
      loser: combatResult.loser,
      reason: combatResult.reason
    });
  }

  // Notify room
  io.to(matchRoom).emit('combatCompleted', {
    winner: combatResult.winner,
    loser: combatResult.loser,
    room: attacker.room,
    message: `${combatResult.winner.name} defeated ${combatResult.loser.name}!`
  });

  // Check if match ended
  checkMatchEnd(io, matchRoom);
}

/**
 * Handles escape result and notifications
 */
function handleEscapeResult(escapeResult, player, socket, io, matchRoom) {
  if (!escapeResult.success) {
    return socket.emit(SOCKET_EVENTS.ERROR, { message: escapeResult.error });
  }

  if (escapeResult.escaped) {
    socket.emit('escapeSuccess', {
      newRoom: escapeResult.newRoom,
      message: escapeResult.message,
      moveResult: escapeResult.moveResult
    });

    io.to(matchRoom).emit('playerEscaped', {
      player: { id: player.id, name: player.name },
      message: `${player.name} escaped to safety!`
    });
  } else {
    socket.emit('escapeFailure', {
      message: escapeResult.message,
      died: escapeResult.died
    });

    io.to(matchRoom).emit('playerDied', {
      player: { id: player.id, name: player.name },
      reason: 'Failed escape attempt',
      message: `${player.name} failed to escape and died!`
    });

    checkMatchEnd(io, matchRoom);
  }
}

/**
 * Checks if match has ended and notifies players
 */
function checkMatchEnd(io, matchRoom) {
  // This will be called by MatchManager when match ends
  // Implementation depends on how match end events are handled
}

module.exports = {
  initializeHandlers
};