# Product Requirement Prompt: ReworkChat

## Overview

Rework the chat functionality in JogoTesto to simplify the user experience by removing the `/chat` command and making default messages (without commands) room-scoped instead of global. Currently, players must use `/chat` to communicate with others in the same room, while plain messages go to all players globally. This change will make room-based communication the default behavior for natural conversation flow.

## Technical Context

### Current Codebase Status
- **Existing Implementation**: Functional chat system with both global and room-based messaging
- **Socket.IO Version**: v4.8.1 with established room management via RoomSystem
- **Files Involved**: `src/server.js` (main logic), `src/systems/roomSystem.js` (room management), `public/client.js` (message handling)
- **Testing Coverage**: Comprehensive integration tests in `tests/navigation.test.js` covering chat functionality
- **Development Commands**: `npm test` (node:test), `npm run lint` (ESLint), `npm start` (server)

### Current Chat System Architecture
The existing system implements a dual-channel messaging approach:

1. **Global Messages**: Non-command text → `io.to('gameRoom').emit('messageReceived', data)` → All players
2. **Room Chat**: `/chat message` → `handleChatCommand()` → `roomChatMessage` events → Players in same room only

### Key Files and Functions
- **`src/server.js:133-136`**: `/chat` command detection and routing to `handleChatCommand()`
- **`src/server.js:138-145`**: Default message handling (currently global broadcast)
- **`src/server.js:348-446`**: `handleChatCommand()` function (room-based messaging logic)
- **`src/systems/roomSystem.js`**: `getPlayersInRoom()`, `getPlayerRoom()` methods
- **`public/client.js:179-181`**: `messageReceived` event handler (global messages)
- **`public/client.js:217-219`**: `roomChatMessage` event handler (room messages)

### Socket.IO Room Architecture
- **Room Management**: Each player automatically assigned to game rooms via RoomSystem
- **Broadcasting Pattern**: `io.to('gameRoom')` for global, individual socket emission for room-based
- **Player Tracking**: `connectedPlayers` Map with room information, RoomSystem for spatial tracking

## Architecture Blueprint

### Current Message Flow
```javascript
// Current implementation in src/server.js:103-155
socket.on('playerMessage', (data) => {
  const message = data.text.trim();
  
  // Command routing
  if (message.startsWith('/go ')) {
    handleMoveCommand(socket, message);
    return;
  }
  
  if (message.startsWith('/chat ') || message === '/chat') {
    handleChatCommand(socket, message);  // → Room-based
    return;
  }
  
  // Default: Global broadcast to ALL players
  io.to('gameRoom').emit('messageReceived', {
    playerId: socket.id,
    text: data.text,
    timestamp: new Date().toISOString()
  });
});
```

### Target Message Flow
```javascript
// Target implementation - remove /chat, make default room-based
socket.on('playerMessage', (data) => {
  const message = data.text.trim();
  
  // Command routing (no /chat command)
  if (message.startsWith('/go ')) {
    handleMoveCommand(socket, message);
    return;
  }
  
  if (message.startsWith('/look') || message === '/l') {
    handleLookCommand(socket);
    return;
  }
  
  // Default: Room-based chat (adapted from handleChatCommand logic)
  handleDefaultRoomChat(socket, data.text);
});

function handleDefaultRoomChat(socket, chatText) {
  // Validation and room-based messaging logic
  // (adapted from existing handleChatCommand function)
  
  const currentRoom = roomSystem.getPlayerRoom(socket.id);
  const playersInRoom = roomSystem.getPlayersInRoom(currentRoom);
  const playerData = connectedPlayers.get(socket.id);
  
  // Send roomChatMessage to all players in room
  for (const playerId of playersInRoom) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      const message = playerId === socket.id 
        ? `You say: "${chatText}"`
        : `${playerData.name} says: "${chatText}"`;
        
      playerSocket.emit('roomChatMessage', {
        playerId: socket.id,
        playerName: playerData.name,
        text: message,
        timestamp: new Date().toISOString(),
        roomId: currentRoom,
        messageType: 'roomChat',
        isSelf: playerId === socket.id
      });
    }
  }
}
```

### Client Compatibility
The client already supports both message types:
- **`messageReceived`**: Currently used for global messages (will be deprecated)
- **`roomChatMessage`**: Already implemented for room chat (will become default)

No client-side changes required as `roomChatMessage` handler exists.

## Implementation Roadmap

### Phase 1: Server Logic Refactoring
1. **Remove `/chat` command detection** (`src/server.js:133-136`)
   - Delete conditional check for `/chat` commands
   - Remove routing to `handleChatCommand`

2. **Replace global message broadcasting** (`src/server.js:138-145`)
   - Extract and adapt logic from `handleChatCommand()` function
   - Replace `io.to('gameRoom').emit('messageReceived')` with room-based logic
   - Maintain existing validation using `validateMessage()`

3. **Create new default chat handler** 
   - Function: `handleDefaultRoomChat(socket, message)`
   - Reuse room discovery logic: `roomSystem.getPlayerRoom()`, `roomSystem.getPlayersInRoom()`
   - Emit `roomChatMessage` events instead of `messageReceived`
   - Handle empty room scenario with appropriate feedback

4. **Clean up obsolete function** (`src/server.js:348-446`)
   - Remove or refactor `handleChatCommand()` function since it's no longer needed
   - Preserve any reusable validation or formatting logic

### Phase 2: Testing and Validation
5. **Update integration tests** (`tests/navigation.test.js`)
   - Modify tests expecting `/chat` command to use default messaging
   - Verify room-based message delivery in existing test scenarios
   - Test empty room behavior and multi-player scenarios

6. **Add regression tests**
   - Verify `/chat` command is no longer recognized
   - Confirm default messages stay within room boundaries
   - Test edge cases: room transitions, disconnections, empty rooms

## Technical References

### Socket.IO v4 Best Practices
- **Room Broadcasting**: https://socket.io/docs/v4/rooms/
- **Performance Tuning**: https://socket.io/docs/v4/performance-tuning/
- **Server API Reference**: https://socket.io/docs/v4/server-api/

### Socket.IO Room Broadcasting Patterns
```javascript
// Recommended pattern for room-based messaging
socket.to(roomId).emit('event', data);  // Excludes sender
io.to(roomId).emit('event', data);      // Includes sender

// For individual socket emission (used in current implementation)
const targetSocket = io.sockets.sockets.get(playerId);
if (targetSocket) {
  targetSocket.emit('event', data);
}
```

### Existing Code Patterns to Follow
- **Player Data Access**: `connectedPlayers.get(socket.id)` for player information
- **Room Discovery**: `roomSystem.getPlayerRoom(socket.id)`, `roomSystem.getPlayersInRoom(roomId)`
- **Message Validation**: `validateMessage(data)` from `src/utils/validation.js`
- **Timestamp Format**: `new Date().toISOString()` for consistency
- **Error Handling**: `socket.emit('error', {message, timestamp})` pattern

### Message Format Consistency
```javascript
// Standard roomChatMessage format (from existing implementation)
{
  playerId: socket.id,
  playerName: playerData.name,
  text: "formatted message text",
  timestamp: new Date().toISOString(),
  roomId: currentRoom,
  messageType: 'roomChat',
  isSelf: boolean
}
```

## Error Handling Strategy

### Input Validation
```javascript
// Reuse existing validation patterns
const validationResult = validateMessage({text: chatText});
if (!validationResult.isValid) {
  socket.emit('gameMasterMessage', {
    text: `Cannot send message: ${validationResult.error}`,
    timestamp: new Date().toISOString()
  });
  return;
}
```

### Edge Case Handling
```javascript
// Empty room scenario (from existing handleChatCommand)
const playersInRoom = roomSystem.getPlayersInRoom(currentRoom);
const otherPlayersInRoom = playersInRoom.filter(playerId => playerId !== socket.id);

if (otherPlayersInRoom.length === 0) {
  socket.emit('gameMasterMessage', {
    text: 'You speak to the empty air, but no one is here to listen. Your words echo in the silence.',
    timestamp: new Date().toISOString()
  });
  return;
}
```

### Server State Validation
```javascript
// Room system availability check (from existing patterns)
if (!roomSystem.isLoaded) {
  socket.emit('gameMasterMessage', {
    text: 'The world is still loading. Please wait a moment.',
    timestamp: new Date().toISOString()
  });
  return;
}

// Player data verification
const playerData = connectedPlayers.get(socket.id);
if (!playerData) {
  socket.emit('gameMasterMessage', {
    text: 'Player data not found. Please reconnect.',
    timestamp: new Date().toISOString()
  });
  return;
}
```

## File Structure Impact

```
src/
├── server.js           # MODIFIED: Remove /chat routing, replace global with room-based
├── systems/
│   └── roomSystem.js   # UNCHANGED: Room management functions remain the same
└── utils/
    └── validation.js   # UNCHANGED: Message validation stays the same

public/
├── client.js           # UNCHANGED: roomChatMessage handler already exists
├── index.html          # UNCHANGED: UI stays the same
└── style.css           # UNCHANGED: Styling unchanged

tests/
├── navigation.test.js  # MODIFIED: Update tests to expect room-based default messaging
├── integration.test.js # POTENTIALLY MODIFIED: Check if global message tests need updates
└── server.test.js      # UNCHANGED: Core server tests unaffected
```

## Validation Gates

### 1. Code Quality
```bash
# Lint and test validation
npm run lint
npm test

# All tests should pass after modifications
# No linting errors should be introduced
```

### 2. Server Functionality
```bash
# Start server (should run without errors)
npm start

# Server should log:
# - "Server listening on port 3000"
# - Room system loaded successfully
# - No uncaught exceptions during message handling
```

### 3. Default Message Behavior Test
```bash
# Manual test steps:
# 1. Open browser to http://localhost:3000
# 2. Send a plain message (no command prefix)
# 3. Verify message appears with room chat styling (cyan/green)
# 4. Verify message says "You say: [message]" for sender
```

### 4. Room Isolation Test
```bash
# Manual test steps:
# 1. Open two browser tabs, both in starting room
# 2. Send message from tab 1: "Hello from tab 1"
# 3. Verify tab 2 receives: "[PlayerName] says: Hello from tab 1"
# 4. Move tab 1 to different room (/go north)
# 5. Send message from tab 1: "In different room"
# 6. Verify tab 2 does NOT receive the message
# 7. Verify tab 1 gets "speak to empty air" message
```

### 5. Command Removal Test
```bash
# Manual test steps:
# 1. Open browser to http://localhost:3000
# 2. Try sending "/chat Hello"
# 3. Verify it's treated as regular message: "You say: /chat Hello"
# 4. Verify no special chat command processing occurs
```

### 6. Integration Test Validation
```bash
# Automated test execution
npm test

# Key test files to verify:
# - tests/navigation.test.js: Chat functionality tests
# - tests/integration.test.js: Multi-client messaging tests

# Expected test modifications:
# - Room chat tests should work with default messages
# - Global message tests may need updating or removal
```

### 7. Edge Case Validation
```bash
# Empty room test:
# 1. Move to isolated room (/go north, /go east)
# 2. Send message
# 3. Verify "speak to empty air" response

# Message validation test:
# 1. Send empty message
# 2. Send 501+ character message
# 3. Verify validation errors appear as Game Master messages
```

## Success Criteria

### Functional Requirements
- [x] `/chat` command is completely removed and no longer recognized
- [x] Default messages (without command prefix) are sent only to room occupants
- [x] Players receive "You say: [message]" format for their own messages
- [x] Players receive "[PlayerName] says: [message]" format for others' messages
- [x] Empty room scenario shows "speak to empty air" message
- [x] Message validation and rate limiting continue to work
- [x] Players in different rooms cannot see each other's messages

### Technical Requirements
- [x] Uses existing `roomChatMessage` event type for consistency
- [x] Maintains all existing validation logic from `validateMessage()`
- [x] Preserves room management functionality via RoomSystem
- [x] No breaking changes to client-side code
- [x] Follows existing error handling patterns
- [x] Maintains message formatting and timestamp consistency

### User Experience Requirements
- [x] Simplified chat interface: no commands needed for basic conversation
- [x] Natural room-based communication flow
- [x] Clear feedback for edge cases (empty rooms, validation errors)
- [x] No disruption to existing movement and look commands
- [x] Consistent message styling in client interface

## Implementation Priority

1. **Critical**: Remove `/chat` command detection and routing
2. **Critical**: Replace global broadcast with room-based messaging
3. **High**: Implement `handleDefaultRoomChat()` function with proper validation
4. **High**: Handle empty room and error scenarios
5. **Medium**: Update integration tests to reflect new behavior
6. **Medium**: Clean up obsolete `handleChatCommand()` function
7. **Low**: Verify client-side message display consistency

## Risk Mitigation

### Known Considerations
- **Test Coverage**: Existing tests in `tests/navigation.test.js` provide comprehensive coverage of room chat functionality
- **Client Compatibility**: Client already supports `roomChatMessage` events, no changes needed
- **Backward Compatibility**: This is an intentional breaking change to improve UX
- **Room System Dependency**: Functionality relies on properly loaded RoomSystem

### Development Guidelines
- Follow existing patterns from `handleChatCommand()` function for room-based logic
- Maintain consistency with existing message validation and error handling
- Use established Socket.IO patterns: individual socket emission over room broadcasting
- Preserve all existing validation logic from `validateMessage()` function
- Follow project conventions: JSDoc documentation, file size limits, KISS principles

### Edge Case Mitigation
- **Empty Rooms**: Reuse existing "speak to empty air" message from `handleChatCommand()`
- **Invalid Messages**: Continue using `validateMessage()` with Game Master error responses
- **Room System Loading**: Check `roomSystem.isLoaded` before processing messages
- **Player Data Integrity**: Verify `connectedPlayers.get(socket.id)` exists before processing

## Confidence Score: 9/10

This PRP provides comprehensive context for one-pass implementation including:
- ✅ Complete analysis of existing implementation with specific line numbers
- ✅ Detailed before/after architecture with code examples
- ✅ Clear identification of functions and patterns to reuse
- ✅ Comprehensive error handling and edge case coverage
- ✅ Executable validation gates with specific test scenarios
- ✅ Existing test coverage analysis and modification requirements
- ✅ Socket.IO v4 best practices integration
- ✅ Zero client-side changes required (roomChatMessage already supported)
- ✅ Preservation of all existing validation and security measures

The implementation should succeed in one pass given the thorough codebase analysis, clear refactoring steps, and extensive reuse of existing, tested functionality. The only uncertainty (-1 point) relates to potential integration test modifications that may require minor adjustments.