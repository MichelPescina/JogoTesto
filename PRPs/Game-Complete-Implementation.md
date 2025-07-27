name: "JogoTesto Complete Game Implementation PRP"
description: |

## Purpose
Complete implementation of the JogoTesto multiplayer text-based RPG battle royale game with all missing functionality including real-time communication, game commands, UI interfaces, chat system, and bug fixes.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix  
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Complete the implementation of JogoTesto - a multiplayer text-based RPG battle royale game that allows 2-5 players to compete in real-time through terminal-like interfaces, room-based movement, weapon collection, combat, and chat communication.

## Why
- **User Impact**: Enable friends and family to play an engaging multiplayer game together
- **Integration**: Complete the existing layered architecture (Layer 1-4) with missing communication and UI components
- **Problems Solved**: Bridge the gap between game engine logic and playable user experience through real-time networking

## What
A fully functional text-based battle royale game where players can:
- Join matches with real-time session management
- Navigate rooms using keyboard commands (w/a/s/d)
- Search for weapons with timing mechanics
- Engage in turn-based combat with attack/escape decisions
- Chat with other players in the same room
- Experience real-time game state updates through terminal-like interface

### Success Criteria
- [ ] Players can join matches and see real-time player count updates
- [ ] Movement commands (w/a/s/d) work and update all players in real-time
- [ ] Weapon searching works with 2-second timer and vulnerability mechanic
- [ ] Combat system allows attack/escape decisions with proper UI
- [ ] Room-based chat enables communication between players
- [ ] Grace period prevents attacks for first 60 seconds
- [ ] Game ends when only one player remains
- [ ] All game state changes are synchronized across clients

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://socket.io/docs/v4/middlewares/
  why: Socket.IO middleware patterns for message validation
  
- url: https://socket.io/docs/v4/listening-to-events/
  why: Event handling patterns and error management
  
- url: https://gamedev.stackexchange.com/questions/15319/common-mistakes-when-developing-a-game-with-socket-io-and-node-js/15543
  why: Best practices for real-time game development with Socket.IO
  
- file: /home/miau/Proyectos/JogoTesto/CLAUDE.md
  why: Project development rules, OOP principles, testing patterns
  
- file: /home/miau/Proyectos/JogoTesto/PLANNING.md
  why: Complete game requirements and specifications
  
- file: /home/miau/Proyectos/JogoTesto/server/game/GameEngine.js
  why: Core game logic patterns to integrate with
  
- file: /home/miau/Proyectos/JogoTesto/server/Match.js
  why: Existing match management patterns
  
- file: /home/miau/Proyectos/JogoTesto/server/Courier.js
  why: Message delivery pattern used throughout architecture
  
- file: /home/miau/Proyectos/JogoTesto/public/js/Client.js
  why: Existing client-side patterns to extend
```

### Current Codebase Tree
```bash
/home/miau/Proyectos/JogoTesto/
├── CLAUDE.md                  # Development rules and guidelines
├── PLANNING.md               # Game requirements
├── index.js                  # Main server entry point
├── package.json              # Dependencies: express, socket.io
├── public/
│   ├── css/style.css        # Basic styling
│   ├── index.html           # Login page
│   └── js/Client.js         # Client-side Socket.IO setup
└── server/
    ├── Courier.js           # Message delivery system
    ├── Match.js             # Match management with Player class
    ├── MatchManager.js      # Match creation/deletion
    ├── sessionManager.js    # MISSING - referenced but not exists
    ├── data/
    │   └── simplerTestWorld.json  # Game world definition
    └── game/
        ├── Battle.js        # Combat resolution logic
        ├── GameEngine.js    # Core game mechanics
        ├── GameRoom.js      # Room management with BUGS
        ├── Piece.js         # Player piece representation
        └── Weapon.js        # Weapon definitions
```

### Desired Codebase Tree with new files
```bash
# Files to CREATE:
server/
├── SessionManager.js         # Session persistence and validation
├── game/
│   ├── GameCommand.js       # Game command validation and processing
│   └── GameMsg.js           # Game message types and formatting

public/
├── game.html                # Game interface page
└── js/
    ├── GameClient.js        # Game-specific client logic
    └── Terminal.js          # Terminal-like UI component

# Files to MODIFY:
index.js                     # Add game command handling
public/js/Client.js          # Add game interface navigation
server/Match.js              # Add grace period timer, command routing
server/game/GameEngine.js    # Add real-time messaging integration
server/game/GameRoom.js      # Fix weapon property bugs
```

### Known Gotchas & Library Quirks
```javascript
// CRITICAL: Socket.IO message validation patterns
// Example: Use middleware for input validation, not inline checks
socket.use((packet, next) => {
  if (isValidCommand(packet)) return next();
  next(new Error('Invalid command'));
});

// CRITICAL: GameRoom has property inconsistencies
// Bug: setWeaponId sets this.weapon but getWeaponId returns this.weaponid
// Must fix property naming before extending functionality

// CRITICAL: Courier delivery requires exact address matching
// Pattern: Always set courier addresses before attempting delivery
courier.setAddress(playerId, deliveryFunction);

// CRITICAL: Match state management follows specific flow
// Pattern: STATE.QUEUE -> STATE.COUNTDOWN -> STATE.GRACE -> STATE.BATTLE
// Never skip states or validation will fail

// CRITICAL: Node.js test runner patterns
// Example: Use node:test for backend, follow CLAUDE.md TDD approach
import { test, describe } from 'node:test';
import assert from 'node:assert';
```

## Implementation Blueprint

### Data Models and Structure

Core message and command structures for type safety and validation:
```javascript
// Game command validation schema
const GameCommand = {
  MOVE: 'MOVE',         // {type: 'MOVE', direction: 'north|south|east|west'}
  SEARCH: 'SEARCH',     // {type: 'SEARCH'}
  ATTACK: 'ATTACK',     // {type: 'ATTACK', targetId: 'pieceId'}
  RESPOND: 'RESPOND',   // {type: 'RESPOND', battleId: 'id', decision: 'ATTACK|ESCAPE'}
  CHAT: 'CHAT'          // {type: 'CHAT', message: 'text'}
};

// Game message types for client updates
const GameMsg = {
  GAME_STATE: 'GAME_STATE',     // Complete game state
  ROOM_UPDATE: 'ROOM_UPDATE',   // Room description and players
  BATTLE_START: 'BATTLE_START', // Combat initiation
  BATTLE_END: 'BATTLE_END',     // Combat resolution
  CHAT_MSG: 'CHAT_MSG',         // Chat messages
  ERROR: 'ERROR'                // Error notifications
};
```

### List of tasks to be completed in order

```yaml
Task 1 - Fix Existing Bugs:
MODIFY server/game/GameRoom.js:
  - FIND line 13: "this.weapon = weaponId"
  - REPLACE with: "this.weaponId = weaponId"
  - FIND line 17: "return this.weaponid"  
  - REPLACE with: "return this.weaponId"
  - PRESERVE all other functionality

Task 2 - Create Session Management:
CREATE server/SessionManager.js:
  - MIRROR pattern from: server/MatchManager.js class structure
  - IMPLEMENT session creation, validation, and cleanup
  - EXPORT class following existing module.exports pattern

Task 3 - Create Game Command System:
CREATE server/game/GameCommand.js:
  - DEFINE command types and validation schemas
  - IMPLEMENT command parsing and error handling
  - FOLLOW error-first callback pattern from CLAUDE.md

Task 4 - Create Game Message System:
CREATE server/game/GameMsg.js:
  - DEFINE message types for client communication
  - IMPLEMENT message formatting utilities
  - ENSURE JSON serializable structures

Task 5 - Create Terminal UI Component:
CREATE public/js/Terminal.js:
  - IMPLEMENT terminal-like interface for game display
  - HANDLE keyboard input for commands
  - MIRROR styling patterns from existing CSS

Task 6 - Create Game Client Logic:
CREATE public/js/GameClient.js:
  - IMPLEMENT Socket.IO event handlers for game messages
  - HANDLE command input and validation
  - INTEGRATE with Terminal.js component

Task 7 - Create Game Interface Page:
CREATE public/game.html:
  - MIRROR structure from: public/index.html
  - INCLUDE Terminal.js and GameClient.js
  - IMPLEMENT game-specific UI elements

Task 8 - Add Real-time Game Engine Integration:
MODIFY server/game/GameEngine.js:
  - INJECT message delivery after game state changes
  - ADD timing mechanisms for search actions
  - PRESERVE existing game logic patterns

Task 9 - Enhance Match Management:
MODIFY server/Match.js:
  - ADD grace period timer implementation
  - IMPLEMENT game command routing to GameEngine
  - ADD chat message handling

Task 10 - Update Main Server:
MODIFY index.js:
  - ADD SessionManager integration
  - IMPLEMENT game command message handlers
  - ADD navigation between login and game pages

Task 11 - Update Client Navigation:
MODIFY public/js/Client.js:
  - ADD navigation to game interface
  - HANDLE match join success/failure
  - PRESERVE existing authentication patterns

Task 12 - Create Comprehensive Tests:
CREATE tests for each new component:
  - USE node:test as specified in CLAUDE.md
  - IMPLEMENT TDD approach: 1 success, 1 edge, 1 failure case
  - FOLLOW existing testMatch.js patterns
```

### Per Task Pseudocode

```javascript
// Task 1 - GameRoom Bug Fix
// CRITICAL: Property naming inconsistency causes weapon system failure
class GameRoom {
  setWeaponId(weaponId) {
    this.weaponId = weaponId; // Fixed: was this.weapon
  }
  getWeaponId() {
    return this.weaponId; // Fixed: was this.weaponid
  }
}

// Task 3 - Game Command System
class GameCommand {
  static validate(command) {
    // PATTERN: Early validation prevents downstream errors
    if (!command.type) throw new Error('Command type required');
    switch(command.type) {
      case 'MOVE':
        if (!['north','south','east','west'].includes(command.direction)) {
          throw new Error('Invalid direction');
        }
        break;
      // ... other validations
    }
  }
}

// Task 8 - GameEngine Real-time Integration 
class GameEngine {
  movePiece(pieceId, direction) {
    // EXISTING: Game logic
    const result = this.#swapPieceRooms(pieceId, targetRoomId);
    
    // NEW: Real-time updates
    if (result) {
      this.#broadcastRoomUpdate(pieceId);
      this.#broadcastGameState();
    }
    return result;
  }
  
  startSearch(pieceId) {
    // PATTERN: State validation before action
    if (piece.getState() !== Piece.STATE.MOVING) return false;
    
    piece.setState(Piece.STATE.SEARCHING);
    
    // NEW: Timer implementation with vulnerability
    setTimeout(() => {
      this.endSearch(pieceId);
    }, 2000);
    
    return true;
  }
}

// Task 9 - Match Grace Period
class Match {
  #startMatch() {
    // EXISTING: Game initialization
    this.game = new GameEngine(this.gameCourier);
    this.state = Match.STATE.GRACE;
    
    // NEW: Grace period timer
    this.graceTimer = setTimeout(() => {
      this.state = Match.STATE.BATTLE;
      this.#broadcastStateChange();
    }, 60000); // 60 seconds
  }
}
```

### Integration Points
```yaml
WEBSOCKET_EVENTS:
  - add to: index.js socket handlers
  - pattern: "socket.on('gameCommand', (data) => match.handleCommand(data))"
  
REAL_TIME_UPDATES:
  - modify: GameEngine message delivery
  - pattern: "this.outCourier.deliver(pieceId, {type: 'ROOM_UPDATE', ...})"
  
CLIENT_NAVIGATION:
  - add to: public/js/Client.js
  - pattern: "window.location.href = '/game.html'"
  
SESSION_PERSISTENCE:
  - integrate: SessionManager with existing auth flow
  - pattern: "sessionManager.validateSession(auth.sessionId)"
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                          # ESLint validation
node --check server/SessionManager.js # Syntax validation
node --check server/game/GameCommand.js
node --check server/game/GameMsg.js
node --check public/js/Terminal.js
node --check public/js/GameClient.js

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests
```javascript
// CREATE test files following node:test patterns:

// test/SessionManager.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import SessionManager from '../server/SessionManager.js';

describe('SessionManager', () => {
  test('should create valid session', () => {
    const manager = new SessionManager();
    const sessionId = manager.createSession();
    assert(typeof sessionId === 'string');
    assert(sessionId.length > 0);
  });

  test('should validate existing session', () => {
    const manager = new SessionManager();
    const sessionId = manager.createSession();
    const isValid = manager.isValidSession(sessionId, Date.now());
    assert.strictEqual(isValid, true);
  });

  test('should reject invalid session', () => {
    const manager = new SessionManager();
    const isValid = manager.isValidSession('invalid', Date.now());
    assert.strictEqual(isValid, false);
  });
});

// Similar patterns for GameCommand.test.js, GameMsg.test.js
```

```bash
# Run and iterate until passing:
npm test
# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Test
```bash
# Start the server
npm start

# Test basic flow in separate terminal
curl -X POST http://localhost:3000/ -H "Content-Type: text/html"
# Expected: Login page loads successfully

# Test WebSocket connection manually:
# Open browser to http://localhost:3000
# Open developer console
# Verify socket connection established
# Join match and verify player count updates

# Test game commands:
# Navigate to game page after joining
# Test movement commands (w/a/s/d)
# Test search functionality  
# Test chat messages

# Expected: All real-time updates work, no console errors
```

## Final Validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] No console errors in browser during gameplay
- [ ] Players can join matches and see real-time updates
- [ ] Movement commands work and sync across clients
- [ ] Search timing works with 2-second delay
- [ ] Combat system displays attack/escape decisions
- [ ] Chat messages appear in real-time
- [ ] Grace period prevents attacks for 60 seconds
- [ ] Game state synchronizes properly across all clients

---

## Anti-Patterns to Avoid
- ❌ Don't bypass command validation for "testing purposes"
- ❌ Don't skip error handling because Socket.IO "handles it automatically"
- ❌ Don't ignore the existing Courier pattern - use it consistently  
- ❌ Don't modify core game logic without preserving existing functionality
- ❌ Don't create global state - keep everything modular and testable
- ❌ Don't hardcode timeouts - make them configurable

## PRP Quality Score: 9/10

**Confidence Level for One-Pass Implementation Success: 9/10**

**Rationale:**
- **Comprehensive Context (10/10)**: All necessary files, patterns, and external resources identified
- **Clear Implementation Path (9/10)**: Step-by-step tasks with specific code patterns
- **Error Prevention (9/10)**: Known bugs identified and fixed, validation patterns provided
- **Testability (8/10)**: Clear testing strategy but integration tests require manual verification
- **Real-world Applicability (9/10)**: Based on current Socket.IO best practices and proven patterns

**Risk Mitigation:**
The PRP provides extensive context about existing patterns, specific bug fixes needed, and progressive validation steps. The modular task breakdown allows for incremental testing and validation. The only minor risk is the integration complexity between multiple real-time components, but the existing architecture provides a solid foundation.