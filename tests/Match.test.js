const { test, describe } = require('node:test');
const assert = require('node:assert');
const Match = require('../server/Match.js');
const Courier = require('../server/Courier.js');

// Mock courier for testing
function createMockCourier() {
    const courier = new Courier();
    const deliveredMessages = [];
    
    courier.setAddress = (id, deliveryFn) => {
        courier.addresses.set(id, (msg) => {
            deliveredMessages.push({ id, msg });
        });
    };
    
    courier.getDeliveredMessages = () => deliveredMessages;
    courier.clearMessages = () => deliveredMessages.length = 0;
    
    return courier;
}

describe('Match', () => {
    describe('constructor', () => {
        test('should create match with correct initial state', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            assert(typeof match.matchId === 'string');
            assert(match.matchId.length > 0);
            assert.strictEqual(match.state, Match.STATE.QUEUE);
            assert.strictEqual(match.players.size, 0);
            assert.strictEqual(match.minPlayers, 2);
            assert.strictEqual(match.maxPlayers, 5);
        });

        test('should initialize grace period properties', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            assert.strictEqual(match.gracePeriodDuration, 60 * 1000); // 60 seconds
            assert.strictEqual(match.gracePeriodTimerId, null);
            assert.strictEqual(match.gracePeriodStartTime, null);
        });

        test('should set up courier correctly', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            assert.strictEqual(match.outCourier, courier);
            assert(match.gameCourier instanceof Courier);
        });
    });

    describe('player management', () => {
        test('should create player successfully', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            const playerId = match.createPlayer('player123', 'TestPlayer');
            
            assert.strictEqual(playerId, 'player123');
            assert.strictEqual(match.players.size, 1);
            assert(match.players.has('player123'));
            
            const player = match.players.get('player123');
            assert.strictEqual(player.name, 'TestPlayer');
            assert.strictEqual(player.playerId, 'player123');
        });

        test('should reject player creation when match is full', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            // Fill match to capacity
            for (let i = 0; i < match.maxPlayers; i++) {
                match.createPlayer(`player${i}`, `Player${i}`);
            }
            
            // Try to add one more player
            const result = match.createPlayer('extra_player', 'ExtraPlayer');
            
            assert.strictEqual(result, null);
            assert.strictEqual(match.players.size, match.maxPlayers);
        });

        test('should not allow player creation when match is not in queue or countdown', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            // Force match into battle state
            match.state = Match.STATE.BATTLE;
            
            const result = match.createPlayer('player999', 'LatePlayer');
            
            assert.strictEqual(result, null);
        });
    });

    describe('command execution', () => {
        test('should execute valid game command', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            // Add player and set up match for commands
            match.createPlayer('player123', 'TestPlayer');
            match.state = Match.STATE.GRACE; // Allow commands
            
            const command = { type: 'CHAT', message: 'Hello world!' };
            const result = match.execGameComm('player123', command);
            
            assert.strictEqual(result, true);
        });

        test('should reject command from non-existent player', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            const command = { type: 'CHAT', message: 'Hello!' };
            const result = match.execGameComm('nonexistent_player', command);
            
            assert.strictEqual(result, false);
        });

        test('should reject commands when game is not ready', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            match.createPlayer('player123', 'TestPlayer');
            // Keep match in QUEUE state (game not started)
            
            const command = { type: 'CHAT', message: 'Hello!' };
            const result = match.execGameComm('player123', command);
            
            assert.strictEqual(result, false);
        });
    });

    describe('grace period management', () => {
        test('should get remaining grace time correctly', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            // Before grace period starts
            assert.strictEqual(match.getRemainingGraceTime(), 0);
            
            // Simulate grace period start
            match.state = Match.STATE.GRACE;
            match.gracePeriodStartTime = Date.now();
            
            const remaining = match.getRemainingGraceTime();
            assert(remaining > 0);
            assert(remaining <= match.gracePeriodDuration);
        });

        test('should return zero when not in grace period', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            match.state = Match.STATE.BATTLE;
            
            assert.strictEqual(match.getRemainingGraceTime(), 0);
        });

        test('should return zero for expired grace period', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            match.state = Match.STATE.GRACE;
            match.gracePeriodStartTime = Date.now() - (65 * 1000); // 65 seconds ago
            
            assert.strictEqual(match.getRemainingGraceTime(), 0);
        });
    });

    describe('utility methods', () => {
        test('should check if players can join correctly', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            // Initially in QUEUE state, should allow joining
            assert.strictEqual(match.playersCanJoin(), true);
            
            // Fill to capacity
            for (let i = 0; i < match.maxPlayers; i++) {
                match.createPlayer(`player${i}`, `Player${i}`);
            }
            
            // Should not allow more players
            assert.strictEqual(match.playersCanJoin(), false);
        });

        test('should check command execution capability', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            // QUEUE state should not allow commands
            assert.strictEqual(match.canExecuteCommands(), false);
            
            // GRACE state should allow commands
            match.state = Match.STATE.GRACE;
            assert.strictEqual(match.canExecuteCommands(), true);
            
            // BATTLE state should allow commands
            match.state = Match.STATE.BATTLE;
            assert.strictEqual(match.canExecuteCommands(), true);
        });

        test('should get match info correctly', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            match.createPlayer('player1', 'Player1');
            match.createPlayer('player2', 'Player2');
            
            const info = match.getMatchInfo();
            
            assert.strictEqual(info.matchId, match.matchId);
            assert.strictEqual(info.state, match.state);
            assert.strictEqual(info.playerCount, 2);
            assert.strictEqual(info.maxPlayers, match.maxPlayers);
            assert.strictEqual(info.gracePeriodActive, false);
        });

        test('should count total players correctly', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            assert.strictEqual(match.totalPlayers(), 0);
            
            match.createPlayer('player1', 'Player1');
            assert.strictEqual(match.totalPlayers(), 1);
            
            match.createPlayer('player2', 'Player2');
            assert.strictEqual(match.totalPlayers(), 2);
        });
    });

    describe('cleanup', () => {
        test('should clean up resources properly', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            match.createPlayer('player1', 'Player1');
            match.countdownTimerId = setTimeout(() => {}, 1000);
            match.gracePeriodTimerId = setTimeout(() => {}, 1000);
            
            match.clean();
            
            assert.strictEqual(match.players.size, 0);
            assert.strictEqual(match.pieceToPlayer.size, 0);
            assert.strictEqual(match.countdownTimerId, null);
            assert.strictEqual(match.gracePeriodTimerId, null);
        });
    });

    describe('state transitions', () => {
        test('should transition from QUEUE to COUNTDOWN when enough players join', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            assert.strictEqual(match.state, Match.STATE.QUEUE);
            
            // Add minimum number of players
            match.createPlayer('player1', 'Player1');
            match.createPlayer('player2', 'Player2');
            
            assert.strictEqual(match.state, Match.STATE.COUNTDOWN);
            assert(match.countdownTimerId !== null);
        });

        test('should transition back to QUEUE if players leave during countdown', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            // Add players to trigger countdown
            match.createPlayer('player1', 'Player1');
            match.createPlayer('player2', 'Player2');
            
            assert.strictEqual(match.state, Match.STATE.COUNTDOWN);
            
            // Remove a player
            match.removePlayer('player1');
            
            assert.strictEqual(match.state, Match.STATE.QUEUE);
            assert.strictEqual(match.countdownTimerId, null);
        });
    });

    describe('error handling', () => {
        test('should handle invalid command gracefully', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            match.createPlayer('player123', 'TestPlayer');
            match.state = Match.STATE.GRACE;
            
            const invalidCommand = { type: 'INVALID_COMMAND' };
            
            // Should not throw error
            assert.doesNotThrow(() => {
                match.execGameComm('player123', invalidCommand);
            });
        });

        test('should handle missing game engine gracefully', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            match.createPlayer('player123', 'TestPlayer');
            // Don't start match (no game engine)
            
            const command = { type: 'CHAT', message: 'Hello!' };
            const result = match.execGameComm('player123', command);
            
            assert.strictEqual(result, false);
        });
    });
});