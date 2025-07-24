# PRP: Fix Room Description Display on Match Start

## Goal
Fix the bug where room description is not shown to players when a match starts. Players should see the initial room description immediately when joining, matching the behavior they get when moving between rooms.

## Why
- **User Experience**: Players currently get no context about their starting location until they move
- **Consistency**: Moving to another room shows room descriptions correctly, but the initial room does not
- **Gameplay**: Room descriptions contain important information about available exits and potential weapon locations
- **Bug Impact**: Players feel disoriented on match start without location context

## What
When a match starts, the client should immediately display the room description for the spawn room, including room name, description, available exits, and weapon hints (if any). This should match exactly the behavior that occurs when a player moves to a new room.

### Success Criteria
- [ ] Initial room description appears immediately when match starts
- [ ] Room description includes all elements: name, description, exits, weapon hints
- [ ] Behavior matches exactly what happens when moving between rooms
- [ ] No regression in existing room update functionality
- [ ] Tests validate the fix works correctly

## All Needed Context

### Documentation & References
```yaml
- file: public/js/client.js
  why: Contains unimplemented requestRoomUpdate() function and existing room update handling patterns
  
- file: src/handlers/socketHandlers.js  
  why: Contains existing move handler pattern and empty ROOM_INFO handler to implement
  
- file: src/game/Room.js
  why: Shows Room.toClientData() method and getFullDescription() for proper room data format
  
- file: src/utils/constants.js
  why: Defines SOCKET_EVENTS.ROOM_INFO and SOCKET_EVENTS.ROOM_UPDATE event names
  
- file: tests/game/GameEngine.test.js
  why: Testing patterns for node:test framework used in this project
```

### Current Codebase Tree (relevant files)
```bash
src/
├── handlers/
│   └── socketHandlers.js         # Socket event handlers (ROOM_INFO empty)
├── game/
│   ├── GameEngine.js            # Core game logic  
│   ├── MatchManager.js          # Match lifecycle management
│   └── Room.js                  # Room class with toClientData()
├── utils/
│   └── constants.js             # Socket events definitions
public/js/
└── client.js                    # Client-side game logic (requestRoomUpdate empty)
tests/
├── game/
│   └── GameEngine.test.js       # Testing patterns
└── integration/
    └── socket.test.js           # Socket testing patterns
```

### Desired Codebase Tree (no new files)
```bash
# No new files needed - only modifications to existing files
```

### Known Gotchas & Library Quirks
```javascript
// CRITICAL: Socket.io event handling patterns
// Client events: socket.emit(eventName, data)
// Server events: socket.on(eventName, (data) => {})

// CRITICAL: Room data format
// Room.toClientData() returns: {id, name, description, exits, hasWeapon, playerCount}
// updateRoomDisplay() expects: {room: roomData, playersInRoom: [], description: string}

// CRITICAL: Player room access
// player.room contains current room ID 
// gameEngine.getRoom(roomId) gets Room instance
// Room.getPlayers() returns array of player IDs in room

// PATTERN: Error handling in socket handlers
// Always wrap in try/catch and emit 'error' event on failure
```

## Implementation Blueprint

### list of tasks to be completed to fulfill the PRP in the order they should be completed

```yaml
Task 1:
MODIFY public/js/client.js:
  - FIND function: "requestRoomUpdate() {"
  - REPLACE empty implementation with socket.emit('roomInfo', {})
  - PRESERVE existing function signature and comments

Task 2:  
MODIFY src/handlers/socketHandlers.js:
  - FIND handler: "socket.on(SOCKET_EVENTS.ROOM_INFO, async (data) => {"
  - IMPLEMENT full handler following existing patterns
  - MIRROR error handling from other handlers  
  - EMIT roomUpdate event with proper room data format

Task 3:
CREATE tests/integration/roominfo.test.js:
  - TEST requestRoomUpdate() emits correct event
  - TEST server handler responds with room data
  - TEST initial room description displayed on match start
  - FOLLOW node:test patterns from existing tests

Task 4:
RUN validation commands:
  - npm run lint (fix any style issues)
  - npm run test (ensure no regressions)
  - Manual test: start match and verify room description appears
```

### Per task pseudocode

```javascript
// Task 1: Client-side requestRoomUpdate implementation
requestRoomUpdate() {
  // PATTERN: Simple socket emission like other client functions
  if (!this.socket) return;
  this.socket.emit(SOCKET_EVENTS.ROOM_INFO, {});
}

// Task 2: Server-side ROOM_INFO handler  
socket.on(SOCKET_EVENTS.ROOM_INFO, async (data) => {
  try {
    // PATTERN: Get player from socket (see other handlers)
    const player = matchManager.getPlayerBySocket(socket.id);
    if (!player) {
      return socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Player not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    // PATTERN: Get room data (see move handler) 
    const room = matchManager.gameEngine.getRoom(player.room);
    if (!room) {
      return socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Room not found', 
        code: 'ROOM_NOT_FOUND'
      });
    }

    // PATTERN: Get other players in room (see move handler)
    const playersInRoom = room.getPlayers().filter(pid => pid !== player.id);

    // CRITICAL: Use exact same format as move handler roomUpdate
    socket.emit(SOCKET_EVENTS.ROOM_UPDATE, {
      room: room.toClientData(true),
      playersInRoom: playersInRoom,
      description: room.getFullDescription()
    });

  } catch (error) {
    console.error('Error handling roomInfo:', error);
    socket.emit(SOCKET_EVENTS.ERROR, {
      message: 'Failed to get room info',
      code: 'INTERNAL_ERROR'
    });
  }
});
```

### Integration Points
```yaml
SOCKET_EVENTS:
  - use existing: SOCKET_EVENTS.ROOM_INFO (already defined)
  - emit existing: SOCKET_EVENTS.ROOM_UPDATE (already handled by client)

CLIENT_INTEGRATION:
  - called from: handleMatchStarted() on line 232
  - triggers: handleRoomUpdate() and updateRoomDisplay()

SERVER_INTEGRATION:
  - use existing: matchManager.getPlayerBySocket()
  - use existing: gameEngine.getRoom()  
  - use existing: room.toClientData() and room.getFullDescription()
```

## Validation Loop

### Level 1: Syntax & Style  
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                    # ESLint checking
# Expected: No errors. If errors, read them and fix syntax/style issues.
```

### Level 2: Unit Tests
```javascript
// CREATE tests/integration/roominfo.test.js following existing patterns
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('Room Info Request', () => {
  test('client emits roomInfo event when requestRoomUpdate called', () => {
    // Test client-side function emits correct event
  });

  test('server responds with room data when roomInfo received', () => {
    // Test server handler returns proper room data format
  });

  test('room description appears on match start', () => {
    // Integration test: match start -> requestRoomUpdate -> room description shown
  });

  test('handles player not found error gracefully', () => {
    // Test error case when player socket not found
  });
});
```

```bash
# Run and iterate until passing:
npm run test
# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Test
```bash
# Start the server  
npm run dev

# Manual test in browser:
# 1. Open http://localhost:3000
# 2. Enter player name and join match
# 3. Wait for match to start 
# 4. Verify room description appears immediately
# 5. Move to another room and verify description still works

# Expected: Room description visible immediately on match start
# If not working: Check browser console for errors, check server logs
```

## Final Validation Checklist
- [ ] Room description appears immediately when match starts
- [ ] Description includes room name, description, exits, weapon hints
- [ ] No errors in browser console: `F12 -> Console tab`
- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`  
- [ ] Manual test successful: join match, see room description instantly
- [ ] Moving to other rooms still works (no regression)
- [ ] Error cases handled gracefully (invalid player/room)

---

## Anti-Patterns to Avoid
- ❌ Don't create new socket events when ROOM_INFO already exists
- ❌ Don't change room data format - use exact same structure as move handler
- ❌ Don't skip error handling - wrap in try/catch like other handlers  
- ❌ Don't ignore client-side function - it must emit the socket event
- ❌ Don't add complex logic - follow the simple patterns already established
- ❌ Don't break existing room update functionality

## Confidence Score: 9/10

This PRP should achieve one-pass implementation success because:
✅ **Clear problem definition**: Unimplemented function with obvious solution  
✅ **Existing patterns**: Exact same logic exists in move handler to copy
✅ **Minimal scope**: Only 2 files to modify, no new architecture needed
✅ **Well-defined interfaces**: Socket events and data formats already established
✅ **Comprehensive context**: All necessary code patterns and gotchas included
✅ **Testable**: Clear validation steps and expected behaviors defined

The only risk is potential edge cases in player/room state during match start, but the error handling patterns mitigate this risk.