/**
 * HTTP request handlers for REST API endpoints
 */

/**
 * Health check endpoint
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function getStatus(req, res) {
  try {
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    res.status(200).json(status);
  } catch (error) {
    console.error('Error in getStatus:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get current match information
 * Returns a function that has access to matchManager
 * @param {MatchManager} matchManager - Match manager instance
 * @returns {Function} Express route handler
 */
function getMatches(matchManager) {
  return (req, res) => {
    try {
      // Set CORS headers for development
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (!matchManager) {
        return res.status(500).json({
          error: 'Match manager not available',
          timestamp: new Date().toISOString()
        });
      }

      const matchStats = matchManager.getMatchStats();
      const currentMatch = matchManager.getMatchInfo();

      const response = {
        current: {
          id: currentMatch.id,
          status: currentMatch.status,
          playerCount: currentMatch.playerCount,
          maxPlayers: currentMatch.maxPlayers,
          minPlayersToStart: currentMatch.minPlayersToStart,
          startTime: currentMatch.startTime,
          winner: currentMatch.winner,
          canJoin: currentMatch.status === 'waiting' && currentMatch.playerCount < currentMatch.maxPlayers
        },
        history: matchStats.history.map(match => ({
          id: match.id,
          winner: match.winner,
          playerCount: match.playerCount,
          duration: match.duration,
          endTime: match.endTime
        })),
        stats: {
          totalMatches: matchStats.totalMatches,
          averageDuration: matchStats.history.length > 0
            ? Math.round(matchStats.history.reduce((sum, m) => sum + m.duration, 0) / matchStats.history.length)
            : 0
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Error in getMatches:', error);
      res.status(500).json({
        error: 'Failed to retrieve match information',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Get game configuration and rules
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function getGameInfo(req, res) {
  try {
    const { GAME_CONFIG, WEAPONS } = require('../utils/constants');

    const gameInfo = {
      rules: {
        maxPlayers: GAME_CONFIG.MAX_PLAYERS,
        minPlayersToStart: GAME_CONFIG.MIN_PLAYERS_TO_START,
        weaponSearchDuration: GAME_CONFIG.WEAPON_SEARCH_DURATION,
        escapeSuccessChance: GAME_CONFIG.ESCAPE_SUCCESS_CHANCE,
        basePlayerStrength: GAME_CONFIG.BASE_PLAYER_STRENGTH
      },
      weapons: Object.entries(WEAPONS).map(([key, weapon]) => ({
        type: key,
        name: weapon.name,
        damage: weapon.damage,
        rarity: weapon.rarity,
        description: weapon.description
      })),
      controls: {
        movement: {
          'w': 'Move North',
          'a': 'Move West',
          's': 'Move South',
          'd': 'Move East'
        },
        actions: {
          'search': 'Search for weapons (makes you vulnerable for 2 seconds)',
          'attack': 'Attack another player in the same room',
          'escape': 'Attempt to escape from combat'
        }
      },
      gameplay: {
        objective: 'Be the last player standing',
        combat: 'Player with higher attack power (strength + weapon damage) wins',
        weapons: 'Search rooms for weapons, but you become vulnerable while searching',
        strength: 'Gain +1 strength for each combat victory',
        escape: '50% chance to escape combat, but failure means instant death'
      },
      timestamp: new Date().toISOString()
    };

    res.status(200).json(gameInfo);
  } catch (error) {
    console.error('Error in getGameInfo:', error);
    res.status(500).json({
      error: 'Failed to retrieve game information',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function handleOptions(req, res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(200).end();
}

/**
 * 404 handler for unknown routes
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
function handleNotFound(req, res) {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    available: [
      'GET /api/status - Health check',
      'GET /api/matches - Current match information',
      'GET /api/info - Game rules and information'
    ],
    timestamp: new Date().toISOString()
  });
}

/**
 * Global error handler
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware function
 */
function handleError(err, req, res, next) {
  console.error('HTTP Error:', err);

  // Don't send error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const errorResponse = {
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  };

  if (isDevelopment) {
    errorResponse.message = err.message;
    errorResponse.stack = err.stack;
    errorResponse.path = req.path;
    errorResponse.method = req.method;
  }

  res.status(500).json(errorResponse);
}

/**
 * Request logging middleware
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware function
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    console.log(`${method} ${url} ${statusCode} ${duration}ms - ${ip}`);
  });

  next();
}

/**
 * Rate limiting middleware for API endpoints
 * @param {number} limit - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Express middleware
 */
function rateLimiter(limit = 100, windowMs = 60000) {
  const { checkRateLimit } = require('../utils/validation');

  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const result = checkRateLimit(identifier, 'api', limit, windowMs);

    res.set({
      'X-RateLimit-Limit': limit,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': result.resetTime
    });

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

module.exports = {
  getStatus,
  getMatches,
  getGameInfo,
  handleOptions,
  handleNotFound,
  handleError,
  requestLogger,
  rateLimiter
};