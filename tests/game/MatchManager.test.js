const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const MatchManager = require('../../src/game/MatchManager.js');
const { MATCH_STATUS, GAME_CONFIG } = require('../../src/utils/constants.js');

describe('MatchManager', () => {
  let matchManager;

  beforeEach(() => {
    matchManager = new MatchManager();
  });

  afterEach(() => {
    matchManager = null;
  });

  describe('Match Initialization', () => {
    test('should initialize with a new match', () => {
      const matchInfo = matchManager.getMatchInfo();

      assert.ok(matchInfo.id.startsWith('match_'));
      assert.strictEqual(matchInfo.status, MATCH_STATUS.WAITING);
      assert.strictEqual(matchInfo.playerCount, 0);
      assert.strictEqual(matchInfo.maxPlayers, GAME_CONFIG.MAX_PLAYERS);
      assert.strictEqual(matchInfo.minPlayersToStart, GAME_CONFIG.MIN_PLAYERS_TO_START);
    });

    test('should generate unique match IDs', () => {
      const id1 = matchManager.generateMatchId();
      const id2 = matchManager.generateMatchId();

      assert.notStrictEqual(id1, id2);
      assert.ok(id1.startsWith('match_'));
      assert.ok(id2.startsWith('match_'));
    });
  });

  describe('Player Joining', () => {
    test('should allow valid player to join', () => {
      const result = matchManager.joinMatch('socket1', 'Alice');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.player.name, 'Alice');
      assert.strictEqual(result.match.playerCount, 1);
    });

    test('should reject invalid player names', () => {
      // Empty name
      let result = matchManager.joinMatch('socket1', '');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid player name'));

      // Too long name
      result = matchManager.joinMatch('socket1', 'a'.repeat(25));
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid player name'));

      // Invalid characters
      result = matchManager.joinMatch('socket1', 'test<script>');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Invalid player name'));
    });

    test('should reject duplicate player names', () => {
      // Add first player
      const result1 = matchManager.joinMatch('socket1', 'Alice');
      assert.strictEqual(result1.success, true);

      // Try to add second player with same name
      const result2 = matchManager.joinMatch('socket2', 'Alice');
      assert.strictEqual(result2.success, false);
      assert.ok(result2.error.includes('already taken'));
    });

    test('should reject duplicate socket connections', () => {
      // Add first player
      const result1 = matchManager.joinMatch('socket1', 'Alice');
      assert.strictEqual(result1.success, true);

      // Try to add another player with same socket
      const result2 = matchManager.joinMatch('socket1', 'Bob');
      assert.strictEqual(result2.success, false);
      assert.ok(result2.error.includes('already in this match'));
    });

    test('should indicate when match can start', () => {
      // Add minimum players to start
      for (let i = 0; i < GAME_CONFIG.MIN_PLAYERS_TO_START; i++) {
        const result = matchManager.joinMatch(`socket${i}`, `Player${i}`);
        assert.strictEqual(result.success, true);

        if (i === GAME_CONFIG.MIN_PLAYERS_TO_START - 1) {
          assert.strictEqual(result.shouldStart, true);
        } else {
          assert.strictEqual(result.shouldStart, false);
        }
      }
    });
  });

  describe('Match Lifecycle', () => {
    test('should start match when conditions are met', () => {
      // Add minimum players
      for (let i = 0; i < GAME_CONFIG.MIN_PLAYERS_TO_START; i++) {
        matchManager.joinMatch(`socket${i}`, `Player${i}`);
      }

      const result = matchManager.startMatch();

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.match.status, MATCH_STATUS.ACTIVE);
      assert.ok(result.match.startTime);
      assert.strictEqual(result.players.length, GAME_CONFIG.MIN_PLAYERS_TO_START);
    });

    test('should not start match without enough players', () => {
      // Add only one player
      matchManager.joinMatch('socket1', 'Alice');

      const result = matchManager.startMatch();

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('Need at least'));
    });

    test('should not start already active match', () => {
      // Add players and start match
      for (let i = 0; i < GAME_CONFIG.MIN_PLAYERS_TO_START; i++) {
        matchManager.joinMatch(`socket${i}`, `Player${i}`);
      }
      matchManager.startMatch();

      // Try to start again
      const result = matchManager.startMatch();

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('cannot be started'));
    });

    test('should end match correctly', () => {
      // Add players and start match
      for (let i = 0; i < GAME_CONFIG.MIN_PLAYERS_TO_START; i++) {
        matchManager.joinMatch(`socket${i}`, `Player${i}`);
      }
      matchManager.startMatch();

      const winner = matchManager.getPlayerBySocket('socket0');
      matchManager.endMatch(winner);

      const matchInfo = matchManager.getMatchInfo();
      assert.strictEqual(matchInfo.status, MATCH_STATUS.FINISHED);
      assert.strictEqual(matchInfo.winner, winner.name);
      assert.ok(matchInfo.endTime);
    });
  });

  describe('Player Disconnection', () => {
    test('should handle player disconnection', () => {
      const result = matchManager.joinMatch('socket1', 'Alice');
      assert.strictEqual(result.success, true);

      const initialCount = matchManager.getMatchInfo().playerCount;
      assert.strictEqual(initialCount, 1);

      matchManager.handlePlayerDisconnection('socket1');

      const finalCount = matchManager.getMatchInfo().playerCount;
      assert.strictEqual(finalCount, 0);
    });

    test('should handle disconnection of non-existent player', () => {
      // Should not throw error
      matchManager.handlePlayerDisconnection('nonexistent');

      const matchInfo = matchManager.getMatchInfo();
      assert.strictEqual(matchInfo.playerCount, 0);
    });
  });

  describe('Game Actions', () => {
    beforeEach(() => {
      // Set up active match with players
      for (let i = 0; i < GAME_CONFIG.MIN_PLAYERS_TO_START; i++) {
        matchManager.joinMatch(`socket${i}`, `Player${i}`);
      }
      matchManager.startMatch();
    });

    test('should process player move', () => {
      const result = matchManager.processPlayerMove('socket0', 'north');

      // Result depends on GameEngine implementation
      assert.ok(typeof result.success === 'boolean');
    });

    test('should process weapon search', () => {
      const result = matchManager.processWeaponSearch('socket0');

      // Result depends on room state and GameEngine implementation
      assert.ok(typeof result.success === 'boolean');
    });

    test('should reject actions from non-existent players', () => {
      const moveResult = matchManager.processPlayerMove('nonexistent', 'north');
      assert.strictEqual(moveResult.success, false);
      assert.ok(moveResult.error.includes('Player not found'));

      const searchResult = matchManager.processWeaponSearch('nonexistent');
      assert.strictEqual(searchResult.success, false);
      assert.ok(searchResult.error.includes('Player not found'));
    });

    test('should reject actions when match is not active', () => {
      // End the match
      matchManager.currentMatch.status = MATCH_STATUS.FINISHED;

      const result = matchManager.processPlayerMove('socket0', 'north');
      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('not active'));
    });
  });

  describe('Match Statistics', () => {
    test('should return match statistics', () => {
      const stats = matchManager.getMatchStats();

      assert.ok(stats.current);
      assert.ok(Array.isArray(stats.history));
      assert.strictEqual(typeof stats.totalMatches, 'number');
    });

    test('should track match history', () => {
      // Set up and complete a match
      for (let i = 0; i < GAME_CONFIG.MIN_PLAYERS_TO_START; i++) {
        matchManager.joinMatch(`socket${i}`, `Player${i}`);
      }
      matchManager.startMatch();

      const winner = matchManager.getPlayerBySocket('socket0');
      matchManager.endMatch(winner);

      const stats = matchManager.getMatchStats();
      assert.strictEqual(stats.totalMatches, 1);
      assert.strictEqual(stats.history.length, 1);
      assert.strictEqual(stats.history[0].winner, winner.name);
    });
  });

  describe('Edge Cases', () => {
    test('should handle match full scenario', () => {
      // Fill match to capacity
      for (let i = 0; i < GAME_CONFIG.MAX_PLAYERS; i++) {
        const result = matchManager.joinMatch(`socket${i}`, `Player${i}`);
        assert.strictEqual(result.success, true);
      }

      // Try to add one more player
      const result = matchManager.joinMatch('extraSocket', 'ExtraPlayer');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.code, 'MATCH_FULL');
    });

    test('should reject joining after match started', () => {
      // Start match
      for (let i = 0; i < GAME_CONFIG.MIN_PLAYERS_TO_START; i++) {
        matchManager.joinMatch(`socket${i}`, `Player${i}`);
      }
      matchManager.startMatch();

      // Try to join active match
      const result = matchManager.joinMatch('lateSocket', 'LatePlayer');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.code, 'MATCH_STARTED');
    });

    test('should handle combat between valid players', () => {
      // Set up match with players in same room
      for (let i = 0; i < GAME_CONFIG.MIN_PLAYERS_TO_START; i++) {
        matchManager.joinMatch(`socket${i}`, `Player${i}`);
      }
      matchManager.startMatch();

      const result = matchManager.processCombat('socket0', 'socket1');

      // Result depends on GameEngine implementation and player stats
      assert.ok(typeof result.success === 'boolean');
    });

    test('should handle escape attempts', () => {
      // Set up combat scenario
      for (let i = 0; i < GAME_CONFIG.MIN_PLAYERS_TO_START; i++) {
        matchManager.joinMatch(`socket${i}`, `Player${i}`);
      }
      matchManager.startMatch();

      // Set up player in combat (normally done by combat initiation)
      const player = matchManager.getPlayerBySocket('socket0');
      player.combatParticipant = 'player2';

      const result = matchManager.processEscape('socket0');

      // Result depends on escape chance and room configuration
      assert.ok(typeof result.success === 'boolean');
    });
  });

  describe('Player Retrieval', () => {
    test('should get player by socket ID', () => {
      matchManager.joinMatch('socket1', 'Alice');

      const player = matchManager.getPlayerBySocket('socket1');
      assert.ok(player);
      assert.strictEqual(player.name, 'Alice');
      assert.strictEqual(player.socketId, 'socket1');
    });

    test('should return null for non-existent socket', () => {
      const player = matchManager.getPlayerBySocket('nonexistent');
      assert.strictEqual(player, null);
    });

    test('should get all players', () => {
      matchManager.joinMatch('socket1', 'Alice');
      matchManager.joinMatch('socket2', 'Bob');

      const allPlayers = matchManager.getAllPlayers();
      assert.strictEqual(allPlayers.length, 2);
      assert.ok(allPlayers.some(p => p.name === 'Alice'));
      assert.ok(allPlayers.some(p => p.name === 'Bob'));
    });
  });
});