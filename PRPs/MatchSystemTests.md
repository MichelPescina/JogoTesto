# Product Requirement Prompt: MatchSystemTests

## Overview

Create a comprehensive test suite for JogoTesto's recently implemented Match System. The test suite must include both unit tests for all match-related modules and integration tests covering critical match lifecycle scenarios. This ensures the reliability and stability of the multi-match Battle Royale system that supports up to 50 players per match with countdown timers, reconnection handling, and isolated game worlds.

## Technical Context

### Current Codebase Status
- **Match System Implementation**: Fully functional Match System implemented in `/src/systems/match.js`, `/src/systems/matchManager.js`, and `/src/handlers/matchHandler.js`
- **Existing Test Framework**: Node.js built-in test runner (`node:test`) with `describe`, `test`, and `assert` patterns
- **Dependencies**: Socket.IO v4.8.1, Express, existing validation utilities, room management system  
- **Development Commands**: `npm test` (node --test), `npm run lint` (ESLint)
- **Development Rules**: 500-line file limit, TDD approach, JSDoc documentation, modular design

### Existing Test Patterns to Follow
**Test Structure**: Follow pattern from `/tests/server.test.js`:
```javascript
const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('Module Name', () => {
  test('should do something', () => {
    // Test implementation
    assert.strictEqual(actual, expected);
  });
});
```

**Integration Testing**: Follow pattern from `/tests/integration.test.js` for Socket.IO testing:
- Create test server with Socket.IO
- Use `socket.io-client` for client connections
- Proper setup/teardown with `before`/`after` hooks
- Promise-based async testing helpers

### Match System Architecture to Test

#### Core Classes and Methods
**Match Class** (`/src/systems/match.js`):
- Constructor: Creates match with configurable `minPlayers`, `maxPlayers`, `countdownDuration`
- `addPlayer(playerId, playerName)` - Validates and adds players, triggers countdown at `minPlayers`
- `removePlayer(playerId)` - Removes players, cancels countdown if below `minPlayers`
- `startCountdown()` - Changes state to 'countdown', starts timer
- `startMatch()` - Changes state to 'active', initializes gameplay
- `finishMatch(reason)` - Changes state to 'finished', cleanup
- States: 'waiting' → 'countdown' → 'active' → 'finished'

**MatchManager Class** (`/src/systems/matchManager.js`):
- `findOrCreateMatch(playerId, playerName)` - Core matchmaking logic
- `removePlayerFromMatch(playerId)` - Player leaving functionality
- `getMatch(matchId)`, `getPlayerMatchId(playerId)` - Data retrieval
- `validateSession(matchId, playerId)` - Reconnection validation

**MatchHandler Class** (`/src/handlers/matchHandler.js`):
- `handleJoinMatch(socket, data)` - Socket.IO event handling for joining
- `handleReconnectToMatch(socket, data)` - Session validation and reconnection
- `startCountdownTimer(matchId)` - Real countdown with `setInterval` and Socket.IO broadcasting
- Timer management with cleanup

## Architecture Blueprint

### Unit Testing Strategy

```javascript
// Match.test.js - Test isolated Match class behavior
describe('Match Class', () => {
  describe('Player Management', () => {
    test('should add player successfully when valid data provided');
    test('should reject player when match is full (maxPlayers reached)');
    test('should reject player when match already started');
    test('should save player name correctly');
    test('should start countdown when minPlayers threshold reached');
  });
  
  describe('Match Lifecycle', () => {
    test('should transition from waiting to countdown to active');
    test('should finish match when no players remain');
    test('should finish match when max time reached');
    test('should cancel countdown when below minPlayers');
  });
});

// MatchManager.test.js - Test match assignment logic
describe('MatchManager Class', () => {
  test('should create new match when no available matches');
  test('should assign player to existing available match');
  test('should track player-to-match mapping correctly');
  test('should clean up empty matches');
});

// MatchHandler.test.js - Test Socket.IO integration
describe('MatchHandler Class', () => {
  test('should handle join match requests with validation');
  test('should manage countdown timers with proper cleanup');
  test('should broadcast countdown updates to match players');
});
```

### Integration Testing Strategy

```javascript
// matchSystem.integration.test.js - Real Socket.IO scenarios
describe('Match System Integration', () => {
  let server, io, clients = [];
  
  before(async () => {
    // Create test server with real MatchManager and MatchHandler
    // Connect multiple socket.io-client instances
  });
  
  test('should allow player to join match', async () => {
    // Connect client, emit 'joinMatch', verify 'matchAssigned' event
  });
  
  test('should start match with minimum players', async () => {
    // Connect minPlayers clients, verify countdown starts, verify match starts
  });
  
  test('should handle player disconnection and reconnection', async () => {
    // Connect, join match, disconnect, reconnect with session
  });
  
  test('should end match when no players remain', async () => {
    // Start match, disconnect all players, verify match cleanup
  });
  
  test('should end match when max time reached', async () => {
    // Mock time advancement, verify match ends after duration
  });
});
```

## Implementation Tasks

### Phase 1: Unit Tests Setup
1. **Create test files structure**:
   - `/tests/match.test.js` - Match class unit tests
   - `/tests/matchManager.test.js` - MatchManager class unit tests  
   - `/tests/matchHandler.test.js` - MatchHandler class unit tests

2. **Implement Match class unit tests**:
   - Test player addition/removal with validation
   - Test state transitions (waiting → countdown → active → finished)
   - Test countdown logic and player count thresholds
   - Test match cleanup and resource management

3. **Implement MatchManager class unit tests**:
   - Test match finding and creation logic
   - Test player-to-match mapping accuracy
   - Test session validation for reconnection
   - Test match cleanup when empty

4. **Implement MatchHandler class unit tests**:
   - Test Socket.IO event handlers with mock sockets
   - Test countdown timer management
   - Test error handling and validation

### Phase 2: Integration Tests Setup
5. **Create integration test infrastructure**:
   - Set up test server with real Socket.IO instance
   - Create helper functions for client connection management
   - Implement promise-based event waiting utilities
   - Set up proper test cleanup procedures

6. **Implement core integration scenarios**:
   - Player joining matches end-to-end
   - Match countdown and start with real timers
   - Player name persistence through match lifecycle
   - Match ending scenarios (empty, timeout)

### Phase 3: Edge Cases and Configuration
7. **Add configurable test parameters**:
   - Override `minPlayers` to small values (e.g., 2) for faster testing
   - Override `countdownDuration` to short values (e.g., 3 seconds)  
   - Override `maxPlayers` for testing capacity limits

8. **Test error conditions and edge cases**:
   - Invalid player names, duplicate players
   - Network disconnections during critical phases
   - Race conditions in player joining/leaving
   - Memory leaks in match cleanup

### Phase 4: Performance and Reliability
9. **Add stress testing scenarios**:
   - Multiple concurrent matches
   - Rapid player join/leave cycles
   - Timer accuracy under load

10. **Implement test utilities and helpers**:
    - Mock time advancement for timeout testing
    - Batch client connection helpers
    - Match state verification utilities

## Critical Context for Implementation

### Existing Code Patterns to Follow

**Import Pattern** (from `/tests/server.test.js`):
```javascript
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { 
  validateMessage, 
  sanitizeText 
} = require('../src/utils/validation');
```

**Test Structure Pattern**:
```javascript
describe('Module Name', () => {
  describe('Feature Group', () => {
    test('should behavior description', () => {
      // Arrange
      const input = { /* test data */ };
      
      // Act  
      const result = functionUnderTest(input);
      
      // Assert
      assert.strictEqual(result.success, true);
      assert.match(result.error, /expected pattern/i);
    });
  });
});
```

**Socket.IO Testing Pattern** (from `/tests/integration.test.js`):
```javascript
const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');

let server, io, clientSocket;

before(async () => {
  const app = express();
  server = createServer(app);
  io = new Server(server, { /* config */ });
  
  return new Promise((resolve) => {
    server.listen(() => {
      const port = server.address().port;
      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', resolve);
    });
  });
});

after(() => {
  io.close();
  server.close();
});
```

### Match System Configuration Values

**Default Values** (configurable for testing):
```javascript
// From match.js
this.maxPlayers = 50;          // Override to 5 for testing
this.minPlayers = 10;          // Override to 2 for testing  
this.countdownDuration = 60;   // Override to 3 for testing
```

**State Transitions to Test**:
- 'waiting' → 'countdown' (when players >= minPlayers)
- 'countdown' → 'active' (when countdown reaches 0)
- 'countdown' → 'waiting' (when players < minPlayers)
- Any state → 'finished' (when match ends)

### Socket.IO Events to Test

**Client → Server Events**:
- `joinMatch` with `{ playerName }` 
- `reconnectToMatch` with `{ matchId, playerId, sessionToken }`
- `matchChat` with message data
- `move` with movement commands

**Server → Client Events**:
- `matchAssigned` with match details and session token
- `countdownStarted` and `countdownUpdate` with time remaining
- `gameStarted` when match begins
- `playerJoinedMatch` and `playerLeftMatch` notifications

### Error Handling Patterns

**Validation Errors** (follow existing pattern):
```javascript
socket.emit('error', {
  message: 'Descriptive error message',
  timestamp: new Date().toISOString()
});
```

**Test Assertions for Errors**:
```javascript
test('should reject invalid player name', () => {
  const result = match.addPlayer('player1', '');
  assert.strictEqual(result.success, false);
  assert.match(result.error, /invalid.*name/i);
});
```

## Validation Gates

### Syntax and Style Validation
```bash
# ESLint for code style
npm run lint

# Node.js syntax validation (automatic during test run)
node --test
```

### Unit Tests Execution
```bash
# Run all tests
npm test

# Run specific test files  
node --test tests/match.test.js
node --test tests/matchManager.test.js
node --test tests/matchHandler.test.js
```

### Integration Tests Execution
```bash
# Run integration tests
node --test tests/matchSystem.integration.test.js

# Run with verbose output
node --test --reporter=spec tests/
```

### Coverage and Quality Verification
```bash
# Verify all match system modules are covered
# Manual verification that tests cover:
# - All critical methods in Match, MatchManager, MatchHandler
# - All state transitions and edge cases
# - All Socket.IO event handlers
# - All error conditions

# Test execution should show no warnings or errors
# All tests should pass consistently
```

## External Resources

### Node.js Testing Documentation
- **Official Node.js Test Runner**: https://nodejs.org/api/test.html
- **Node.js Testing Guide**: https://nodejs.org/en/learn/test-runner/using-test-runner

### Socket.IO Testing Resources  
- **Official Socket.IO Testing Docs**: https://socket.io/docs/v4/testing/
- **Integration Testing Examples**: https://github.com/socketio/socket.io/tree/main/examples
- **Community Best Practices**: https://github.com/goldbergyoni/nodejs-testing-best-practices

### Testing Best Practices
- **Integration-First Testing Approach**: Focus on component/integration tests over pure unit tests
- **Promise-Based Socket.IO Testing**: Use async/await patterns for cleaner test code
- **Real Connection Testing**: Prefer real Socket.IO connections over heavy mocking for integration tests

## Quality Checklist

- [ ] All Match class methods have corresponding unit tests
- [ ] All MatchManager class methods have corresponding unit tests  
- [ ] All MatchHandler Socket.IO events have corresponding tests
- [ ] Integration tests cover all required scenarios from feature specification
- [ ] Test parameters are configurable for faster execution
- [ ] Error handling and edge cases are thoroughly tested
- [ ] Tests follow existing codebase patterns and conventions
- [ ] Socket.IO integration uses real connections for reliability
- [ ] All validation gates execute successfully
- [ ] Test cleanup prevents resource leaks and interference

## Confidence Score: 9/10

This PRP provides comprehensive context for one-pass implementation success:
- **Complete technical context** with existing patterns and code examples
- **Detailed architecture blueprint** showing exactly what to test and how
- **Step-by-step implementation tasks** in logical order
- **Critical code patterns** extracted from existing codebase
- **Executable validation gates** for immediate feedback
- **External resources** for additional context and best practices

The high confidence score reflects the thorough research of existing codebase patterns, comprehensive understanding of the Match System architecture, and inclusion of both unit and integration testing strategies with real Socket.IO testing examples.