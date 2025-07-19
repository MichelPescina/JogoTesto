# Product Requirement Prompt: MatchSystem

## Overview

Transform JogoTesto from a single shared world to a Battle Royale multiplayer system supporting multiple concurrent matches. Each match accommodates up to 50 players with isolated game worlds, proper session management for seamless reconnections, and a matchmaking system that creates matches when minimum player thresholds are met.

## Technical Context

### Current Codebase Status
- **Established Multiplayer Foundation**: Functional Socket.IO v4.8.1 server with real-time communication
- **Sophisticated Room System**: Complete `RoomSystem` class with JSON-based world loading, navigation, and room-based chat
- **Player Management**: Basic socket-based player tracking with `connectedPlayers` Map
- **Current Architecture**: Single shared world with all players in one "gameRoom"
- **Client Interface**: Web-based client with Socket.IO connection and real-time messaging
- **Testing Infrastructure**: Comprehensive unit tests using node:test framework

### Current File Structure
```
src/
├── server.js              # Main server (501 lines) - needs refactoring for matches
├── systems/
│   └── roomSystem.js       # Room management (362 lines) - to be instantiated per match
├── config/socket.js        # Socket configuration (45 lines)
└── utils/validation.js     # Message validation (existing patterns to follow)
public/
├── client.js              # Client Socket.IO handling (444+ lines) - needs session management
├── index.html             # Client interface
└── style.css              # Client styling
data/
└── rooms.json             # World definition (188 lines) - template for match worlds
tests/
├── roomSystem.test.js     # Room system tests (446 lines) - patterns to follow
├── server.test.js         # Server tests
└── integration.test.js    # Multi-client tests
```

### Critical Current Implementation Issues
**Problem**: Current `socket.id` used as playerID changes on every reconnection, breaking player continuity (from `src/server.js:54-61`):
```javascript
const playerName = `Player ${socket.id.substring(0, 8)}`;
connectedPlayers.set(socket.id, {
  id: socket.id,  // ❌ This changes on reconnection!
  name: playerName,
  // ... other fields
});
```

**Problem**: Single global `RoomSystem` instance serves all players (from `src/server.js:26`):
```javascript
const roomSystem = new RoomSystem(); // ❌ Single world for all players
```

### Existing Patterns to Follow

**Socket Event Handling Pattern** (from `src/server.js:103-142`):
```javascript
socket.on('playerMessage', (data) => {
  // Validate message
  const validationResult = validateMessage(data);
  if (!validationResult.isValid) {
    socket.emit('error', { message: validationResult.error });
    return;
  }
  // Process command with room context
});
```

**Room System Integration** (from `src/server.js:234-292`):
```javascript
function handleMoveCommand(socket, message) {
  const moveResult = roomSystem.movePlayer(socket.id, direction);
  if (!moveResult.success) {
    socket.emit('gameMasterMessage', { text: moveResult.error });
    return;
  }
  // Update player location and notify room occupants
}
```

**Comprehensive Error Handling** (from `src/server.js:450-470`):
```javascript
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
```

## Feature Requirements Analysis

From `features/250718_MatchSystem.md`:

### Core Requirements
1. **Match Capacity**: Maximum 50 concurrent players per match
2. **Player Identity**: Persistent playerID + sessionID with cookie storage for reconnections  
3. **Match World Isolation**: Each match creates its own RoomSystem instance
4. **Match Lifecycle**: Start with minimum 10 players, allow forfeit anytime
5. **Dynamic Room Loading**: Server handles different Room files per match
6. **Player Naming**: Custom name selection when joining matches

### Technical Requirements
- **Session Persistence**: Cookie-based sessionID for reconnection handling
- **Player Identification**: Stable playerID separate from socket.id
- **Match Management**: Queue system for matchmaking and match creation
- **World Isolation**: Separate RoomSystem instances per match
- **State Recovery**: Reconnection to correct match with preserved state

## External Research Integration

### Socket.IO Session Management Best Practices
Based on Socket.IO v4 documentation and 2024 patterns:

**Two-ID System Pattern** (Socket.IO official recommendation):
```javascript
// Authentication middleware for session restoration
io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  if (sessionID) {
    // Find existing session
    const session = sessionStore.findSession(sessionID);
    if (session) {
      socket.sessionID = sessionID;
      socket.playerID = session.playerID;
      socket.username = session.username;
      return next();
    }
  }
  // Create new session for new players
  socket.sessionID = randomId();
  socket.playerID = randomId();
  next();
});
```

**Client-Side Session Persistence** (localStorage + cookies pattern):
```javascript
// Client session management
socket.on("session", ({ sessionID, playerID }) => {
  socket.auth = { sessionID };
  localStorage.setItem("sessionID", sessionID);
  socket.playerID = playerID;
});
```

### Matchmaking System Architecture
Based on battle royale game research and Socket.IO room patterns:

**Waiting Room Pattern**:
- Central matchmaking queue for players seeking games
- Room-based match isolation using `io.to(matchId).emit()`
- In-memory match state management for performance

**Match Instance Management**:
```javascript
class MatchManager {
  constructor() {
    this.activeMatches = new Map(); // matchId -> Match instance
    this.waitingQueue = new Set(); // players waiting for match
    this.playerMatches = new Map(); // playerID -> matchId
  }
}
```

### Battle Royale Implementation Examples
From GitHub research and multiplayer game patterns:
- **Match Rooms**: Each match uses Socket.IO room for player isolation
- **State Synchronization**: Per-match game state with efficient broadcasting
- **Reconnection Handling**: Session-based match rejoining with state recovery

## Architecture Blueprint

### Enhanced Session Management System
```javascript
// New module: src/systems/sessionManager.js
class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionID -> session data
    this.playerSessions = new Map(); // playerID -> sessionID
  }
  
  createSession(playerID, username) {
    const sessionID = this.generateSessionID();
    const session = {
      sessionID,
      playerID,
      username,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      matchID: null
    };
    this.sessions.set(sessionID, session);
    this.playerSessions.set(playerID, sessionID);
    return session;
  }
  
  findSession(sessionID) {
    return this.sessions.get(sessionID);
  }
  
  updateActivity(sessionID) {
    const session = this.sessions.get(sessionID);
    if (session) {
      session.lastActivity = Date.now();
    }
  }
}
```

### Match Management System
```javascript
// New module: src/systems/matchManager.js
class MatchManager {
  constructor() {
    this.activeMatches = new Map(); // matchId -> Match instance
    this.waitingQueue = new Set(); // Set of playerIDs waiting for match
    this.playerMatches = new Map(); // playerID -> matchId
    this.matchCounter = 0;
  }
  
  addPlayerToQueue(playerID, username) {
    this.waitingQueue.add({ playerID, username, queuedAt: Date.now() });
    this.tryCreateMatch();
  }
  
  tryCreateMatch() {
    if (this.waitingQueue.size >= 10) { // Minimum players to start
      const players = Array.from(this.waitingQueue).slice(0, 50); // Max 50 players
      this.createMatch(players);
    }
  }
  
  createMatch(players) {
    const matchId = `match_${++this.matchCounter}`;
    const match = new Match(matchId, players);
    this.activeMatches.set(matchId, match);
    
    // Remove players from queue and assign to match
    players.forEach(player => {
      this.waitingQueue.delete(player);
      this.playerMatches.set(player.playerID, matchId);
    });
    
    return match;
  }
}
```

### Match Instance with Isolated RoomSystem
```javascript
// New module: src/systems/match.js
class Match {
  constructor(matchId, players) {
    this.matchId = matchId;
    this.players = new Map(); // playerID -> player data
    this.connectedSockets = new Map(); // playerID -> socket
    this.roomSystem = new RoomSystem(); // Isolated world per match
    this.status = 'starting'; // starting, active, finished
    this.startedAt = Date.now();
    
    // Initialize players
    players.forEach(player => {
      this.players.set(player.playerID, {
        ...player,
        status: 'active',
        joinedAt: Date.now()
      });
    });
    
    // Load world for this match
    this.initializeWorld();
  }
  
  async initializeWorld() {
    // Load rooms from JSON (could be match-specific)
    await this.roomSystem.loadRoomsFromJSON('data/rooms.json');
    this.status = 'active';
  }
  
  addPlayerSocket(playerID, socket) {
    this.connectedSockets.set(playerID, socket);
    socket.join(this.matchId); // Join Socket.IO room for this match
    
    // Add player to room system
    this.roomSystem.addPlayer(playerID);
    
    // Send match state to player
    this.sendMatchState(playerID);
  }
  
  handlePlayerForfeit(playerID) {
    const player = this.players.get(playerID);
    if (player) {
      player.status = 'forfeited';
      this.roomSystem.removePlayer(playerID);
      
      // Notify other players
      this.broadcast('gameMasterMessage', {
        text: `${player.username} has forfeited the match.`,
        timestamp: new Date().toISOString()
      }, [playerID]);
    }
  }
  
  broadcast(event, data, excludePlayers = []) {
    for (const [playerID, socket] of this.connectedSockets) {
      if (!excludePlayers.includes(playerID)) {
        socket.emit(event, data);
      }
    }
  }
}
```

### Enhanced Server Architecture
```javascript
// Modified src/server.js - Match-aware connection handling
const MatchManager = require('./systems/matchManager');
const SessionManager = require('./systems/sessionManager');

const matchManager = new MatchManager();
const sessionManager = new SessionManager();

// Session authentication middleware
io.use((socket, next) => {
  const { sessionID, username } = socket.handshake.auth;
  
  if (sessionID) {
    const session = sessionManager.findSession(sessionID);
    if (session) {
      socket.sessionID = sessionID;
      socket.playerID = session.playerID;
      socket.username = session.username;
      sessionManager.updateActivity(sessionID);
      return next();
    }
  }
  
  // Create new session
  const playerID = generatePlayerID();
  const session = sessionManager.createSession(playerID, username || `Player_${playerID.slice(0, 8)}`);
  
  socket.sessionID = session.sessionID;
  socket.playerID = session.playerID;
  socket.username = session.username;
  
  next();
});

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.playerID} (${socket.username})`);
  
  // Send session data to client for persistence
  socket.emit('session', {
    sessionID: socket.sessionID,
    playerID: socket.playerID,
    username: socket.username
  });
  
  // Check if player is reconnecting to existing match
  const existingMatchId = matchManager.playerMatches.get(socket.playerID);
  if (existingMatchId) {
    const match = matchManager.activeMatches.get(existingMatchId);
    if (match && match.status === 'active') {
      match.addPlayerSocket(socket.playerID, socket);
      return; // Skip matchmaking for reconnecting player
    }
  }
  
  // Handle new match joining
  socket.on('joinMatch', (data) => {
    const { username } = data;
    if (username && username.trim()) {
      socket.username = username.trim();
      // Update session with new username
      const session = sessionManager.findSession(socket.sessionID);
      if (session) {
        session.username = socket.username;
      }
    }
    
    matchManager.addPlayerToQueue(socket.playerID, socket.username);
    socket.emit('matchmaking', { status: 'queued', queuePosition: matchManager.waitingQueue.size });
  });
  
  // Handle forfeit
  socket.on('forfeitMatch', () => {
    const matchId = matchManager.playerMatches.get(socket.playerID);
    if (matchId) {
      const match = matchManager.activeMatches.get(matchId);
      if (match) {
        match.handlePlayerForfeit(socket.playerID);
      }
    }
  });
  
  // Enhanced message handling for match context
  socket.on('playerMessage', (data) => {
    const matchId = matchManager.playerMatches.get(socket.playerID);
    if (!matchId) {
      socket.emit('error', { message: 'You are not in an active match' });
      return;
    }
    
    const match = matchManager.activeMatches.get(matchId);
    if (!match) {
      socket.emit('error', { message: 'Match not found' });
      return;
    }
    
    // Existing message validation
    const validationResult = validateMessage(data);
    if (!validationResult.isValid) {
      socket.emit('error', { message: validationResult.error });
      return;
    }
    
    // Handle commands within match context
    const message = data.text.trim();
    if (message.startsWith('/go ')) {
      handleMoveCommand(socket, match, message);
    } else {
      handleMatchChat(socket, match, data.text);
    }
  });
});
```

### Client-Side Session Integration
```javascript
// Enhanced public/client.js - Session management
let sessionData = {
  sessionID: null,
  playerID: null,
  username: null
};

function initializeSession() {
  // Restore session from localStorage
  const storedSessionID = localStorage.getItem('sessionID');
  const storedUsername = localStorage.getItem('username');
  
  return {
    sessionID: storedSessionID,
    username: storedUsername
  };
}

function connectToServer() {
  const auth = initializeSession();
  
  socket = io({
    auth: auth,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });
  
  // Handle session establishment
  socket.on('session', (data) => {
    sessionData = data;
    localStorage.setItem('sessionID', data.sessionID);
    localStorage.setItem('playerID', data.playerID);
    localStorage.setItem('username', data.username);
    
    showMatchLobby();
  });
  
  // Handle matchmaking status
  socket.on('matchmaking', (data) => {
    updateMatchmakingStatus(data);
  });
  
  // Handle match start
  socket.on('matchStarted', (data) => {
    showGameInterface();
    displayGameMasterMessage({
      text: `Match started! ${data.playerCount} players are competing. Good luck!`,
      timestamp: new Date().toISOString()
    });
  });
}

function joinMatchWithName() {
  const usernameInput = document.getElementById('usernameInput');
  const username = usernameInput.value.trim();
  
  if (username.length < 2 || username.length > 20) {
    showError('Username must be between 2 and 20 characters');
    return;
  }
  
  sessionData.username = username;
  localStorage.setItem('username', username);
  
  socket.emit('joinMatch', { username });
  showMatchmakingScreen();
}
```

## Implementation Roadmap

### Phase 1: Session Management Foundation (3-4 hours)
1. **Create session management system**
   - Implement `src/systems/sessionManager.js` with persistent session storage
   - Add session authentication middleware to Socket.IO server
   - Create client-side session persistence with localStorage and cookies

2. **Refactor player identification**
   - Replace socket.id usage with persistent playerID throughout codebase
   - Update existing player management to use session-based identification
   - Modify client to handle session restoration on reconnection

### Phase 2: Match Management Core (4-5 hours)
3. **Implement match management system**
   - Create `src/systems/matchManager.js` with queue and match lifecycle management
   - Build `src/systems/match.js` with isolated RoomSystem instances
   - Add matchmaking queue and match creation logic

4. **Refactor server for match isolation**
   - Modify `src/server.js` to route commands to appropriate match instances
   - Replace global RoomSystem with per-match instances
   - Implement match-specific Socket.IO room management

### Phase 3: Client Interface Enhancement (2-3 hours)
5. **Build match lobby and matchmaking UI**
   - Add username input and match joining interface
   - Create matchmaking status display with queue position
   - Implement match forfeit functionality

6. **Enhance game interface for match context**
   - Add match status indicators (player count, match time)
   - Modify message display to show match-specific information
   - Update styling for match-based gameplay

### Phase 4: Advanced Features & Polish (2-3 hours)
7. **Implement reconnection handling**
   - Add match state recovery for reconnecting players
   - Ensure seamless transition back into active matches
   - Handle edge cases for match lifecycle during reconnection

8. **Add comprehensive error handling**
   - Match not found scenarios
   - Invalid session recovery
   - Network interruption during critical match events

### Phase 5: Testing & Validation (2-3 hours)
9. **Create comprehensive test suite**
   - Unit tests for SessionManager and MatchManager
   - Integration tests for multi-match scenarios
   - Load testing with multiple concurrent matches

## Technical References

### Socket.IO Documentation
- **Rooms & Namespaces**: https://socket.io/docs/v4/rooms/ - Essential for match isolation
- **Authentication**: https://socket.io/docs/v4/middlewares/#sending-credentials - Session management patterns
- **Connection State Recovery**: https://socket.io/docs/v4/connection-state-recovery/ - Reconnection handling

### Session Management Resources
- **Express Session Integration**: https://socket.io/how-to/use-with-express-session - Production session patterns
- **Socket.IO Session Patterns**: https://aslamanver.medium.com/socket-io-session-handler-for-node-js-90c15519fa02 - Implementation examples
- **Persistent Player Identity**: https://stackoverflow.com/questions/29245368/socket-io-ensure-state-on-client-reconnection - Reconnection strategies

### Matchmaking Architecture Examples
- **Battle Royale Implementation**: https://github.com/sru/battle-royale - Node.js multiplayer patterns
- **Multiplayer Game Architecture**: https://dev.to/sauravmh/building-a-multiplayer-game-using-websockets-1n63 - WebSocket game design
- **Colyseus Framework**: https://colyseus.io/ - Professional multiplayer game server patterns

### Performance Considerations
- **50 Players per Match**: Well within Socket.IO's 10,000+ connection capacity per instance
- **Multiple Matches**: In-memory management for optimal performance
- **Session Storage**: Use Map-based storage for development, Redis for production scaling

## Error Handling Strategy

### Session Management Errors
```javascript
// Session validation and recovery
function validateSession(sessionID, playerID) {
  const session = sessionManager.findSession(sessionID);
  if (!session) {
    throw new Error('Session not found - please rejoin');
  }
  
  if (session.playerID !== playerID) {
    throw new Error('Session mismatch - invalid credentials');
  }
  
  // Check session expiry (24 hours)
  if (Date.now() - session.lastActivity > 24 * 60 * 60 * 1000) {
    sessionManager.expireSession(sessionID);
    throw new Error('Session expired - please create new session');
  }
  
  return session;
}
```

### Match State Errors
```javascript
// Match lifecycle error handling
socket.on('playerMessage', (data) => {
  try {
    const matchId = matchManager.playerMatches.get(socket.playerID);
    if (!matchId) {
      socket.emit('error', { 
        message: 'You are not in an active match. Please join a new match.',
        action: 'SHOW_LOBBY'
      });
      return;
    }
    
    const match = matchManager.activeMatches.get(matchId);
    if (!match || match.status !== 'active') {
      socket.emit('error', { 
        message: 'Match is no longer active.',
        action: 'SHOW_LOBBY' 
      });
      matchManager.playerMatches.delete(socket.playerID);
      return;
    }
    
    // Process message within match context
    match.handlePlayerMessage(socket.playerID, data);
    
  } catch (error) {
    console.error('Match message error:', error);
    socket.emit('error', { 
      message: 'Failed to process message in match context',
      details: error.message 
    });
  }
});
```

### Reconnection Error Handling
```javascript
// Graceful match reconnection
function handleMatchReconnection(socket, sessionID) {
  try {
    const session = validateSession(sessionID, socket.playerID);
    const matchId = session.matchID;
    
    if (!matchId) {
      // Player not in active match, show lobby
      socket.emit('reconnection', { status: 'lobby' });
      return;
    }
    
    const match = matchManager.activeMatches.get(matchId);
    if (!match || match.status === 'finished') {
      // Match ended while disconnected
      session.matchID = null;
      socket.emit('reconnection', { 
        status: 'lobby',
        message: 'Previous match has ended'
      });
      return;
    }
    
    // Successful match reconnection
    match.addPlayerSocket(socket.playerID, socket);
    socket.emit('reconnection', { 
      status: 'match',
      matchId: matchId,
      message: 'Reconnected to active match'
    });
    
  } catch (error) {
    console.error('Reconnection error:', error);
    socket.emit('reconnection', { 
      status: 'error',
      message: error.message 
    });
  }
}
```

## File Structure Implementation

### New Files to Create
```
src/
├── systems/
│   ├── sessionManager.js       # Persistent session management
│   ├── matchManager.js         # Match lifecycle and queue management  
│   └── match.js               # Individual match instance with isolated RoomSystem
├── utils/
│   ├── idGenerator.js         # Secure ID generation for players/sessions
│   └── matchValidation.js     # Match-specific validation utilities
└── middleware/
    └── sessionAuth.js         # Socket.IO session authentication middleware

public/
├── lobby.html                 # Match lobby interface
├── lobby.js                   # Lobby-specific client logic
└── matchmaking.css           # Matchmaking-specific styling

tests/
├── sessionManager.test.js     # Session management unit tests
├── matchManager.test.js       # Match management unit tests
├── match.test.js             # Individual match unit tests
└── multiMatch.test.js        # Multi-match integration tests
```

### Modified Files
```
src/server.js                  # Add session middleware and match routing
src/systems/roomSystem.js      # No changes needed - already match-ready
src/utils/validation.js        # Add match context validation
public/client.js              # Add session management and lobby interface
public/index.html             # Add lobby elements and matchmaking UI
public/style.css              # Add match interface styling
```

## Validation Gates

### 1. Code Quality and Structure
```bash
# Lint and test all new code
npm run lint
npm test

# Specific session management tests
npm test -- --grep "Session Management"
npm test -- --grep "Match System"

# File size compliance (must be under 500 lines)
wc -l src/systems/*.js src/middleware/*.js
```

### 2. Session Persistence Validation
```bash
# Manual session testing:
# 1. Start server: npm start
# 2. Open browser, enter username, join match queue
# 3. Check localStorage contains sessionID
# 4. Refresh page - should restore session and show correct state
# 5. Close tab, reopen - should reconnect to same match if active

# Cookie validation
# Verify sessionID cookie is set with proper security flags
```

### 3. Multi-Match Functionality  
```bash
# Multi-match testing:
# 1. Open 12+ browser tabs (enough for 2 matches)
# 2. Have all join matchmaking with different usernames
# 3. Verify first 10-50 players create Match 1
# 4. Verify remaining players wait for more players
# 5. Ensure matches are isolated (players can't see each other's chat)

# Match isolation verification:
# Players in different matches should not see each other's messages
# Room navigation should be independent between matches
```

### 4. Reconnection and Forfeit Testing
```bash
# Reconnection testing:
# 1. Join active match
# 2. Force disconnect (close tab or disable network)
# 3. Reconnect within 2 minutes
# 4. Verify player returns to same match with correct room location
# 5. Verify other players see reconnection message

# Forfeit testing:
# 1. Use forfeit command/button during active match
# 2. Verify player is removed from match
# 3. Verify other players are notified
# 4. Verify player can join new match queue
```

### 5. Performance and Load Validation
```bash
# Load testing (manual):
# 1. Create 3 concurrent matches (30+ players total)
# 2. Monitor server performance (CPU, memory)
# 3. Verify message delivery remains under 100ms
# 4. Check for memory leaks after matches complete

# Session cleanup validation:
# Verify expired sessions are properly cleaned up
# Check for memory leaks in sessionManager
```

## Success Criteria

### Functional Requirements
- [ ] Players can join match queue with custom username
- [ ] Matches start automatically with 10-50 players
- [ ] Each match has isolated world with independent RoomSystem
- [ ] Players can forfeit and return to lobby at any time
- [ ] Session persistence allows seamless reconnection to active matches
- [ ] Cookie-based sessionID survives browser refresh and tab closure
- [ ] Multiple concurrent matches operate independently

### Technical Requirements
- [ ] Stable playerID separate from socket.id for reconnection handling
- [ ] SessionID stored in cookies with proper security flags
- [ ] Match instances use isolated RoomSystem with independent worlds
- [ ] Session authentication middleware validates all connections
- [ ] Comprehensive error handling for match lifecycle edge cases
- [ ] All new code follows CLAUDE.md guidelines (JSDoc, <500 lines, TDD)

### Data Requirements  
- [ ] Sessions persist player identity across reconnections
- [ ] Match state correctly handles player disconnection/reconnection
- [ ] Room navigation state preserved during reconnection
- [ ] Player forfeit properly cleans up match and room state
- [ ] Session expiry (24 hours) with automatic cleanup

### Performance Requirements
- [ ] Support 3+ concurrent matches with 50 players each
- [ ] Session validation completes in <10ms
- [ ] Match creation and player assignment in <100ms
- [ ] Memory usage scales linearly with active matches
- [ ] No memory leaks during match lifecycle

## Implementation Priority

1. **Critical**: Session management foundation and persistent player identity
2. **Critical**: Match manager with queue system and match creation
3. **High**: Match isolation with per-instance RoomSystem
4. **High**: Client lobby interface and matchmaking UI
5. **Medium**: Reconnection handling and state recovery
6. **Medium**: Forfeit functionality and match cleanup
7. **Low**: Performance optimization and advanced features

## Risk Mitigation

### Known Challenges
- **State Synchronization**: Ensure match state stays consistent across player reconnections
- **Memory Management**: Multiple RoomSystem instances must not cause memory leaks
- **Session Security**: Prevent session hijacking with proper validation
- **Match Cleanup**: Ensure completed matches are properly disposed to prevent memory leaks

### Integration Complexity
- **RoomSystem Refactor**: Existing single global instance needs to become per-match instances
- **Socket.IO Room Conflicts**: Match rooms must not conflict with existing room navigation
- **Client State Management**: UI must handle lobby ↔ match transitions gracefully
- **Testing Complexity**: Multi-match scenarios require sophisticated test setup

### Development Guidelines
- Follow established patterns from existing RoomSystem implementation
- Use existing validation utilities and error handling conventions
- Maintain backward compatibility during transition period
- Implement feature flags for gradual rollout if needed

## Confidence Score: 9/10

This PRP provides comprehensive implementation context including:
- ✅ **Detailed Current Codebase Analysis**: Thorough understanding of existing patterns and architecture
- ✅ **Complete External Research**: Socket.IO best practices, session management, and battle royale patterns
- ✅ **Specific Technical Solutions**: Two-ID system, match isolation, reconnection handling
- ✅ **Integration Strategy**: Clear plan for refactoring existing code without breaking functionality  
- ✅ **Executable Validation Gates**: Manual and automated testing procedures
- ✅ **Risk Mitigation**: Identified challenges with specific mitigation strategies
- ✅ **Clear Implementation Path**: Prioritized roadmap with realistic time estimates
- ✅ **Production-Ready Patterns**: Session security, error handling, and performance considerations

The implementation should succeed in one pass given the thorough research, existing codebase analysis, proven external patterns, and comprehensive technical direction provided. The only minor uncertainty is around the complexity of refactoring the existing single-world architecture, but the detailed analysis and gradual implementation approach should handle this effectively.