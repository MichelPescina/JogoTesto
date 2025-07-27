# Attack Feature Implementation PRP

## Goal
Complete the attack functionality for the multiplayer text-based RPG battle royale game by implementing a proper 10-second battle timer system that collects player responses and automatically ends battles when the timer expires, regardless of whether all players have responded.

## Why
- **Core Gameplay**: Attack is the primary combat mechanic that drives the battle royale gameplay experience
- **Player Engagement**: Proper timer implementation ensures battles don't stall and maintain pace and excitement
- **Fair Competition**: 10-second timer with trip-time consideration prevents lag advantages and ensures fair response windows
- **System Integration**: Builds on existing Battle, Match, and GameEngine architecture to complete the layered system design

## What
Enhance the existing attack system to include:
- 10-second server-authoritative timer for battle responses
- Automatic collection of player decisions during timer period
- Graceful handling of non-responsive players (treated as ESCAPE decision)
- Real-time notifications to all affected players
- Proper timer cleanup and resource management

### Success Criteria
- [ ] Attack command initiates proper 10-second timer
- [ ] Players can send ATTACK/ESCAPE decisions during timer window
- [ ] Battle automatically ends after 10 seconds regardless of response completeness
- [ ] Non-responsive players are automatically treated as choosing ESCAPE
- [ ] All affected players receive real-time battle updates and results
- [ ] Timer is properly cleaned up when battle ends early or completes
- [ ] System handles edge cases (player disconnection, multiple attacks, etc.)

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: server/Match.js:184-225
  why: Current incomplete attack implementation pattern, shows #handleAttackCommand and #handleRespondCommand structure
  critical: Line 222-224 has hardcoded 1-second timeout that needs to be replaced with proper 10-second timer
  
- file: server/game/Battle.js:1-78
  why: Core Battle class that handles combat logic and decision tracking
  critical: Already has pieceDecision Map and setDecision method for tracking responses

- file: server/game/GameEngine.js:150-257
  why: StartBattle and endBattle methods, battle management patterns
  critical: Line 195-201 shows battle creation and storage in this.battles Map

- file: server/game/GameMsg.js:79-104
  why: Battle start/end message patterns for client communication
  critical: createBattleStart uses ACTION.REPLY which prompts client response

- file: server/Courier.js:1-27
  why: Message delivery system used throughout the layered architecture
  critical: Understand deliver() method for sending notifications

- file: tests/Match.test.js:100-137
  why: Existing test patterns using node:test framework
  critical: Shows mock courier setup and async command testing patterns

- url: https://nodejs.org/api/timers.html
  why: Official Node.js timer documentation for setTimeout/clearTimeout patterns
  section: Timer cleanup and memory management best practices

- url: https://gamedev.stackexchange.com/questions/84641/nodejs-game-server-timer
  why: Node.js multiplayer game timer patterns and best practices
  critical: Individual room timers are more efficient than global intervals
</yaml>

### Current Codebase Structure
```bash
server/
├── Match.js                    # Layer 3 - Match handling with player management
├── game/
│   ├── GameEngine.js          # Layer 4 - Core game logic and battle management
│   ├── Battle.js              # Battle class with decision tracking
│   ├── GameMsg.js             # Message types for client communication
│   └── GameCommand.js         # Command validation and routing
├── Courier.js                 # Message delivery system
└── data/
    └── simplerTestWorld.json  # Game world configuration

tests/
├── Match.test.js              # Match class test patterns
└── runTests.js               # Test runner using node:test
```

### Desired Implementation Structure
```bash
server/Match.js:
  - Add battleTimers Map to track active battle timers
  - Enhance #handleAttackCommand to start 10-second timer
  - Improve #handleRespondCommand to track responses during timer
  - Add #startBattleTimer() method
  - Add #endBattleTimer() method
  - Add #onBattleTimerExpired() callback

server/game/GameEngine.js:
  - Enhance startBattle to return additional battle metadata
  - Improve endBattle to handle partial responses gracefully

tests/Attack.test.js:
  - Test timer initiation and expiration
  - Test partial response handling
  - Test timer cleanup scenarios
```

### Known Gotchas & Critical Patterns
```javascript
// CRITICAL: Node.js timer cleanup pattern used throughout codebase
// Example from Match.js lines 404-416
if (this.countdownTimerId) {
    clearTimeout(this.countdownTimerId);
    this.countdownTimerId = null;
}

// CRITICAL: Error-first callback pattern used in GameCommand.validate
GameCommand.validate(command, (error, validatedCommand) => {
    if (error) {
        // Handle error
        return;
    }
    // Process validated command
});

// CRITICAL: Courier message delivery pattern
this.outCourier.deliver(
    playerId,
    GameMsg.createBattleStart(playerId, battleData)
);

// CRITICAL: Battle decision tracking pattern from Battle.js
this.pieceDecision = new Map(pieces.map(x => [x.pieceId, 'AWAITING']));
this.pieceDecision.set(instigatorId, Battle.DECISION.ATTACK);

// GOTCHA: Always use server-side timing, never trust client timestamps
// GOTCHA: Clear timers in Match.clean() method to prevent memory leaks
// GOTCHA: Handle edge case where player disconnects during battle timer
```

## Implementation Blueprint

### Data Models and Structure
```javascript
// Enhance Match class with battle timer management
class Match {
    constructor(outCourier) {
        // ... existing properties
        this.battleTimers = new Map(); // battleId -> { timerId, startTime, participants }
        this.battleTimeout = 10 * 1000; // 10 seconds for battle responses
    }
}

// Battle response tracking structure
const battleTimerData = {
    timerId: setTimeout(() => {}, 10000),
    startTime: Date.now(),
    participants: new Set([pieceId1, pieceId2, ...]),
    responses: new Map(), // pieceId -> decision
    battleId: battleId
};
```

### List of Tasks to Complete

```yaml
Task 1:
MODIFY server/Match.js:
  - FIND constructor around line 34
  - ADD this.battleTimers = new Map() after line 48
  - ADD this.battleTimeout = 10 * 1000 constant
  - PRESERVE existing initialization patterns

Task 2:
MODIFY server/Match.js #handleAttackCommand method (lines 184-213):
  - FIND const battleId = this.game.startBattle(pieceId) around line 206
  - REPLACE setTimeout in #handleRespondCommand (lines 222-224) with proper timer system
  - ADD call to #startBattleTimer(battleId, pieces) after successful battle creation
  - PRESERVE existing error handling patterns

Task 3:
CREATE new methods in server/Match.js:
  - ADD #startBattleTimer(battleId, participants) method
  - ADD #onBattleTimerExpired(battleId) callback method  
  - ADD #cleanupBattleTimer(battleId) utility method
  - MIRROR error handling patterns from existing grace period methods

Task 4:
MODIFY server/Match.js #handleRespondCommand method (lines 217-225):
  - FIND existing setTimeout and replace with proper response tracking
  - ADD response validation and tracking to battleTimers
  - ADD check for timer completion (all responses collected)
  - PRESERVE existing battle.setDecision call

Task 5:
MODIFY server/Match.js clean() method (lines 403-422):
  - FIND existing timer cleanup around line 411
  - ADD cleanup for all battleTimers using clearTimeout
  - PRESERVE existing cleanup pattern for consistency

Task 6:
CREATE tests/Attack.test.js:
  - MIRROR test structure from tests/Match.test.js
  - ADD timer initiation test
  - ADD partial response handling test
  - ADD timer cleanup test
  - USE existing mock courier pattern
```

### Task Implementation Details

#### Task 1: Enhance Match Constructor
```javascript
// Add after line 48 in Match.js constructor
this.battleTimers = new Map(); // battleId -> timer data
this.battleTimeout = 10 * 1000; // 10 seconds for battle responses
```

#### Task 2: Enhance Attack Command Handler  
```javascript
// Replace lines 206-213 in #handleAttackCommand
const battleId = this.game.startBattle(pieceId);
if (!battleId) {
    this.outCourier.deliver(
        playerId,
        GameMsg.createError(playerId, "Cannot start battle")
    );
    return;
}

// Start the 10-second timer for this battle
const room = this.worldMap.get(attacker.getRoomId());
const participants = Array.from(room.getAllPieces())
    .filter(id => this.allPieces.get(id).getState() === Piece.STATE.BATTLING);
    
this.#startBattleTimer(battleId, participants);
```

#### Task 3: Create Timer Management Methods
```javascript
// Add to Match.js class
#startBattleTimer(battleId, participants) {
    const timerId = setTimeout(() => {
        this.#onBattleTimerExpired(battleId);
    }, this.battleTimeout);
    
    const timerData = {
        timerId,
        startTime: Date.now(),
        participants: new Set(participants),
        responses: new Map(),
        battleId
    };
    
    this.battleTimers.set(battleId, timerData);
    
    // Notify participants of timer start
    participants.forEach(pieceId => {
        const playerId = this.pieceToPlayer.get(pieceId);
        this.outCourier.deliver(
            playerId,
            GameMsg.createBattleStart(playerId, {
                battleId,
                timeLimit: this.battleTimeout,
                message: "You have 10 seconds to respond!"
            })
        );
    });
}

#onBattleTimerExpired(battleId) {
    const timerData = this.battleTimers.get(battleId);
    if (!timerData) return;
    
    // Set default ESCAPE decision for non-responsive players
    timerData.participants.forEach(pieceId => {
        if (!timerData.responses.has(pieceId)) {
            // Player didn't respond, treat as ESCAPE
            this.game.respondToAttack(battleId, pieceId, Battle.DECISION.ESCAPE);
        }
    });
    
    // End the battle
    this.game.endBattle(battleId);
    this.#cleanupBattleTimer(battleId);
}

#cleanupBattleTimer(battleId) {
    const timerData = this.battleTimers.get(battleId);
    if (timerData) {
        clearTimeout(timerData.timerId);
        this.battleTimers.delete(battleId);
    }
}
```

#### Task 4: Enhance Response Handler
```javascript
// Replace #handleRespondCommand method (lines 217-225)
#handleRespondCommand(playerId, pieceId, command) {
    const timerData = this.battleTimers.get(command.battleId);
    if (!timerData) {
        this.outCourier.deliver(
            playerId,
            GameMsg.createError(playerId, "Battle timer has expired or battle not found")
        );
        return;
    }
    
    // Record the response
    timerData.responses.set(pieceId, command.decision);
    
    // Set decision in battle system
    this.game.respondToAttack(command.battleId, pieceId, command.decision);
    
    // Check if all participants have responded
    if (timerData.responses.size === timerData.participants.size) {
        // All players responded, end battle early
        this.game.endBattle(command.battleId);
        this.#cleanupBattleTimer(command.battleId);
    }
}
```

#### Task 5: Enhance Cleanup Method
```javascript
// Add to clean() method around line 416
// Clear all battle timers
for (const [battleId, timerData] of this.battleTimers) {
    clearTimeout(timerData.timerId);
}
this.battleTimers.clear();
```

### Integration Points
```yaml
TIMER_SYSTEM:
  - pattern: "Use setTimeout with clearTimeout for proper cleanup"
  - location: "Match.js battle timer management"
  
MESSAGE_DELIVERY:
  - pattern: "this.outCourier.deliver(playerId, GameMsg.createX(...))"
  - location: "All player notifications"
  
ERROR_HANDLING:
  - pattern: "Error-first callbacks and graceful degradation"
  - location: "Timer expiration and response validation"

BATTLE_MANAGEMENT:
  - integration: "this.game.startBattle() and this.game.endBattle()"
  - location: "GameEngine battle lifecycle"
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                     # ESLint validation
node --check server/Match.js     # Syntax validation

# Expected: No errors. If errors, READ the error and fix.
```

### Level 2: Unit Tests
```javascript
// CREATE tests/Attack.test.js with these test cases:
describe('Attack System with Timer', () => {
    test('should start 10-second timer when battle begins', async () => {
        const courier = createMockCourier();
        const match = new Match(courier);
        
        // Setup players and start battle
        const battleId = await setupBattleScenario(match);
        
        // Verify timer was created
        assert(match.battleTimers.has(battleId));
        assert(match.battleTimers.get(battleId).timerId);
    });

    test('should end battle when timer expires with partial responses', async () => {
        const courier = createMockCourier();
        const match = new Match(courier);
        
        const battleId = await setupBattleScenario(match);
        
        // Let timer expire without all responses
        await new Promise(resolve => setTimeout(resolve, 11000));
        
        // Verify battle was ended and timer cleaned up
        assert(!match.battleTimers.has(battleId));
    });

    test('should end battle early when all players respond', async () => {
        const courier = createMockCourier();
        const match = new Match(courier);
        
        const battleId = await setupBattleScenario(match);
        
        // All players respond quickly
        match.execGameComm('player1', { type: 'RESPOND', battleId, decision: 'ATTACK' });
        match.execGameComm('player2', { type: 'RESPOND', battleId, decision: 'ESCAPE' });
        
        // Verify timer was cleaned up immediately
        assert(!match.battleTimers.has(battleId));
    });

    test('should clean up timers when match is destroyed', () => {
        const courier = createMockCourier();
        const match = new Match(courier);
        
        // Create some battle timers
        const battleId = 'test-battle';
        match.battleTimers.set(battleId, { 
            timerId: setTimeout(() => {}, 10000),
            participants: new Set(['player1'])
        });
        
        match.clean();
        
        assert.strictEqual(match.battleTimers.size, 0);
    });
});
```

```bash
# Run and iterate until passing:
npm test -- tests/Attack.test.js
# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Test
```bash
# Start the server
npm start

# Test battle flow using a test client or manual testing
# 1. Join multiple players to a match
# 2. Move players to same room  
# 3. Initiate attack
# 4. Verify 10-second timer appears
# 5. Test both full responses and partial responses
# 6. Verify battle ends correctly in both cases

# Expected: Battle system works end-to-end with proper timing
```

## Final Validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`  
- [ ] Manual integration test successful
- [ ] Attack timer starts correctly on battle initiation
- [ ] Players can respond during 10-second window
- [ ] Battle ends automatically after 10 seconds
- [ ] Non-responsive players treated as ESCAPE
- [ ] Timer cleanup prevents memory leaks
- [ ] Error cases handled gracefully
- [ ] Documentation updated in code comments

---

## Anti-Patterns to Avoid
- ❌ Don't trust client-side timing - keep all timing server-authoritative
- ❌ Don't forget to clear timers - always clean up in Match.clean()
- ❌ Don't create new patterns - follow existing error-first callback style
- ❌ Don't ignore edge cases - handle player disconnection during battles
- ❌ Don't hardcode timeouts - use configurable constants
- ❌ Don't skip validation - validate battleId and playerId in responses

**PRP Confidence Score: 9/10** - High confidence for one-pass implementation success due to comprehensive context, existing patterns to follow, clear validation gates, and detailed task breakdown with specific line references.