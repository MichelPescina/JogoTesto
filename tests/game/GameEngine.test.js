const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Import the GameEngine and related classes
const GameEngine = require('../../src/game/GameEngine.js');
const Player = require('../../src/game/Player.js');
const { PLAYER_STATUS } = require('../../src/utils/constants.js');

describe('GameEngine', () => {
  let gameEngine;
  let testPlayer1;
  let testPlayer2;

  beforeEach(() => {
    gameEngine = new GameEngine();

    testPlayer1 = new Player('player1', 'Alice', 'socket1');
    testPlayer2 = new Player('player2', 'Bob', 'socket2');

    gameEngine.addPlayer(testPlayer1);
    gameEngine.addPlayer(testPlayer2);
  });

  afterEach(() => {
    // Cleanup if needed
    gameEngine = null;
    testPlayer1 = null;
    testPlayer2 = null;
  });

  describe('Player Management', () => {
    test('should add players to the game engine', () => {
      const player = new Player('test1', 'TestPlayer', 'socketTest');
      gameEngine.addPlayer(player);

      const retrievedPlayer = gameEngine.getPlayer('test1');
      assert.strictEqual(retrievedPlayer.id, 'test1');
      assert.strictEqual(retrievedPlayer.name, 'TestPlayer');
      assert.strictEqual(retrievedPlayer.room, 'spawn');
    });

    test('should remove players from the game engine', () => {
      gameEngine.removePlayer('player1');

      const retrievedPlayer = gameEngine.getPlayer('player1');
      assert.strictEqual(retrievedPlayer, null);
    });

    test('should get alive players correctly', () => {
      const alivePlayers = gameEngine.getAlivePlayers();
      assert.strictEqual(alivePlayers.length, 2);

      // Kill one player
      testPlayer1.status = PLAYER_STATUS.DEAD;
      const alivePlayersAfter = gameEngine.getAlivePlayers();
      assert.strictEqual(alivePlayersAfter.length, 1);
      assert.strictEqual(alivePlayersAfter[0].id, 'player2');
    });
  });

  describe('Movement Validation', () => {
    test('movement validation - valid direction from spawn', () => {
      const result = gameEngine.validateMove('spawn', 'north');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.targetRoom, 'village');
      assert.strictEqual(result.error, null);
    });

    test('movement validation - invalid direction', () => {
      const result = gameEngine.validateMove('spawn', 'invalid');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.targetRoom, null);
      assert.ok(result.error.includes('Invalid direction'));
    });

    test('movement validation - no exit in direction', () => {
      // Spawn doesn't have a 'south' exit in our world.json
      const result = gameEngine.validateMove('spawn', 'south');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('No exit in that direction'));
    });

    test('movement validation - invalid room', () => {
      const result = gameEngine.validateMove('nonexistent', 'north');
      assert.strictEqual(result.valid, false);
      assert.ok(result.error.includes('Invalid current room'));
    });
  });

  describe('Player Movement', () => {
    test('should move player successfully', () => {
      const result = gameEngine.movePlayer('player1', 'north');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.oldRoom, 'spawn');
      assert.strictEqual(result.newRoom, 'village');
      assert.strictEqual(testPlayer1.room, 'village');
    });

    test('should fail to move nonexistent player', () => {
      const result = gameEngine.movePlayer('nonexistent', 'north');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Player not found'));
    });

    test('should fail to move in invalid direction', () => {
      const result = gameEngine.movePlayer('player1', 'invalid');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid direction'));
    });
  });

  describe('Combat Resolution', () => {
    test('combat resolution - stronger player wins', () => {
      // Give player1 a weapon to make them stronger
      testPlayer1.weapon = { damage: 5, name: 'Steel Sword' };

      // Move both players to same room
      testPlayer1.room = 'village';
      testPlayer2.room = 'village';

      const result = gameEngine.resolveCombat('player1', 'player2');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.winner.id, 'player1');
      assert.strictEqual(result.loser.id, 'player2');
      assert.strictEqual(testPlayer1.status, PLAYER_STATUS.ALIVE);
      assert.strictEqual(testPlayer2.status, PLAYER_STATUS.DEAD);
      assert.strictEqual(testPlayer1.strength, 2); // Base 1 + 1 for win
    });

    test('combat resolution - defender wins with equal stats', () => {
      // Both players have same stats, attacker should win ties
      testPlayer1.room = 'village';
      testPlayer2.room = 'village';

      const result = gameEngine.resolveCombat('player1', 'player2');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.winner.id, 'player1'); // Attacker wins ties
      assert.strictEqual(result.loser.id, 'player2');
      assert.strictEqual(testPlayer1.strength, 2);
    });

    test('combat resolution - vulnerable player loses automatically', () => {
      testPlayer1.room = 'village';
      testPlayer2.room = 'village';
      testPlayer2.status = PLAYER_STATUS.SEARCHING; // Make defender vulnerable

      const result = gameEngine.resolveCombat('player1', 'player2');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.winner.id, 'player1');
      assert.strictEqual(result.loser.id, 'player2');
      assert.ok(result.reason.includes('vulnerable'));
    });

    test('combat resolution - players not in same room', () => {
      testPlayer1.room = 'spawn';
      testPlayer2.room = 'village';

      const result = gameEngine.resolveCombat('player1', 'player2');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('not in same room'));
    });
  });

  describe('Weapon Search', () => {
    test('weapon search - successful start', () => {
      // Ensure spawn room has a weapon for testing
      const spawnRoom = gameEngine.getRoom('spawn');
      spawnRoom.hasWeapon = true;
      spawnRoom.currentWeapon = { type: 'stick', damage: 1, name: 'Wooden Stick' };

      const result = gameEngine.startWeaponSearch('player1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(testPlayer1.status, PLAYER_STATUS.SEARCHING);
      assert.strictEqual(testPlayer1.isSearching, true);
    });

    test('weapon search - no weapon in room', () => {
      // Ensure spawn room has no weapon
      const spawnRoom = gameEngine.getRoom('spawn');
      spawnRoom.hasWeapon = false;

      const result = gameEngine.startWeaponSearch('player1');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Nothing to find'));
    });

    test('weapon search - completion with weapon found', () => {
      // Set up player as searching
      testPlayer1.status = PLAYER_STATUS.SEARCHING;
      testPlayer1.isSearching = true;

      // Set up room with weapon
      const spawnRoom = gameEngine.getRoom('spawn');
      spawnRoom.hasWeapon = true;
      spawnRoom.currentWeapon = { type: 'knife', damage: 3, name: 'Sharp Knife' };

      const result = gameEngine.completeWeaponSearch('player1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.weaponFound, true);
      assert.strictEqual(result.weapon.type, 'knife');
      assert.strictEqual(testPlayer1.weapon.type, 'knife');
      assert.strictEqual(testPlayer1.status, PLAYER_STATUS.ALIVE);
      assert.strictEqual(spawnRoom.hasWeapon, false);
    });

    test('weapon search - vulnerability window', async () => {
      const spawnRoom = gameEngine.getRoom('spawn');
      spawnRoom.hasWeapon = true;
      spawnRoom.currentWeapon = { type: 'stick', damage: 1, name: 'Wooden Stick' };

      // Start search
      gameEngine.startWeaponSearch('player1');
      assert.strictEqual(testPlayer1.status, PLAYER_STATUS.SEARCHING);

      // Player should be vulnerable during search
      assert.strictEqual(testPlayer1.isVulnerable(), true);

      // Complete search manually (in real game this happens after timeout)
      gameEngine.completeWeaponSearch('player1');
      assert.strictEqual(testPlayer1.status, PLAYER_STATUS.ALIVE);
      assert.strictEqual(testPlayer1.isVulnerable(), false);
    });
  });

  describe('Escape Mechanics', () => {
    test('escape - successful escape', () => {
      // Set up combat scenario
      testPlayer1.room = 'village'; // Village has multiple exits
      testPlayer1.combatParticipant = 'player2';

      // Mock successful escape (50% chance normally)
      const originalAttemptEscape = testPlayer1.attemptEscape;
      testPlayer1.attemptEscape = () => true;

      const result = gameEngine.handleEscape('player1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.escaped, true);
      assert.ok(result.newRoom); // Should have moved to a new room

      // Restore original method
      testPlayer1.attemptEscape = originalAttemptEscape;
    });

    test('escape - failed escape', () => {
      testPlayer1.room = 'village';
      testPlayer1.combatParticipant = 'player2';

      // Mock failed escape
      const originalAttemptEscape = testPlayer1.attemptEscape;
      testPlayer1.attemptEscape = () => false;

      const result = gameEngine.handleEscape('player1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.escaped, false);
      assert.strictEqual(result.died, true);
      assert.strictEqual(testPlayer1.status, PLAYER_STATUS.DEAD);

      // Restore original method
      testPlayer1.attemptEscape = originalAttemptEscape;
    });
  });

  describe('Room Management', () => {
    test('should get players in specific room', () => {
      testPlayer1.room = 'village';
      testPlayer2.room = 'spawn';

      const playersInVillage = gameEngine.getPlayersInRoom('village');
      const playersInSpawn = gameEngine.getPlayersInRoom('spawn');

      assert.strictEqual(playersInVillage.length, 1);
      assert.strictEqual(playersInVillage[0].id, 'player1');
      assert.strictEqual(playersInSpawn.length, 1);
      assert.strictEqual(playersInSpawn[0].id, 'player2');
    });

    test('should handle player disconnection', () => {
      const room = gameEngine.getRoom('spawn');
      assert.ok(room.players.has('player1'));

      gameEngine.handlePlayerDisconnection('player1');

      assert.strictEqual(testPlayer1.status, PLAYER_STATUS.DEAD);
      assert.strictEqual(room.players.has('player1'), false);
    });
  });

  describe('Game State', () => {
    test('should return correct game state', () => {
      const gameState = gameEngine.getGameState();

      assert.strictEqual(gameState.totalPlayers, 2);
      assert.strictEqual(gameState.alivePlayers, 2);
      assert.strictEqual(gameState.deadPlayers, 0);
      assert.ok(gameState.roomCount > 0);

      // Kill one player
      testPlayer1.status = PLAYER_STATUS.DEAD;
      const newGameState = gameEngine.getGameState();

      assert.strictEqual(newGameState.alivePlayers, 1);
      assert.strictEqual(newGameState.deadPlayers, 1);
    });
  });
});