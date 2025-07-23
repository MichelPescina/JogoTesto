name: "JogoTesto - Text-Based Multiplayer Battle Royale Implementation PRP"
description: |

## Purpose
Complete implementation of JogoTesto, a text-based multiplayer battle royale RPG using Node.js, Express.js, and Socket.io. This PRP provides comprehensive context and validation loops for successful one-pass implementation.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from research
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Follow all rules in CLAUDE.md

---

## Goal
Build a complete text-based multiplayer battle royale game where up to 20 players compete in real-time through interconnected rooms, finding weapons, and battling until only one player remains. The game must be accessible through any browser with simple keyboard controls and provide sub-100ms response times.

## Why
- **Family Gaming**: Provide accessible multiplayer experience for friends and family
- **Low Barrier Entry**: Text-based interface works on any device with basic browser
- **Real-time Engagement**: Socket.io provides instant feedback and competitive gameplay
- **Educational Value**: Demonstrates modern Node.js multiplayer architecture patterns

## What
A complete multiplayer game system featuring:
- Real-time player movement through interconnected rooms
- Turn-based combat with attack/escape mechanics  
- Weapon searching and automatic equipping
- Match-based gameplay supporting up to 20 concurrent players
- Terminal-style text interface with keyboard controls
- Single match system with queuing for new players

### Success Criteria
- [ ] 20 players can join and complete a match without crashes
- [ ] All movement commands respond within 100ms
- [ ] Combat system produces consistent, predictable results
- [ ] Players understand controls within first 2 minutes
- [ ] Match completion rate exceeds 80% in testing
- [ ] Graceful handling of player disconnections

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://socket.io/docs/v4/
  why: Latest Socket.io patterns for real-time multiplayer games
  critical: Event handling, rooms, broadcasting, reconnection
  
- url: https://www.smashingmagazine.com/2019/11/multiplayer-text-adventure-engine-node-js-part-4/
  why: Text-based multiplayer game patterns and room management
  critical: Chat integration, template-based UI updates
  
- url: https://medium.com/swlh/game-design-using-socket-io-and-deployments-on-scale-part-2-254e674bc94b
  why: Game state management and scalability patterns
  critical: Database-backed state, stateless processes, Redis integration
  
- file: /home/miau/Proyectos/JogoTesto/PRPs/jogotesto-prd.md
  why: Complete product requirements and architectural specification
  critical: All user stories, technical specs, world design rules
  
- file: /home/miau/Proyectos/JogoTesto/CLAUDE.md
  why: Project coding standards and development principles
  critical: KISS/YAGNI principles, JSDoc style, node:test usage
  
- file: /home/miau/Proyectos/JogoTesto/package.json
  why: Current dependencies and script configuration
  critical: Express 4.21.2, Socket.io 4.8.1, node:test for testing

```

### Current Codebase tree
```bash
/home/miau/Proyectos/JogoTesto
├── CLAUDE.md
├── features
│   └── Base.md
├── package.json
├── package-lock.json
├── PLANNING.md
├── PRPs
│   ├── jogotesto-prd.md
│   └── templates
│       ├── prp_base.md
│       ├── prp_base_wirasm.md
│       └── prp_planning_base.md
└── public
    └── css
```

### Desired Codebase tree with files to be added and responsibility of file
```bash
/home/miau/Proyectos/JogoTesto
├── src/
│   ├── server.js                 # Main Express + Socket.io server entry point
│   ├── game/
│   │   ├── GameEngine.js         # Core game logic, combat resolution, movement validation
│   │   ├── MatchManager.js       # Match creation, player queuing, state transitions
│   │   ├── Player.js             # Player class with state management
│   │   └── Room.js               # Room class with exit/weapon management
│   ├── handlers/
│   │   ├── socketHandlers.js     # Socket.io event handlers (move, combat, search)
│   │   └── httpHandlers.js       # Express REST endpoint handlers
│   ├── utils/
│   │   ├── validation.js         # Input validation and sanitization
│   │   └── constants.js          # Game constants (damage, spawn rates, etc.)
│   └── data/
│       └── world.json            # World map with rooms and weapon definitions
├── public/
│   ├── index.html                # Terminal-style game interface
│   ├── css/
│   │   └── terminal.css          # Terminal styling
│   └── js/
│       └── client.js             # Client-side Socket.io connection and UI
├── tests/
│   ├── game/
│   │   ├── GameEngine.test.js    # Game logic unit tests
│   │   ├── MatchManager.test.js  # Match management tests
│   │   └── Player.test.js        # Player class tests
│   └── integration/
│       └── socket.test.js        # Socket.io integration tests
└── README.md                     # Setup and gameplay instructions
```

### Known Gotchas of our codebase & Library Quirks
```javascript
// CRITICAL: Socket.io v4 requires proper error handling
// Example: Always handle socket disconnections gracefully
socket.on('disconnect', (reason) => {
  // reason can be 'transport close', 'client namespace disconnect', etc.
  console.log(`Socket disconnected: ${reason}`);
});

// CRITICAL: Express + Socket.io integration pattern
// Must share HTTP server instance between Express and Socket.io
const server = require('http').createServer(app);
const io = require('socket.io')(server);

// CRITICAL: Race conditions in multiplayer games
// Use atomic operations and proper event sequencing
// Never modify game state without proper validation

// GOTCHA: Socket.io rooms are string-based
// Convert match IDs to strings: socket.join(matchId.toString())

// GOTCHA: Node.js require() for JSON files is synchronous
// For world.json loading, use fs.readFileSync in initialization

// CRITICAL: Client-side Socket.io requires explicit reconnection handling
// Set autoConnect: true and reconnection: true in client options
```

## Implementation Blueprint

### Data models and structure

Create the core data models to ensure type safety and consistency.
```javascript
// Player Model
class Player {
  constructor(id, name, socketId) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.room = 'spawn';
    this.strength = 1;           // Increases with victories
    this.weapon = null;          // Current weapon object
    this.status = 'alive';       // 'alive', 'dead', 'searching'
    this.lastAction = Date.now();
  }
}

// Room Model  
class Room {
  constructor(id, description, exits, weaponSpawnChance = 0.1) {
    this.id = id;
    this.description = description;
    this.exits = exits;          // {north: 'roomId', south: 'roomId', ...}
    this.weaponSpawnChance = weaponSpawnChance;
    this.hasWeapon = false;
    this.currentWeapon = null;
    this.players = new Set();    // Set of player IDs
  }
}

// Match Model
class Match {
  constructor(id) {
    this.id = id;
    this.players = new Map();    // playerId -> Player object
    this.status = 'waiting';     // 'waiting', 'active', 'finished'
    this.startTime = null;
    this.winner = null;
    this.rooms = new Map();      // roomId -> Room object
  }
}

// Weapon Model
const WEAPONS = {
  stick: { damage: 1, rarity: 0.6, name: 'Wooden Stick' },
  knife: { damage: 3, rarity: 0.3, name: 'Sharp Knife' },
  sword: { damage: 5, rarity: 0.1, name: 'Steel Sword' }
};
```

### List of tasks to be completed to fulfill the PRP in the order they should be completed

```yaml
Task 1: Project Structure Setup
CREATE src/server.js:
  - PATTERN: Express + Socket.io integration from Socket.io docs
  - SETUP: HTTP server sharing between Express and Socket.io
  - INCLUDE: Basic error handling and graceful shutdown

CREATE src/utils/constants.js:
  - DEFINE: Game constants (max players, timeouts, weapon stats)
  - PATTERN: Environment variable overrides with defaults
  - EXPORT: All constants as named exports

Task 2: World Data and Models
CREATE src/data/world.json:
  - MIRROR: Structure from PRD world design specification
  - INCLUDE: Minimum 12 interconnected rooms
  - ENSURE: Multiple paths prevent bottlenecks

CREATE src/game/Room.js:
  - IMPLEMENT: Room class with weapon spawn logic
  - PATTERN: Immutable data with mutable state tracking
  - METHODS: addPlayer, removePlayer, spawnWeapon, resetWeapon

CREATE src/game/Player.js:
  - IMPLEMENT: Player class with validation
  - PATTERN: State machine for player status
  - METHODS: attack, takeDamage, equipWeapon, canAct

Task 3: Core Game Engine
CREATE src/game/GameEngine.js:
  - IMPLEMENT: Movement validation and room transitions
  - IMPLEMENT: Combat resolution with damage calculation  
  - IMPLEMENT: Weapon search mechanics with 2-second vulnerability
  - PATTERN: Atomic state updates with rollback capability
  - CRITICAL: Handle race conditions in combat

Task 4: Match Management System
CREATE src/game/MatchManager.js:
  - IMPLEMENT: Single match instance with player queuing
  - IMPLEMENT: Match state transitions (waiting->active->finished)  
  - IMPLEMENT: Player disconnection handling
  - PATTERN: Event-driven state machine
  - ENSURE: Automatic match cleanup after completion

Task 5: Socket.io Event Handlers
CREATE src/handlers/socketHandlers.js:
  - IMPLEMENT: Connection/disconnection handling
  - IMPLEMENT: joinMatch, move, search, combat events
  - PATTERN: Input validation before processing
  - PATTERN: Error responses with helpful messages
  - ENSURE: All events broadcast appropriate updates

Task 6: HTTP API Endpoints
CREATE src/handlers/httpHandlers.js:
  - IMPLEMENT: GET /api/status (health check)
  - IMPLEMENT: GET /api/matches (current match info)
  - PATTERN: JSON responses with proper status codes
  - INCLUDE: CORS headers for development

Task 7: Client-Side Interface
CREATE public/index.html:
  - DESIGN: Terminal-style interface with monospace font
  - INCLUDE: Game area div and input handling
  - PATTERN: Semantic HTML with accessibility considerations

CREATE public/js/client.js:
  - IMPLEMENT: Socket.io client connection with reconnection
  - IMPLEMENT: Keyboard event handling (WASD, menu selections)
  - IMPLEMENT: Dynamic UI updates based on socket events
  - PATTERN: Event-driven UI updates with proper error display

CREATE public/css/terminal.css:
  - STYLE: Terminal appearance with green text on black
  - ENSURE: Responsive design for different screen sizes
  - PATTERN: CSS variables for easy theming

Task 8: Input Validation and Security
CREATE src/utils/validation.js:
  - IMPLEMENT: Username validation (length, characters)
  - IMPLEMENT: Move direction validation
  - IMPLEMENT: Input sanitization for all user inputs
  - PATTERN: Joi-style validation functions

Task 9: Testing Suite
CREATE tests/game/GameEngine.test.js:
  - TEST: Movement validation edge cases
  - TEST: Combat resolution with various scenarios
  - TEST: Weapon spawn and search mechanics
  - PATTERN: node:test with proper setup/teardown

CREATE tests/game/MatchManager.test.js:
  - TEST: Match lifecycle from creation to completion
  - TEST: Player joining/leaving scenarios  
  - TEST: Edge cases (full matches, disconnections)

CREATE tests/integration/socket.test.js:
  - TEST: Full game flow from connection to victory
  - TEST: Multiple player interactions
  - PATTERN: Socket.io-client for testing

Task 10: Documentation and Polish
CREATE README.md:
  - DOCUMENT: Installation and setup instructions
  - DOCUMENT: Gameplay rules and controls
  - INCLUDE: Architecture overview and API reference

UPDATE package.json:
  - ADD: Additional scripts for development and testing
  - ENSURE: Proper main entry point and dependencies
```

### Per task pseudocode as needed added to each task

```javascript
// Task 1: Server Setup
// src/server.js
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }  // Configure for production
});

// PATTERN: Graceful shutdown handling
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed gracefully');
  });
});

// Task 3: GameEngine Combat Resolution
class GameEngine {
  resolveCombat(attacker, defender) {
    // CRITICAL: Atomic operation to prevent race conditions
    if (attacker.status !== 'alive' || defender.status !== 'alive') {
      throw new Error('Invalid combat participants');
    }
    
    const attackDamage = attacker.strength + (attacker.weapon?.damage || 0);
    const defendDamage = defender.strength + (defender.weapon?.damage || 0);
    
    // PATTERN: Deterministic winner selection
    const winner = attackDamage >= defendDamage ? attacker : defender;
    const loser = winner === attacker ? defender : attacker;
    
    // CRITICAL: Update state atomically
    winner.strength += 1;
    loser.status = 'dead';
    
    return { winner, loser, attackDamage, defendDamage };
  }
}

// Task 5: Socket Event Handling
// PATTERN: Input validation first, then processing
socket.on('move', async (data) => {
  try {
    // CRITICAL: Validate input format and permissions
    const { direction } = validateMoveInput(data);
    const player = getPlayerBySocket(socket.id);
    
    if (!player || player.status !== 'alive') {
      return socket.emit('error', { message: 'Cannot move' });
    }
    
    // PATTERN: Game engine processes, handlers coordinate
    const result = gameEngine.movePlayer(player.id, direction);
    
    if (result.success) {
      // CRITICAL: Broadcast to affected rooms
      io.to(result.oldRoom).emit('playerLeft', { player: player.name });
      io.to(result.newRoom).emit('playerEntered', { 
        player: player.name,
        roomDescription: result.roomDescription 
      });
      socket.emit('roomUpdate', result.roomData);
    } else {
      socket.emit('error', { message: result.error });
    }
  } catch (error) {
    socket.emit('error', { message: 'Invalid move command' });
  }
});
```

### Integration Points
```yaml
EXPRESS_STATIC:
  - serve: public/ directory for client files
  - route: app.use(express.static('public'))
  
SOCKET_ROOMS:
  - pattern: "match-{matchId}" for game isolation
  - join: socket.join(`match-${matchId}`)
  - broadcast: io.to(`match-${matchId}`).emit(event, data)
  
ERROR_HANDLING:
  - server: try/catch blocks with proper error responses
  - client: socket.on('error') with user-friendly messages
  - logging: console.error for server-side debugging
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                     # ESLint checking
node --check src/**/*.js         # Syntax validation

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests each new feature/file/function use existing test patterns
```javascript
// Example test structure using node:test
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('GameEngine', () => {
  test('movement validation - valid direction', () => {
    const engine = new GameEngine();
    const result = engine.validateMove('spawn', 'north');
    assert.strictEqual(result.valid, true);
  });

  test('combat resolution - stronger player wins', () => {
    const engine = new GameEngine();
    const attacker = new Player('1', 'Alice', 'socket1');
    const defender = new Player('2', 'Bob', 'socket2');
    attacker.weapon = { damage: 5 };
    
    const result = engine.resolveCombat(attacker, defender);
    assert.strictEqual(result.winner.id, '1');
    assert.strictEqual(result.loser.id, '2');
  });

  test('weapon search - vulnerability window', async () => {
    const engine = new GameEngine();
    const player = new Player('1', 'Alice', 'socket1');
    
    // Start search, player should be vulnerable
    engine.startWeaponSearch(player.id);
    assert.strictEqual(player.status, 'searching');
    
    // After timeout, should return to normal
    await new Promise(resolve => setTimeout(resolve, 2100));
    assert.strictEqual(player.status, 'alive');
  });
});
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

# Test socket connection (separate terminal)
node -e "
const io = require('socket.io-client');
const socket = io('http://localhost:3000');
socket.on('connect', () => {
  console.log('Connected successfully');
  socket.emit('joinMatch', { playerName: 'TestPlayer' });
});
socket.on('matchJoined', (data) => {
  console.log('Match joined:', data);
  process.exit(0);
});
"

# Expected: "Connected successfully" and "Match joined: {data}"
# If error: Check server logs for connection issues
```

## Final validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] Socket connection successful: Manual connection test
- [ ] Multiple clients can join: Browser testing with multiple tabs
- [ ] Game mechanics work: Complete a full match manually
- [ ] Error cases handled gracefully: Test invalid inputs
- [ ] Performance acceptable: <100ms response times
- [ ] Disconnection handling: Test mid-game disconnects

---

## Anti-Patterns to Avoid
- ❌ Don't store game state in socket objects - use centralized MatchManager
- ❌ Don't trust client input - validate everything server-side  
- ❌ Don't use synchronous operations for I/O - keep everything async
- ❌ Don't hardcode room IDs or player limits - use constants.js
- ❌ Don't forget to handle edge cases - disconnections, invalid moves, etc.
- ❌ Don't skip proper error handling - emit 'error' events with helpful messages
- ❌ Don't use socket.broadcast() for game events - use rooms for precision

## Expected Implementation Quality Score: 9/10

This PRP provides comprehensive context, detailed implementation patterns, and robust validation loops. The architecture is well-researched and follows industry best practices for Socket.io multiplayer games. With the extensive documentation links, code examples, and gotcha warnings, an AI agent should be able to implement this successfully in one pass while maintaining high code quality and following the project's KISS/YAGNI principles.