name: "Weapon Search Modal Bug Fix PRP - Context-Rich with Validation"
description: |

## Purpose
Fix critical bug where weapon search modal freezes client when timer expires, leaving player unable to continue playing while other players and server continue normally.

---

## Goal
Fix the weapon search modal bug where client becomes unresponsive after the search timer expires, ensuring proper cleanup of client-side state and modal visibility.

## Why
- **Critical User Experience**: Players become completely stuck and must refresh to continue playing
- **Game Integrity**: Bug breaks core weapon acquisition mechanic in battle royale gameplay  
- **Reliability**: Only affects individual player client while others continue, creating unfair advantage/disadvantage
- **Technical Debt**: Exposes poor timeout cleanup patterns that could affect other timed features

## What
When a player initiates weapon search (SPACE key), a 2-second timer modal appears with progress bar. Currently, when timer expires naturally:
- ✅ Server completes search properly and continues game logic
- ✅ Other players see normal game state  
- ❌ **BUG**: Initiating player's modal remains visible and client becomes unresponsive
- ❌ **BUG**: Player remains in `isSearching = true` state permanently
- ❌ **BUG**: All subsequent player actions are blocked

### Success Criteria
- [ ] Weapon search modal disappears automatically when timer expires
- [ ] Client remains responsive after search timeout
- [ ] Player can immediately initiate new actions after search completes
- [ ] No regression in multiplayer functionality
- [ ] Proper error handling if server fails to respond

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: /home/miau/Proyectos/JogoTesto/public/js/client.js
  lines: 416-433
  why: Contains buggy showSearchModal function that only clears interval but doesn't cleanup state
  critical: Missing modal hide and isSearching reset on timeout
  
- file: /home/miau/Proyectos/JogoTesto/public/js/client.js  
  lines: 130-134, 218-228
  why: Shows weapon search initiation and handleSearchCompleted patterns to follow
  critical: handleSearchCompleted properly resets isSearching and hides modal
  
- file: /home/miau/Proyectos/JogoTesto/public/js/client.js
  lines: 450-458  
  why: Combat modal timer pattern that properly handles timeout with fallback action
  critical: Shows correct pattern for client-side timer cleanup with state management
  
- file: /home/miau/Proyectos/JogoTesto/src/handlers/socketHandlers.js
  lines: 182-201
  why: Server-side weapon search completion logic that should emit SEARCH_COMPLETED
  critical: Understand timing expectations between client and server
  
- file: /home/miau/Proyectos/JogoTesto/src/game/GameEngine.js
  lines: 172-250
  why: Core game logic for weapon search state management
  critical: Server properly manages player state transitions
```

### Current Codebase Tree (Relevant Files)
```bash
/home/miau/Proyectos/JogoTesto/
├── public/js/client.js                 # CLIENT BUG HERE - Modal cleanup missing
├── src/handlers/socketHandlers.js      # Server-side search completion
├── src/game/GameEngine.js             # Core weapon search logic  
├── src/game/Player.js                 # Player state management
├── tests/game/GameEngine.test.js      # Existing weapon search tests
├── tests/integration/socketHandlers.test.js  # Integration test patterns
```

### Known Gotchas & Critical Patterns
```javascript
// CRITICAL: Client-side timer cleanup pattern (from combat modal)
const timerInterval = setInterval(() => {
  // Update UI logic here
  if (timeLeft <= 0) {
    clearInterval(timerInterval);           // ✅ Clear interval
    this.respondToCombat('escape');         // ✅ Take fallback action  
    // MISSING IN WEAPON SEARCH: Hide modal + reset state
  }
}, 1000);

// CRITICAL: Proper search completion pattern (existing working code)
handleSearchCompleted(result) {
  this.isSearching = false;              // ✅ Reset searching state
  this.hideModal('searchModal');         // ✅ Hide modal properly
  // Update player data...
}

// CRITICAL: Modal management pattern  
showModal(modalId) { document.getElementById(modalId).classList.remove('hidden'); }
hideModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }

// GOTCHA: Two server-side timers exist (potential race condition but not the bug)
// - socketHandlers.js line 182: setTimeout for completion
// - Player.js line 129: setTimeout for auto-completion  
// Both work correctly, client cleanup is the only issue

// GOTCHA: Client progress bar updates every 100ms but timer is 2000ms total
// Math: elapsed >= duration triggers cleanup (elapsed starts at 0, increments by 100)
```

## Implementation Blueprint

### Root Cause Analysis
The bug is in `client.js` `showSearchModal()` function (lines 416-433):
1. Creates progress bar timer with `setInterval` 
2. When `elapsed >= duration`, only calls `clearInterval(interval)`
3. **MISSING**: Does not hide modal or reset `isSearching` state
4. **MISSING**: No fallback if server never responds with SEARCH_COMPLETED event

### List of tasks to be completed in order

```yaml
Task 1: Fix Client-Side Timer Cleanup
MODIFY public/js/client.js:
  - FIND pattern: showSearchModal function (lines 416-433)
  - LOCATE: "if (elapsed >= duration) { clearInterval(interval); }" block  
  - INJECT after clearInterval: Modal hide + state reset logic
  - PATTERN: Mirror handleSearchCompleted cleanup logic
  - PRESERVE: Existing progress bar animation and timing

Task 2: Add Defensive Server Response Timeout  
MODIFY public/js/client.js:
  - FIND pattern: searchForWeapon function (lines 130-134)
  - ADD: Server response timeout as backup cleanup mechanism
  - PATTERN: Similar to existing socket timeout patterns in codebase
  - PRESERVE: Existing search initiation logic

Task 3: Create Unit Tests for Modal Cleanup
CREATE tests/client/weaponSearch.test.js:
  - MIRROR pattern from: tests/integration/socketHandlers.test.js
  - TEST: Modal cleanup on timer expiration
  - TEST: State reset on timer expiration  
  - EDGE CASE: Server never responds scenario
  - FAILURE CASE: Multiple rapid search attempts

Task 4: Integration Test with Server Disconnect
MODIFY tests/integration/socketHandlers.test.js:
  - ADD test case: Weapon search with server disconnect during timer
  - PATTERN: Follow existing disconnect test patterns
  - VERIFY: Client recovers gracefully without manual intervention
```

### Task 1 Pseudocode - Critical Client Fix
```javascript
// MODIFY: showSearchModal function in client.js around line 430
if (elapsed >= duration) {
  clearInterval(interval);               // ✅ Existing - keep this
  
  // NEW: Add proper cleanup (mirror handleSearchCompleted pattern)  
  this.isSearching = false;              // Reset searching state
  this.hideModal('searchModal');         // Hide the modal
  
  // NEW: Add fallback message since server should have responded
  this.addMessage("Search completed (no weapon found)", 'game-message');
  
  // GOTCHA: Don't emit to server - server timer handles completion
  // GOTCHA: Don't duplicate handleSearchCompleted logic, just cleanup
}
```

### Task 2 Pseudocode - Defensive Server Timeout
```javascript  
// MODIFY: searchForWeapon function to add backup cleanup
searchForWeapon() {
  if (this.isSearching || this.inCombat) return;
  
  // Existing logic
  this.socket.emit(SOCKET_EVENTS.SEARCH);
  
  // NEW: Add defensive timeout in case server never responds
  this.searchBackupTimeout = setTimeout(() => {
    if (this.isSearching) {  // Only if still searching (server didn't respond)
      console.warn('Server search response timeout - forcing cleanup');
      this.handleSearchCompleted({ success: false, weapon: null });
    }
  }, GAME_CONFIG.WEAPON_SEARCH_DURATION + 1000);  // Server timeout + 1s buffer
}

// MODIFY: handleSearchCompleted to clear backup timeout
handleSearchCompleted(result) {
  clearTimeout(this.searchBackupTimeout);  // NEW: Clear backup timer
  this.isSearching = false;                // Existing
  this.hideModal('searchModal');           // Existing  
  // ... rest of existing logic
}
```

### Integration Points
```yaml
CONFIG:
  - no changes needed: uses existing GAME_CONFIG.WEAPON_SEARCH_DURATION
  
CLIENT_STATE:
  - isSearching: boolean flag that must be reset on timeout
  - searchBackupTimeout: new timeout ID for cleanup
  
SOCKET_EVENTS:  
  - preserve: existing SEARCH and SEARCH_COMPLETED events
  - no new events needed
  
MODAL_SYSTEM:
  - uses: existing showModal/hideModal pattern
  - target: 'searchModal' ID (already exists)
```

## Validation Loop

### Level 1: Syntax & Style  
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint                           # ESLint check
# Expected: No errors in client.js changes
```

### Level 2: Unit Tests 
```javascript
// CREATE tests/client/weaponSearch.test.js following node:test pattern
const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('Weapon Search Modal Bug Fix', () => {
  let mockClient;
  
  beforeEach(() => {
    // Setup DOM and client mock
  });
  
  test('should hide modal and reset state when timer expires', () => {
    // Simulate search start
    mockClient.showSearchModal(2000);
    assert.strictEqual(mockClient.isSearching, true);
    
    // Fast-forward timer to completion
    advanceTimer(2000);
    
    // Verify cleanup
    assert.strictEqual(mockClient.isSearching, false);
    assert.strictEqual(isModalHidden('searchModal'), true);
  });
  
  test('should handle server response timeout gracefully', () => {
    mockClient.searchForWeapon();
    
    // Server never responds - backup timeout triggers  
    advanceTimer(3000);
    
    assert.strictEqual(mockClient.isSearching, false);
  });
  
  test('should not double-cleanup if server responds normally', () => {
    mockClient.searchForWeapon();
    
    // Server responds before backup timeout
    mockClient.handleSearchCompleted({ success: true, weapon: 'sword' });
    
    // Backup timeout shouldn't trigger additional cleanup
    advanceTimer(3000);
    // Should still be properly cleaned up (no double-reset errors)
  });
});
```

```bash
# Run and iterate until passing:
npm test
# If failing: Read error, fix code, re-run (focus on timer and state management)
```

### Level 3: Integration Test
```bash
# Start the server
npm start

# In browser console or automated test:
# 1. Join a match
# 2. Press SPACE to start weapon search  
# 3. Wait for 2 seconds without touching anything
# 4. Verify: Modal disappears, can press SPACE again immediately

# Expected: Player can continue playing normally after search timeout
# If failing: Check browser console for errors, verify modal DOM state
```

### Level 4: Multiplayer Integration
```bash
# Test the multiplayer scenario that originally had the bug:
# 1. Start server with 2 players
# 2. Player 1 starts weapon search (SPACE)
# 3. Wait for natural timeout (don't let server complete it)
# 4. Verify: Player 1 modal disappears and can continue playing
# 5. Verify: Player 2 sees normal game state throughout

# Expected: Both players continue playing normally, no one gets stuck
```

## Final Validation Checklist
- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`  
- [ ] Manual test successful: Start search, wait for timeout, can search again
- [ ] Multiplayer test: Other players unaffected during/after search timeout
- [ ] Error cases handled: Server disconnect during search
- [ ] No console errors during normal operation
- [ ] Modal properly hidden after timeout (visually confirm)
- [ ] `isSearching` state correctly reset (can verify in browser devtools)

---

## Anti-Patterns to Avoid
- ❌ Don't modify server-side timer logic (it works correctly)
- ❌ Don't add new socket events (existing SEARCH/SEARCH_COMPLETED work)
- ❌ Don't change WEAPON_SEARCH_DURATION config (timing is correct)  
- ❌ Don't duplicate handleSearchCompleted logic in timer cleanup
- ❌ Don't remove progress bar animation (UI works, just needs cleanup)
- ❌ Don't add complex state machines (simple boolean flags work fine)
- ❌ Don't mock timers in tests just to pass (test real timeout behavior)

## Confidence Score: 9/10
This PRP provides complete context for one-pass implementation. The bug is isolated to client-side cleanup, server logic is working correctly, and clear patterns exist in the codebase to follow. Only minor risk is around timer interaction testing, but the implementation is straightforward state management.