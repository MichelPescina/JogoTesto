# Product Requirement Prompt: MatchSystem

## Overview

Transform JogoTesto from a single-game world to a Battle Royale matchmaking system supporting multiple concurrent matches. Each match accommodates up to 50 players with automated lobby countdown, isolated game worlds, and robust reconnection handling. The system includes player name registration, persistent match/player IDs with client-side cookie storage, and fallback mechanisms for disconnected or invalid sessions.

## Technical Context

### Current Codebase Status
- **Existing Foundation**: Full multiplayer RPG engine with Socket.IO v4.8.1, room navigation, player management
- **Current Architecture**: Single shared world using one RoomSystem instance, `connectedPlayers` Map, `gameRoom` Socket.IO room
- **Dependencies**: socket.io v4.8.1, express, existing validation utilities, room management system
- **Development Commands**: `npm test` (node:test), `npm run lint` (ESLint)
- **Development Rules**: 500-line file limit, TDD approach, JSDoc documentation, modular design

### Existing Code Patterns to Follow
**Server Structure**: `src/server.js` (501 lines) - needs refactoring into match management modules
**Room Management**: `src/systems/roomSystem.js` - proven pattern for isolated world state
**Player Tracking**: `connectedPlayers Map` with player metadata - extend for match-specific data  
**Validation**: `src/utils/validation.js` - established patterns for input sanitization
**Socket Configuration**: `src/config/socket.js` - optimized for multiplayer performance

### Architectural Constraints
- **File Size Limit**: No file over 500 lines - requires modular decomposition
- **Existing Patterns**: Reuse RoomSystem class, validation utilities, socket event patterns
- **State Management**: Current in-memory approach works for 50 players per match
- **Error Handling**: Follow existing error-first callback patterns

## Architecture Blueprint

### Core Match System Structure
```javascript
// Match management hierarchy
class MatchManager {
  constructor() {
    this.matches = new Map();           // matchId -> Match instance
    this.playerMatchMap = new Map();    // playerId -> matchId
    this.matchQueue = [];               // Players waiting for matches
  }
  
  findOrCreateMatch(playerId, playerName) {
    // Look for available match (< 50 players, not started)
    // Create new match if none available
    // Add player to match and start countdown if 10+ players
  }
}

class Match {
  constructor(matchId) {
    this.id = matchId;
    this.players = new Map();          // playerId -> playerData
    this.roomSystem = new RoomSystem(); // Isolated world per match
    this.state = 'waiting';            // waiting -> countdown -> active -> finished
    this.countdown = null;             // Timer reference
    this.maxPlayers = 50;
    this.minPlayers = 10;
  }
}
```

### Socket.IO Room Architecture
```javascript
// Current: Single 'gameRoom' for all players
// New: Dynamic rooms per match
io.on('connection', (socket) => {
  // Initial lobby connection - no match assigned
  socket.join('lobby');
  
  socket.on('joinMatch', (data) => {
    const { playerName } = data;
    const matchId = matchManager.findOrCreateMatch(socket.id, playerName);
    
    // Move from lobby to match-specific room
    socket.leave('lobby');
    socket.join(`match_${matchId}`);
    
    // Send match and player IDs for client storage
    socket.emit('matchAssigned', { matchId, playerId: socket.id });
  });
});
```

### Client-Side Cookie Integration
```javascript
// Client-side session persistence
const SessionManager = {
  saveMatchData(matchId, playerId) {
    document.cookie = `gameSession=${JSON.stringify({matchId, playerId})}; max-age=86400`;
  },
  
  getMatchData() {
    const match = document.cookie.match(/gameSession=([^;]+)/);
    return match ? JSON.parse(match[1]) : null;
  },
  
  clearSession() {
    document.cookie = 'gameSession=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }
};

// Reconnection flow
socket.on('connect', () => {
  const session = SessionManager.getMatchData();
  if (session) {
    socket.emit('reconnectToMatch', session);
  }
});
```

### Countdown Timer Implementation
```javascript
// Server-side countdown per match
class Match {
  startCountdown() {
    if (this.players.size < this.minPlayers) return;
    
    this.state = 'countdown';
    let timeLeft = 60;
    
    this.countdown = setInterval(() => {
      // Broadcast to match room only
      io.to(`match_${this.id}`).emit('countdownUpdate', { timeLeft });
      
      timeLeft--;
      if (timeLeft <= 0) {
        this.startMatch();
        clearInterval(this.countdown);
      }
    }, 1000);
  }
  
  startMatch() {
    this.state = 'active';
    io.to(`match_${this.id}`).emit('gameStarted');
    // Initialize game-specific logic
  }
}
```

## Implementation Roadmap

### Phase 1: Core Match Management (Priority: Critical)
1. **Create MatchManager class** (`src/systems/matchManager.js`)
   - Match finding and creation logic
   - Player-to-match mapping
   - Match state management
   - Queue management for waiting players

2. **Create Match class** (`src/systems/match.js`)
   - Individual match state and player management
   - Isolated RoomSystem instance per match
   - Countdown timer functionality
   - Match lifecycle management (waiting -> countdown -> active -> finished)

3. **Refactor server.js into modules** (exceeds 500 lines)
   - Extract match handling to `src/handlers/matchHandler.js`
   - Extract player management to `src/handlers/playerHandler.js`
   - Keep main server file under 500 lines

### Phase 2: Player Registration & Persistence (Priority: High)
4. **Implement player name registration** (`src/handlers/lobbyHandler.js`)
   - Player name input validation and sanitization
   - Unique player ID generation (UUID-based)
   - Player name conflicts handling within matches

5. **Add session persistence** (`src/utils/sessionManager.js`)
   - Server-side session validation
   - Client-side cookie management utilities
   - Reconnection token generation and validation

6. **Update client-side code** (`public/client.js`)
   - Name registration UI
   - Cookie storage for match/player IDs
   - Reconnection handling

### Phase 3: Socket Room Management (Priority: High)
7. **Implement dynamic room system**
   - Lobby room for unmatched players
   - Match-specific rooms (`match_${matchId}`)
   - Room switching on match assignment

8. **Update message broadcasting**
   - Match-isolated chat and game messages
   - Lobby broadcast for waiting players
   - Cross-room communication restrictions

### Phase 4: Reconnection & Error Handling (Priority: Medium)
9. **Robust reconnection logic**
   - Match validation on reconnection attempts
   - Player state restoration
   - Fallback to lobby for invalid sessions

10. **Error handling and edge cases**
    - Match full scenarios
    - Player timeout in lobby
    - Server restart match recovery
    - Graceful match cleanup

## Technical References

### Socket.IO Documentation
- **Rooms**: https://socket.io/docs/v4/rooms/
- **Namespaces**: https://socket.io/docs/v4/namespaces/
- **Connection State Recovery**: https://socket.io/docs/v4/connection-state-recovery

### Matchmaking System Patterns
- **Queue-Based Matchmaking**: https://stackoverflow.com/questions/59937407/node-js-two-concepts-of-matchmaking-socket-io-am-i-right
- **Multiple Game Room Management**: https://softwareengineering.stackexchange.com/questions/393095/nodejs-socketio-multiplayer-multiple-game-room-management
- **Countdown Timer Implementation**: https://robdodson.me/posts/building-a-countdown-timer-with-socket-dot-io/

### Battle Royale Architecture References
- **Scalable Server Architecture**: https://gamedev.stackexchange.com/questions/192734/what-server-architecture-should-i-use-for-matchmaking-in-node-js
- **Battle Royale Repository**: https://github.com/sru/battle-royale
- **Multiplayer Framework**: https://colyseus.io/

### Key Socket.IO Concepts for Match System
- **Dynamic Room Management**: `socket.join()` and `socket.leave()` for match transitions
- **Room-Specific Broadcasting**: `io.to('room').emit()` for match isolation  
- **Connection State Recovery**: Automatic reconnection with session restoration
- **Namespace Isolation**: Potential future scaling with match-specific namespaces

## Error Handling Strategy

### Match Management Errors
```javascript
// Robust match assignment with fallbacks
function assignPlayerToMatch(playerId, playerName) {
  try {
    // Validate player name
    const nameValidation = validatePlayerName(playerName);
    if (!nameValidation.isValid) {
      return { success: false, error: nameValidation.error };
    }
    
    // Find or create match
    const availableMatch = findAvailableMatch();
    if (!availableMatch) {
      const newMatch = createNewMatch();
      return assignPlayerToMatch(playerId, playerName, newMatch.id);
    }
    
    return { success: true, matchId: availableMatch.id };
  } catch (error) {
    console.error('Match assignment failed:', error);
    return { success: false, error: 'Unable to assign match' };
  }
}
```

### Reconnection Error Handling
```javascript
// Graceful session validation with fallback
socket.on('reconnectToMatch', (sessionData) => {
  try {
    const { matchId, playerId } = sessionData;
    
    // Validate session data
    if (!matchManager.validateSession(matchId, playerId)) {
      socket.emit('sessionInvalid');
      socket.join('lobby');
      return;
    }
    
    // Restore player to match
    const match = matchManager.getMatch(matchId);
    match.reconnectPlayer(playerId, socket);
    socket.join(`match_${matchId}`);
    
  } catch (error) {
    console.error('Reconnection failed:', error);
    socket.emit('reconnectionFailed');
    socket.join('lobby');
  }
});
```

### Timer Management Error Handling
```javascript
// Countdown cleanup and error recovery
class Match {
  cleanup() {
    if (this.countdown) {
      clearInterval(this.countdown);
      this.countdown = null;
    }
    
    // Notify players of cleanup
    io.to(`match_${this.id}`).emit('matchClosed');
    
    // Move players back to lobby
    for (const [playerId, playerData] of this.players) {
      const socket = io.sockets.sockets.get(playerId);
      if (socket) {
        socket.leave(`match_${this.id}`);
        socket.join('lobby');
      }
    }
  }
}
```

## File Structure
```
src/
├── server.js                    # Main server (refactored, <500 lines)
├── systems/
│   ├── roomSystem.js            # Existing room management
│   ├── matchManager.js          # Match finding/creation logic
│   └── match.js                 # Individual match management
├── handlers/
│   ├── matchHandler.js          # Match-related socket events
│   ├── playerHandler.js         # Player connection/disconnection
│   └── lobbyHandler.js          # Lobby and name registration
├── utils/
│   ├── validation.js            # Existing validation (extend)
│   ├── sessionManager.js        # Session persistence utilities
│   └── idGenerator.js           # UUID generation for matches/players
└── config/
    └── socket.js                # Existing socket configuration

public/
├── client.js                    # Extended for match system
├── lobbyClient.js               # Lobby-specific client logic  
└── sessionManager.js            # Client-side session handling

tests/
├── systems/
│   ├── matchManager.test.js     # Match management tests
│   └── match.test.js            # Individual match tests
└── integration/
    └── matchSystem.test.js      # End-to-end match system tests
```

## Validation Gates

### 1. Code Quality and Architecture
```bash
# Lint check - must pass
npm run lint

# File size validation - all files must be under 500 lines
find src -name "*.js" -exec wc -l {} \; | awk '$1 > 500 {print "File " $2 " exceeds 500 lines (" $1 " lines)"}'

# Unit tests - must pass
npm test
```

### 2. Basic Match System Functionality
```bash
# Start server
npm start

# Manual test steps:
# 1. Open http://localhost:3000
# 2. Enter player name in lobby
# 3. Verify match assignment and room creation
# 4. Check player ID and match ID are received
# 5. Verify cookie storage works (refresh page, should reconnect)
```

### 3. Multi-Player Match Creation
```bash
# Manual test with multiple browser tabs:
# 1. Open 10+ tabs to http://localhost:3000
# 2. Enter different names in each tab
# 3. Verify countdown starts at 10th player
# 4. Confirm all players receive countdown updates
# 5. Verify game starts after 60 seconds
```

### 4. Match Isolation Testing
```bash
# Test multiple concurrent matches:
# 1. Create first match with 10+ players
# 2. Open additional tabs (should create second match)
# 3. Verify players in different matches don't see each other's messages
# 4. Confirm each match has independent countdown timers
# 5. Test room navigation within each match is isolated
```

### 5. Reconnection Handling
```bash
# Test session persistence:
# 1. Join a match and note player/match IDs
# 2. Refresh browser tab
# 3. Verify automatic reconnection to same match
# 4. Close tab and reopen in new window
# 5. Confirm cookie-based session restoration works
# 6. Test with invalid/expired sessions (should redirect to lobby)
```

### 6. Error Handling and Edge Cases
```bash
# Test system robustness:
# 1. Attempt to join full match (50 players)
# 2. Test server restart during active matches
# 3. Verify cleanup of abandoned matches
# 4. Test invalid player names (empty, too long, special characters)
# 5. Confirm graceful handling of network disconnections
```

### 7. Performance Validation
```bash
# Load testing with multiple matches:
# 1. Create 3 concurrent matches with 50 players each
# 2. Monitor server memory usage and response times
# 3. Test message broadcasting performance within matches
# 4. Verify countdown timers remain synchronized under load
# 5. Confirm no memory leaks during extended operation
```

## Success Criteria

### Functional Requirements
- [x] Match system supports up to 50 players per match
- [x] Countdown starts automatically with 10+ players (60 seconds)
- [x] Player name registration with validation
- [x] Automatic match finding and creation
- [x] Unique player and match ID generation
- [x] Client-side cookie storage for session persistence
- [x] Reconnection handling with fallback to lobby
- [x] Isolated game worlds per match (separate RoomSystem instances)
- [x] Match-specific chat and game event broadcasting

### Technical Requirements
- [x] Modular architecture with files under 500 lines each
- [x] Extends existing RoomSystem for per-match worlds
- [x] Reuses existing validation and socket patterns
- [x] JSDoc documentation for all public methods
- [x] Error-first callbacks and proper async handling
- [x] TDD approach with comprehensive test coverage
- [x] Follows KISS and YAGNI principles

### Performance Requirements
- [x] Supports multiple concurrent matches (target: 5 matches, 250 total players)
- [x] Countdown timers remain synchronized across all match players
- [x] Sub-second message delivery within matches
- [x] Automatic cleanup of finished/abandoned matches
- [x] Memory efficient match management (no memory leaks)
- [x] Graceful handling of server restarts

### User Experience Requirements
- [x] Seamless transition from lobby to match
- [x] Clear countdown timer display for all players
- [x] Automatic reconnection preserves match state
- [x] Intuitive error messages for edge cases
- [x] Responsive UI during match transitions

## Implementation Priority

1. **Critical**: MatchManager and Match classes with basic lifecycle
2. **Critical**: Server.js refactoring into modular components  
3. **High**: Player name registration and session persistence
4. **High**: Dynamic Socket.IO room management
5. **High**: Countdown timer implementation and synchronization
6. **Medium**: Reconnection logic and error handling
7. **Medium**: Client-side UI updates for match system
8. **Medium**: Comprehensive testing and edge case handling
9. **Low**: Performance optimizations and monitoring
10. **Low**: Advanced features (spectator mode, match history)

## Risk Mitigation

### Known Issues and Solutions
- **File Size Constraints**: Server.js (501 lines) requires immediate refactoring into handlers
- **State Synchronization**: Use server-side countdown timers, broadcast updates to avoid client drift
- **Memory Management**: Implement automatic match cleanup for finished/abandoned games
- **Socket Room Complexity**: Follow existing patterns, extensive testing for room transitions
- **Session Security**: Generate cryptographically secure session tokens, validate thoroughly

### Development Guidelines
- **Follow CLAUDE.md Rules**: File size limits, JSDoc comments, error-first patterns
- **Extend, Don't Replace**: Build on existing RoomSystem, validation, socket patterns
- **Modular Design**: Separate concerns into focused modules for maintainability  
- **Error Handling**: Comprehensive error handling at every level (network, validation, state)
- **Testing Strategy**: Unit tests for individual classes, integration tests for workflows

### Integration Challenges
- **RoomSystem Isolation**: Each match needs independent RoomSystem instance
- **Socket Event Conflicts**: Ensure match-specific events don't interfere with lobby
- **Memory Scaling**: Monitor memory usage with multiple RoomSystem instances
- **State Recovery**: Handle server restarts gracefully, restore or cleanup matches

## Confidence Score: 8/10

This PRP provides comprehensive context for one-pass implementation including:
- ✅ **Complete codebase analysis**: Detailed examination of existing server, room, and player management
- ✅ **Proven architecture patterns**: Builds on existing RoomSystem and Socket.IO room management
- ✅ **External research integration**: Incorporates best practices from Socket.IO docs and battle royale systems
- ✅ **Clear implementation blueprint**: Modular design with specific code examples
- ✅ **Detailed roadmap**: Phase-by-phase development plan with clear priorities
- ✅ **Executable validation gates**: Specific manual and automated tests
- ✅ **Comprehensive error handling**: Covers network, state, and edge case scenarios
- ✅ **Risk mitigation strategies**: Addresses file size, complexity, and integration challenges

The implementation should succeed in one pass given the thorough foundation analysis, proven Socket.IO patterns, detailed technical context, and clear modular architecture. The minor risk stems from the complexity of managing multiple isolated game worlds, but the existing RoomSystem pattern significantly reduces this risk.