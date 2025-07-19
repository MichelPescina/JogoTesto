/**
 * Session Authentication Middleware for Socket.IO
 * Handles player session validation and creation
 */

/**
 * Create session authentication middleware
 * @param {SessionManager} sessionManager - Session manager instance
 * @returns {Function} Socket.IO middleware function
 */
function createSessionAuthMiddleware(sessionManager) {
  /**
   * Socket.IO authentication middleware
   * @param {Object} socket - Socket.IO socket instance
   * @param {Function} next - Middleware next function
   */
  return function sessionAuthMiddleware(socket, next) {
    try {
      console.log(`Authentication attempt for socket ${socket.id}`);
      
      // Extract authentication data from handshake
      const { sessionID, playerID, username } = socket.handshake.auth || {};
      
      // Case 1: Existing session reconnection
      if (sessionID && playerID) {
        console.log(`Attempting session restoration: ${sessionID} for player ${playerID}`);
        
        const validation = sessionManager.validateSession(sessionID, playerID);
        
        if (validation.isValid) {
          // Valid existing session - restore session data
          const session = validation.session;
          
          socket.sessionID = session.sessionID;
          socket.playerID = session.playerID;
          socket.username = session.username;
          socket.matchID = session.matchID;
          
          // Update activity
          sessionManager.updateActivity(sessionID);
          
          console.log(`Session restored for player ${session.playerID} (${session.username})`);
          return next();
        } else {
          // Invalid session - log reason and create new session
          console.log(`Session validation failed: ${validation.error}`);
          // Continue to create new session below
        }
      }
      
      // Case 2: New session creation
      console.log(`Creating new session for socket ${socket.id}`);
      
      // Use provided username or generate default
      const playerUsername = username && username.trim() 
        ? username.trim() 
        : `Player_${Date.now().toString(36)}`;
      
      // Validate username
      if (playerUsername.length < 2 || playerUsername.length > 20) {
        return next(new Error('Username must be between 2 and 20 characters'));
      }
      
      // Create new session
      const session = sessionManager.createNewPlayerSession(playerUsername);
      
      socket.sessionID = session.sessionID;
      socket.playerID = session.playerID;
      socket.username = session.username;
      socket.matchID = null;
      
      console.log(`New session created for player ${session.playerID} (${session.username})`);
      return next();
      
    } catch (error) {
      console.error('Session authentication error:', error);
      return next(new Error(`Authentication failed: ${error.message}`));
    }
  };
}

/**
 * Middleware to update player activity on each message
 * @param {SessionManager} sessionManager - Session manager instance
 * @returns {Function} Socket event middleware
 */
function createActivityUpdateMiddleware(sessionManager) {
  return function updateActivityMiddleware(socket, next) {
    // Update session activity on any message
    if (socket.sessionID) {
      sessionManager.updateActivity(socket.sessionID);
    }
    next();
  };
}

/**
 * Middleware to validate player is in correct state for actions
 * @param {MatchManager} matchManager - Match manager instance (optional)
 * @returns {Function} Socket event middleware
 */
function createPlayerStateValidationMiddleware(matchManager = null) {
  return function playerStateValidationMiddleware(socket, data, next) {
    // Ensure player has valid session
    if (!socket.sessionID || !socket.playerID) {
      socket.emit('error', {
        message: 'Invalid session - please refresh the page',
        action: 'REFRESH_PAGE'
      });
      return; // Don't call next() to prevent further processing
    }
    
    // Validate match state if matchManager is provided
    if (matchManager && data && data.requiresMatch) {
      const playerMatch = matchManager.getPlayerMatch(socket.playerID);
      if (!playerMatch) {
        socket.emit('error', {
          message: 'You are not in an active match',
          action: 'SHOW_LOBBY'
        });
        return;
      }
    }
    
    next();
  };
}

/**
 * Handle authentication errors gracefully
 * @param {Object} socket - Socket.IO socket instance
 * @param {Error} error - Authentication error
 */
function handleAuthError(socket, error) {
  console.error(`Authentication error for socket ${socket.id}:`, error.message);
  
  socket.emit('authError', {
    message: 'Authentication failed',
    details: error.message,
    action: 'RETRY_CONNECTION'
  });
  
  socket.disconnect(true);
}

/**
 * Validate session data format
 * @param {Object} authData - Authentication data from client
 * @returns {Object} Validation result
 */
function validateAuthData(authData) {
  if (!authData || typeof authData !== 'object') {
    return { isValid: false, error: 'Missing authentication data' };
  }
  
  const { sessionID, playerID, username } = authData;
  
  // If sessionID provided, playerID must also be provided
  if (sessionID && !playerID) {
    return { isValid: false, error: 'PlayerID required with sessionID' };
  }
  
  // If playerID provided, sessionID must also be provided
  if (playerID && !sessionID) {
    return { isValid: false, error: 'SessionID required with playerID' };
  }
  
  // Validate username if provided
  if (username && (typeof username !== 'string' || username.length === 0)) {
    return { isValid: false, error: 'Invalid username format' };
  }
  
  return { isValid: true };
}

module.exports = {
  createSessionAuthMiddleware,
  createActivityUpdateMiddleware,
  createPlayerStateValidationMiddleware,
  handleAuthError,
  validateAuthData
};