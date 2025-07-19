/**
 * Unit tests for RoomSystem
 * Tests room loading, validation, player management, and navigation
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const RoomSystem = require('../src/systems/roomSystem');

// Test room data
const testRoomsData = {
  'metadata': {
    'version': '1.0',
    'name': 'Test World',
    'description': 'Test room data for unit testing'
  },
  'rooms': {
    'test_room_1': {
      'id': 'test_room_1',
      'name': 'Test Room 1',
      'description': 'A simple test room.',
      'exits': {
        'north': {
          'destination': 'test_room_2',
          'keywords': ['north', 'n'],
          'description': 'Go north to test room 2'
        }
      },
      'commands': {
        'look': 'Look around the test room',
        'test': 'A test command'
      }
    },
    'test_room_2': {
      'id': 'test_room_2',
      'name': 'Test Room 2',
      'description': 'Another test room.',
      'exits': {
        'south': {
          'destination': 'test_room_1',
          'keywords': ['south', 's'],
          'description': 'Go south to test room 1'
        }
      }
    },
    'isolated_room': {
      'id': 'isolated_room',
      'name': 'Isolated Room',
      'description': 'A room with no exits.'
    }
  }
};

const invalidRoomsData = {
  'rooms': {
    'invalid_room': {
      'id': 'invalid_room',
      'name': 'Invalid Room',
      'description': 'A room with invalid exit',
      'exits': {
        'north': {
          'destination': 'non_existent_room',
          'keywords': ['north'],
          'description': 'Goes nowhere'
        }
      }
    }
  }
};

describe('RoomSystem', () => {
  let roomSystem;
  let testFilePath;
  let invalidFilePath;

  beforeEach(() => {
    roomSystem = new RoomSystem();
    // Set default room to match test data
    roomSystem.defaultRoom = 'test_room_1';
    
    // Create temporary test files
    testFilePath = path.join(__dirname, 'test_rooms.json');
    invalidFilePath = path.join(__dirname, 'invalid_rooms.json');
    
    fs.writeFileSync(testFilePath, JSON.stringify(testRoomsData));
    fs.writeFileSync(invalidFilePath, JSON.stringify(invalidRoomsData));
  });

  afterEach(() => {
    // Clean up temporary test files
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    if (fs.existsSync(invalidFilePath)) {
      fs.unlinkSync(invalidFilePath);
    }
  });

  describe('constructor', () => {
    test('should initialize with empty state', () => {
      assert.strictEqual(roomSystem.rooms.size, 0);
      assert.strictEqual(roomSystem.playerRooms.size, 0);
      assert.strictEqual(roomSystem.isLoaded, false);
      assert.strictEqual(roomSystem.defaultRoom, 'test_room_1'); // Set in beforeEach
    });
  });

  describe('loadRoomsFromJSON', () => {
    test('should load valid room data successfully', async () => {
      const result = await roomSystem.loadRoomsFromJSON(testFilePath);
      
      assert.strictEqual(result, true);
      assert.strictEqual(roomSystem.isLoaded, true);
      assert.strictEqual(roomSystem.rooms.size, 3);
      assert.strictEqual(roomSystem.rooms.has('test_room_1'), true);
      assert.strictEqual(roomSystem.rooms.has('test_room_2'), true);
      assert.strictEqual(roomSystem.rooms.has('isolated_room'), true);
    });

    test('should fail to load invalid room data', async () => {
      const result = await roomSystem.loadRoomsFromJSON(invalidFilePath);
      
      assert.strictEqual(result, false);
      assert.strictEqual(roomSystem.isLoaded, false);
      console.log(roomSystem.rooms)
      assert.strictEqual(roomSystem.rooms.size, 0);
    });

    test('should fail to load non-existent file', async () => {
      const result = await roomSystem.loadRoomsFromJSON('non_existent_file.json');
      
      assert.strictEqual(result, false);
      assert.strictEqual(roomSystem.isLoaded, false);
    });

    test('should validate room structure', async () => {
      // Create malformed room data
      const malformedData = {
        'rooms': {
          'bad_room': {
            'id': 'bad_room'
            // Missing required fields
          }
        }
      };
      
      const malformedFilePath = path.join(__dirname, 'malformed_rooms.json');
      fs.writeFileSync(malformedFilePath, JSON.stringify(malformedData));
      
      const result = await roomSystem.loadRoomsFromJSON(malformedFilePath);
      
      assert.strictEqual(result, false);
      assert.strictEqual(roomSystem.isLoaded, false);
      
      // Cleanup
      fs.unlinkSync(malformedFilePath);
    });

    test('should validate exit destinations exist', async () => {
      const result = await roomSystem.loadRoomsFromJSON(invalidFilePath);
      
      assert.strictEqual(result, false);
      assert.strictEqual(roomSystem.isLoaded, false);
    });
  });

  describe('player management', () => {
    beforeEach(async () => {
      await roomSystem.loadRoomsFromJSON(testFilePath);
    });

    test('should add player successfully', () => {
      const result = roomSystem.addPlayer('player1');
      
      assert.strictEqual(result, true);
      assert.strictEqual(roomSystem.playerRooms.get('player1'), 'test_room_1');
    });

    test('should not add player when not loaded', () => {
      const unloadedSystem = new RoomSystem();
      const result = unloadedSystem.addPlayer('player1');
      
      assert.strictEqual(result, false);
    });

    test('should not add player with invalid ID', () => {
      const result = roomSystem.addPlayer('');
      
      assert.strictEqual(result, false);
    });

    test('should remove player successfully', () => {
      roomSystem.addPlayer('player1');
      const result = roomSystem.removePlayer('player1');
      
      assert.strictEqual(result, true);
      assert.strictEqual(roomSystem.playerRooms.has('player1'), false);
    });

    test('should return false when removing non-existent player', () => {
      const result = roomSystem.removePlayer('non_existent_player');
      
      assert.strictEqual(result, false);
    });
  });

  describe('player movement', () => {
    beforeEach(async () => {
      await roomSystem.loadRoomsFromJSON(testFilePath);
      roomSystem.addPlayer('player1');
    });

    test('should move player successfully with valid direction', () => {
      const result = roomSystem.movePlayer('player1', 'north');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.fromRoom, 'test_room_1');
      assert.strictEqual(result.toRoom, 'test_room_2');
      assert.strictEqual(result.direction, 'north');
      assert.strictEqual(roomSystem.getPlayerRoom('player1'), 'test_room_2');
    });

    test('should move player with keyword', () => {
      const result = roomSystem.movePlayer('player1', 'n');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.toRoom, 'test_room_2');
    });

    test('should fail movement with invalid direction', () => {
      const result = roomSystem.movePlayer('player1', 'invalid');
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(roomSystem.getPlayerRoom('player1'), 'test_room_1');
    });

    test('should fail movement for non-existent player', () => {
      const result = roomSystem.movePlayer('non_existent', 'north');
      
      assert.strictEqual(result.success, false);
      assert.match(result.error, /not found/i);
    });

    test('should handle case-insensitive directions', () => {
      const result = roomSystem.movePlayer('player1', 'NORTH');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.toRoom, 'test_room_2');
    });
  });

  describe('room queries', () => {
    beforeEach(async () => {
      await roomSystem.loadRoomsFromJSON(testFilePath);
      roomSystem.addPlayer('player1');
      roomSystem.addPlayer('player2');
    });

    test('should get player room correctly', () => {
      const room = roomSystem.getPlayerRoom('player1');
      assert.strictEqual(room, 'test_room_1');
    });

    test('should return null for non-existent player', () => {
      const room = roomSystem.getPlayerRoom('non_existent');
      assert.strictEqual(room, null);
    });

    test('should get players in room', () => {
      const players = roomSystem.getPlayersInRoom('test_room_1');
      
      assert.strictEqual(players.length, 2);
      assert.strictEqual(players.includes('player1'), true);
      assert.strictEqual(players.includes('player2'), true);
    });

    test('should get empty array for room with no players', () => {
      const players = roomSystem.getPlayersInRoom('test_room_2');
      
      assert.strictEqual(players.length, 0);
    });

    test('should get room description', () => {
      const mockConnectedPlayers = new Map([
        ['player1', { name: 'TestPlayer1' }],
        ['player2', { name: 'TestPlayer2' }]
      ]);

      const description = roomSystem.getRoomDescription('test_room_1', 'player1', mockConnectedPlayers);
      
      assert.strictEqual(description.id, 'test_room_1');
      assert.strictEqual(description.name, 'Test Room 1');
      assert.strictEqual(description.playersPresent.length, 1);
      assert.strictEqual(description.playersPresent[0], 'TestPlayer2');
      assert.match(description.description, /TestPlayer2 is here/);
      assert.match(description.description, /Exits: north/);
    });

    test('should return null for non-existent room description', () => {
      const description = roomSystem.getRoomDescription('non_existent', 'player1');
      
      assert.strictEqual(description, null);
    });

    test('should get room commands', () => {
      const commands = roomSystem.getRoomCommands('test_room_1');
      
      assert.strictEqual(typeof commands, 'object');
      assert.strictEqual(commands.look, 'Look around the test room');
      assert.strictEqual(commands.test, 'A test command');
    });

    test('should return empty object for room with no commands', () => {
      const commands = roomSystem.getRoomCommands('test_room_2');
      
      assert.strictEqual(typeof commands, 'object');
      assert.strictEqual(Object.keys(commands).length, 0);
    });
  });

  describe('movement validation', () => {
    beforeEach(async () => {
      await roomSystem.loadRoomsFromJSON(testFilePath);
      roomSystem.addPlayer('player1');
    });

    test('should validate possible movement', () => {
      const canMove = roomSystem.canMove('player1', 'north');
      assert.strictEqual(canMove, true);
    });

    test('should invalidate impossible movement', () => {
      const canMove = roomSystem.canMove('player1', 'west');
      assert.strictEqual(canMove, false);
    });

    test('should validate movement with keywords', () => {
      const canMove = roomSystem.canMove('player1', 'n');
      assert.strictEqual(canMove, true);
    });

    test('should handle case-insensitive validation', () => {
      const canMove = roomSystem.canMove('player1', 'NORTH');
      assert.strictEqual(canMove, true);
    });

    test('should return false for non-existent player', () => {
      const canMove = roomSystem.canMove('non_existent', 'north');
      assert.strictEqual(canMove, false);
    });
  });

  describe('statistics', () => {
    beforeEach(async () => {
      await roomSystem.loadRoomsFromJSON(testFilePath);
      roomSystem.addPlayer('player1');
      roomSystem.addPlayer('player2');
      roomSystem.movePlayer('player2', 'north');
    });

    test('should provide accurate statistics', () => {
      const stats = roomSystem.getStats();
      
      assert.strictEqual(stats.totalRooms, 3);
      assert.strictEqual(stats.totalPlayers, 2);
      assert.strictEqual(stats.occupiedRooms, 2);
      assert.strictEqual(stats.isLoaded, true);
      assert.strictEqual(stats.defaultRoom, 'test_room_1');
      
      // Check player distribution
      assert.strictEqual(stats.playerDistribution['test_room_1'].length, 1);
      assert.strictEqual(stats.playerDistribution['test_room_2'].length, 1);
    });

    test('should handle empty system statistics', () => {
      const emptySystem = new RoomSystem();
      const stats = emptySystem.getStats();
      
      assert.strictEqual(stats.totalRooms, 0);
      assert.strictEqual(stats.totalPlayers, 0);
      assert.strictEqual(stats.occupiedRooms, 0);
      assert.strictEqual(stats.isLoaded, false);
    });
  });

  describe('_validateRoomStructure', () => {
    test('should validate correct room structure', () => {
      const validRoom = {
        id: 'test',
        name: 'Test Room',
        description: 'A test room',
        exits: {
          north: {
            destination: 'other_room',
            keywords: ['north'],
            description: 'Go north'
          }
        }
      };

      const result = roomSystem._validateRoomStructure(validRoom);
      assert.strictEqual(result, true);
    });

    test('should reject room missing required fields', () => {
      const invalidRoom = {
        id: 'test'
        // Missing name and description
      };

      const result = roomSystem._validateRoomStructure(invalidRoom);
      assert.strictEqual(result, false);
    });

    test('should reject room with invalid exits structure', () => {
      const invalidRoom = {
        id: 'test',
        name: 'Test Room',
        description: 'A test room',
        exits: {
          north: {
            destination: 'other_room'
            // Missing keywords and description
          }
        }
      };

      const result = roomSystem._validateRoomStructure(invalidRoom);
      assert.strictEqual(result, false);
    });

    test('should accept room without exits', () => {
      const validRoom = {
        id: 'test',
        name: 'Test Room',
        description: 'A test room'
      };

      const result = roomSystem._validateRoomStructure(validRoom);
      assert.strictEqual(result, true);
    });
  });
});
