# Product Requirement Prompt: WorldRooms

## Overview

Implement a room-based navigation system for JogoTesto that allows players to travel across different rooms in a game world and interact with each other within those rooms. Each room has a unique description, available commands, and connections to other rooms. The system uses JSON files for room definitions and supports multiplayer room-based chat functionality.

## Technical Context

### Current Codebase Status
- **Socket.IO Multiplayer Engine**: Functional real-time communication with player management
- **Dependencies**: Express v4.21.2, Socket.IO v4.8.1, ESLint v9.31.0
- **Existing Architecture**: Single gameRoom for all players, message broadcasting system
- **Validation System**: `src/utils/validation.js` with message sanitization and rate limiting
- **Player Management**: Connected players Map, join/leave events, connection tracking
- **Command Infrastructure**: Client message input, server message processing
- **Error Handling**: Comprehensive error handling with graceful disconnection

### Current File Structure
```
src/
├── server.js           # Main server with Socket.IO (173 lines)
├── config/socket.js    # Socket configuration (45 lines)
└── utils/validation.js # Message validation utilities (159 lines)
public/
├── index.html          # Client interface
├── client.js          # Client Socket.IO handling (444 lines)
└── style.css          # Client styling
tests/
├── server.test.js     # Validation and server tests (214 lines)
└── integration.test.js # Multi-client tests
```

### Existing Patterns to Follow
**Socket Event Handling** (from `src/server.js:74-108`):
```javascript
socket.on('playerMessage', (data) => {
  // Validate message
  const validationResult = validateMessage(data);
  if (!validationResult.isValid) {
    socket.emit('error', { message: validationResult.error });
    return;
  }
  // Process and broadcast
});
```

**Player State Management** (from `src/server.js:52-56`):
```javascript
connectedPlayers.set(socket.id, {
  id: socket.id,
  connectedAt: new Date().toISOString(),
  lastActivity: new Date().toISOString()
});
```

**Client Message Display** (from `public/client.js:252-268`):
```javascript
function displayPlayerMessage(data) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message player-message';
  // Format and display message
}
```

## Feature Requirements Analysis

From `features/250715_WorldRooms.md`:

### Core Requirements
1. **Room System**: Unique ID, description, available commands, connections to other rooms
2. **Navigation**: `/go north`, `/go cave` style commands for movement between rooms
3. **Room-based Chat**: `/chat` command for players in the same room
4. **JSON Storage**: Room definitions in JSON files for easy creation/editing
5. **Game Master Messages**: Server messages using "Game Master" identity
6. **Multiplayer Awareness**: Show when other players are in the same room

### User Stories
- "As a player if I read from the Game Master that there is a road up north I can type /go north to go there"
- "As a player if I read from the Game Master that there is another player here I can type /chat to talk to them"
- "As a player if I read from the Game Master that there is a cave I can type /go cave to go inside"

## External Research Integration

### Room System Design Patterns
Based on text-based RPG best practices and MUD implementations:

**JSON Room Structure** (adapted from Ranvier MUD and text adventure patterns):
```json
{
  "rooms": {
    "room_001": {
      "id": "room_001",
      "name": "Forest Clearing",
      "description": "A peaceful clearing surrounded by tall oak trees. Sunlight filters through the canopy above. You can see a winding path leading north toward the mountains, and a dark cave opening to the east.",
      "exits": {
        "north": {
          "destination": "room_002",
          "keywords": ["north", "path", "mountains"],
          "description": "Follow the winding path toward the mountains"
        },
        "east": {
          "destination": "room_003", 
          "keywords": ["east", "cave", "opening"],
          "description": "Enter the dark cave opening"
        }
      },
      "commands": {
        "look": "Examine your surroundings more closely",
        "rest": "Take a moment to rest and recover"
      }
    }
  }
}
```

**Command Parsing Pattern** (from text adventure research):
- Primary command word + direction/target
- Keywords array for flexible input matching
- Case-insensitive command processing
- Support for both "/go north" and "/north" patterns

**Room Connection Model** (from MUD architecture research):
- Graph-based room structure with unique identifiers
- Bidirectional connections where appropriate
- Two-pass loading: create rooms first, then establish connections
- Flexible exit definitions supporting multiple keywords

## Architecture Blueprint

### Enhanced Player State Management
```javascript
// Extend existing player state in src/server.js
connectedPlayers.set(socket.id, {
  id: socket.id,
  connectedAt: new Date().toISOString(),
  lastActivity: new Date().toISOString(),
  currentRoom: 'room_001', // Add room tracking
  name: `Player ${socket.id.substring(0, 8)}` // Player display name
});
```

### Room Management System
```javascript
// New module: src/systems/roomSystem.js
class RoomSystem {
  constructor() {
    this.rooms = new Map();
    this.playerRooms = new Map(); // playerId -> roomId
  }
  
  loadRoomsFromJSON(filename) {
    // Load and validate room data
    // Two-pass: create rooms, then validate connections
  }
  
  movePlayer(playerId, direction) {
    // Validate move, update player location, notify room occupants
  }
  
  getPlayersInRoom(roomId) {
    // Return array of players in specified room
  }
  
  getRoomDescription(roomId, playerId) {
    // Generate room description including other players
  }
}
```

### Command Processing Enhancement
```javascript
// Extend existing message handler in src/server.js
socket.on('playerMessage', (data) => {
  const validationResult = validateMessage(data);
  if (!validationResult.isValid) {
    socket.emit('error', { message: validationResult.error });
    return;
  }

  const message = data.text.trim();
  
  // Check for room commands
  if (message.startsWith('/go ') || message.startsWith('/chat')) {
    handleRoomCommand(socket, message);
    return;
  }
  
  // Existing global message broadcasting
  handleGlobalMessage(socket, data);
});
```

### Client-Side Integration
```javascript
// Extend public/client.js message display
function displayGameMasterMessage(data) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message gm-message';
  messageElement.innerHTML = `
    <div class="message-header">
      <strong>Game Master</strong>
      <span class="timestamp">${formatTimestamp(data.timestamp)}</span>
    </div>
    <div class="message-content">${escapeHtml(data.text)}</div>
  `;
  addMessageToDisplay(messageElement);
}
```

## Implementation Roadmap

### Phase 1: Core Room System (2-3 hours)
1. **Create room data structure**
   - Design JSON schema for room definitions
   - Create sample room data file (`data/rooms.json`)
   - Implement room loader and validator

2. **Implement room management**
   - Create `src/systems/roomSystem.js` module
   - Add room loading and connection validation
   - Integrate with existing player state management

### Phase 2: Navigation Commands (2-3 hours)
3. **Add command parsing**
   - Extend message handler for `/go` commands
   - Implement movement validation and execution
   - Add room description generation

4. **Enhance client interface**
   - Add Game Master message styling
   - Implement room-specific message display
   - Add current room indicator to UI

### Phase 3: Room-based Chat (1-2 hours)
5. **Implement room-scoped communication**
   - Add `/chat` command handler
   - Modify message broadcasting for room scope
   - Update player awareness in room descriptions

### Phase 4: Testing & Polish (1-2 hours)
6. **Create comprehensive tests**
   - Unit tests for room system
   - Integration tests for navigation
   - Multi-player room interaction tests

## Technical References

### Documentation Links
- **Socket.IO Rooms**: https://socket.io/docs/v4/rooms/
- **Node.js File System**: https://nodejs.org/api/fs.html for JSON loading
- **Ranvier MUD Architecture**: https://ranviermud.com/ for room system patterns
- **JSON Schema Validation**: https://ajv.js.org/ for room data validation

### MUD Implementation Patterns
- **Ranvier MUD**: Node.js-based MUD engine with modular room systems
- **Room Graph Structure**: Standard MUD pattern using unique identifiers and exit mappings
- **Command Parsing**: Table-driven approach for flexible input processing
- **Two-Pass Loading**: Best practice for handling circular room references

### JSON Structure Examples
Based on text adventure game research and MUD implementations:
```json
{
  "metadata": {
    "version": "1.0",
    "name": "JogoTesto World",
    "description": "Initial room set for testing"
  },
  "rooms": {
    "forest_clearing": {
      "id": "forest_clearing",
      "name": "Forest Clearing",
      "description": "A peaceful clearing surrounded by tall oak trees...",
      "exits": {
        "north": {
          "destination": "mountain_path",
          "keywords": ["north", "path", "mountains"],
          "description": "A winding path leads toward the mountains"
        }
      }
    }
  }
}
```

## Error Handling Strategy

### Room System Validation
```javascript
// Add to src/utils/validation.js
function validateRoomData(roomData) {
  // Validate room structure
  // Check required fields: id, name, description, exits
  // Validate exit destinations exist
  // Check for circular references
}

function validateMoveCommand(playerId, direction, currentRoom) {
  // Validate player exists and is connected
  // Check current room has exit in specified direction
  // Validate destination room exists
}
```

### Movement Error Handling
```javascript
// Error responses for invalid movements
if (!roomSystem.canMove(playerId, direction)) {
  socket.emit('gameMasterMessage', {
    text: "You can't go that way. Type 'look' to see available exits.",
    timestamp: new Date().toISOString()
  });
  return;
}
```

### Connection Handling
```javascript
// Extend existing disconnect handler in src/server.js
socket.on('disconnect', (reason) => {
  // Remove player from room system
  roomSystem.removePlayer(socket.id);
  
  // Notify room occupants
  const playersInRoom = roomSystem.getPlayersInRoom(playerRoom);
  if (playersInRoom.length > 0) {
    io.to(playersInRoom).emit('gameMasterMessage', {
      text: `${playerName} has left the area.`,
      timestamp: new Date().toISOString()
    });
  }
  
  // Existing cleanup...
});
```

## File Structure Implementation

### New Files to Create
```
data/
└── rooms.json              # Room definitions and connections

src/
├── systems/
│   └── roomSystem.js       # Room management logic
└── commands/
    ├── moveCommand.js      # Navigation command handler
    └── chatCommand.js      # Room-based chat handler

tests/
├── roomSystem.test.js      # Room system unit tests
└── navigation.test.js      # Navigation integration tests
```

### Modified Files
```
src/server.js               # Add room command routing
src/utils/validation.js     # Add room/movement validation
public/client.js           # Add Game Master message handling
public/style.css           # Add Game Master message styling
```

## Validation Gates

### 1. Code Quality Checks
```bash
# Syntax and style validation
npm run lint

# Unit test execution
npm test

# Specific room system tests
npm test -- --grep "Room System"
```

### 2. Room Data Validation
```bash
# Room JSON structure validation (manual check)
node -e "console.log(JSON.parse(require('fs').readFileSync('data/rooms.json', 'utf8')))"

# Room connectivity validation
npm test -- --grep "Room Connections"
```

### 3. Navigation Functionality
```bash
# Manual testing steps:
# 1. Start server: npm start
# 2. Open http://localhost:3000 in browser
# 3. Type '/go north' - should move to connected room
# 4. Verify room description updates
# 5. Test invalid directions - should show error message
```

### 4. Multi-Player Room Interaction
```bash
# Manual testing steps:
# 1. Open multiple browser tabs
# 2. Navigate players to same room
# 3. Use '/chat hello' command
# 4. Verify only players in same room receive message
# 5. Move one player to different room
# 6. Verify chat is now room-scoped
```

### 5. Error Handling Validation
```bash
# Test error conditions:
# 1. Invalid room file - should fail gracefully
# 2. Missing room destinations - should show clear errors
# 3. Player disconnection - should clean up room state
# 4. Invalid commands - should show helpful messages
```

## Success Criteria

### Functional Requirements
- [ ] Players can navigate between rooms using `/go direction` commands
- [ ] Room descriptions show current location and available exits
- [ ] Players can use `/chat message` for room-based communication
- [ ] Game Master provides feedback for all room interactions
- [ ] Room data loads from JSON file successfully
- [ ] Multiple players can occupy and interact within the same room
- [ ] Invalid movement attempts show helpful error messages

### Technical Requirements
- [ ] Follows existing codebase patterns and conventions
- [ ] Uses JSDoc documentation style
- [ ] Implements proper error handling and validation
- [ ] Maintains existing Socket.IO room functionality
- [ ] Files stay under 500-line limit
- [ ] Includes comprehensive unit and integration tests
- [ ] Room system integrates seamlessly with existing player management

### Data Requirements
- [ ] Room JSON structure supports flexible room definitions
- [ ] Bidirectional room connections work correctly
- [ ] Room loading validates all connections before activation
- [ ] Sample room set demonstrates various connection types
- [ ] JSON structure supports future extensibility (items, NPCs, etc.)

## Implementation Priority

1. **Critical**: Room system core (data structure, loading, basic navigation)
2. **High**: Movement commands and Game Master messaging
3. **High**: Room-based chat functionality
4. **Medium**: Advanced error handling and validation
5. **Medium**: Client UI enhancements and styling
6. **Low**: Performance optimization and advanced features

## Risk Mitigation

### Known Challenges
- **State Synchronization**: Ensure room state stays consistent across all clients
- **Memory Management**: Room system should not cause memory leaks
- **JSON Validation**: Malformed room data should fail gracefully
- **Connection Handling**: Player disconnection should clean up room state properly

### Integration Points
- **Existing Player Management**: Room system must integrate with connectedPlayers Map
- **Socket.IO Events**: New events must not conflict with existing message system
- **Validation System**: Room commands should use existing validation patterns
- **Error Handling**: Must follow established error handling conventions

### Development Guidelines
- Follow CLAUDE.md development rules (TDD, 500-line limit, JSDoc)
- Use existing validation utilities and patterns
- Maintain backward compatibility with current messaging system
- Ensure graceful degradation if room system fails

## Confidence Score: 9/10

This PRP provides comprehensive implementation context including:
- ✅ Detailed analysis of existing codebase patterns and architecture
- ✅ Complete external research on MUD and text adventure best practices
- ✅ Specific JSON structure design based on industry standards
- ✅ Integration points with existing Socket.IO multiplayer system
- ✅ Executable validation gates and testing approach
- ✅ Clear implementation roadmap with priorities
- ✅ Error handling strategy following existing patterns
- ✅ File structure that maintains project organization
- ✅ Risk mitigation for potential integration challenges

The implementation should succeed in one pass given the thorough research, existing codebase analysis, proven external patterns, and clear technical direction provided.