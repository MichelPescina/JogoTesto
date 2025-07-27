const { test, describe } = require('node:test');
const assert = require('node:assert');
const GameMsg = require('../server/game/GameMsg.js');

describe('GameMsg', () => {
    describe('constructor', () => {
        test('should create game message with correct properties', () => {
            const msg = new GameMsg('player123', GameMsg.ACTION.SHOW, { test: 'data' });
            
            assert.strictEqual(msg.id, 'player123');
            assert.strictEqual(msg.action, GameMsg.ACTION.SHOW);
            assert.deepStrictEqual(msg.content, { test: 'data' });
        });

        test('should create message with different action types', () => {
            const updateMsg = new GameMsg('player456', GameMsg.ACTION.UPDATE, {});
            const replyMsg = new GameMsg('player789', GameMsg.ACTION.REPLY, {});
            
            assert.strictEqual(updateMsg.action, GameMsg.ACTION.UPDATE);
            assert.strictEqual(replyMsg.action, GameMsg.ACTION.REPLY);
        });

        test('should handle null content', () => {
            const msg = new GameMsg('player000', GameMsg.ACTION.SHOW, null);
            assert.strictEqual(msg.content, null);
        });
    });

    describe('factory methods', () => {
        test('should create game state message', () => {
            const gameState = { health: 100, weapon: 'sword' };
            const msg = GameMsg.createGameState('player123', gameState);
            
            assert.strictEqual(msg.id, 'player123');
            assert.strictEqual(msg.action, GameMsg.ACTION.UPDATE);
            assert.strictEqual(msg.content.type, GameMsg.TYPE.GAME_STATE);
            assert.deepStrictEqual(msg.content.data, gameState);
            assert(typeof msg.content.timestamp === 'number');
        });

        test('should create room update message', () => {
            const roomData = { name: 'Forest', players: ['Alice', 'Bob'] };
            const msg = GameMsg.createRoomUpdate('player456', roomData);
            
            assert.strictEqual(msg.id, 'player456');
            assert.strictEqual(msg.action, GameMsg.ACTION.UPDATE);
            assert.strictEqual(msg.content.type, GameMsg.TYPE.ROOM_UPDATE);
            assert.deepStrictEqual(msg.content.data, roomData);
        });

        test('should create battle start message', () => {
            const battleData = { battleId: 'battle123', attacker: 'Alice' };
            const msg = GameMsg.createBattleStart('player789', battleData);
            
            assert.strictEqual(msg.id, 'player789');
            assert.strictEqual(msg.action, GameMsg.ACTION.REPLY);
            assert.strictEqual(msg.content.type, GameMsg.TYPE.BATTLE_START);
            assert.deepStrictEqual(msg.content.data, battleData);
        });

        test('should create battle end message', () => {
            const battleResult = { winner: 'Alice', losers: ['Bob'] };
            const msg = GameMsg.createBattleEnd('player111', battleResult);
            
            assert.strictEqual(msg.id, 'player111');
            assert.strictEqual(msg.action, GameMsg.ACTION.SHOW);
            assert.strictEqual(msg.content.type, GameMsg.TYPE.BATTLE_END);
            assert.deepStrictEqual(msg.content.data, battleResult);
        });

        test('should create chat message', () => {
            const chatData = { playerName: 'Alice', message: 'Hello!' };
            const msg = GameMsg.createChatMessage('player222', chatData);
            
            assert.strictEqual(msg.id, 'player222');
            assert.strictEqual(msg.action, GameMsg.ACTION.SHOW);
            assert.strictEqual(msg.content.type, GameMsg.TYPE.CHAT_MSG);
            assert.deepStrictEqual(msg.content.data, chatData);
        });

        test('should create error message', () => {
            const msg = GameMsg.createError('player333', 'Something went wrong', 'ERR_001');
            
            assert.strictEqual(msg.id, 'player333');
            assert.strictEqual(msg.action, GameMsg.ACTION.SHOW);
            assert.strictEqual(msg.content.type, GameMsg.TYPE.ERROR);
            assert.strictEqual(msg.content.data.message, 'Something went wrong');
            assert.strictEqual(msg.content.data.code, 'ERR_001');
        });

        test('should create error message without code', () => {
            const msg = GameMsg.createError('player444', 'Error without code');
            
            assert.strictEqual(msg.content.data.message, 'Error without code');
            assert.strictEqual(msg.content.data.code, null);
        });

        test('should create player join message', () => {
            const playerData = { playerName: 'NewPlayer' };
            const msg = GameMsg.createPlayerJoin('player555', playerData);
            
            assert.strictEqual(msg.content.type, GameMsg.TYPE.PLAYER_JOIN);
            assert.deepStrictEqual(msg.content.data, playerData);
        });

        test('should create player leave message', () => {
            const playerData = { playerName: 'LeavingPlayer' };
            const msg = GameMsg.createPlayerLeave('player666', playerData);
            
            assert.strictEqual(msg.content.type, GameMsg.TYPE.PLAYER_LEAVE);
            assert.deepStrictEqual(msg.content.data, playerData);
        });

        test('should create search start message', () => {
            const searchData = { playerName: 'Alice', isVulnerable: true };
            const msg = GameMsg.createSearchStart('player777', searchData);
            
            assert.strictEqual(msg.content.type, GameMsg.TYPE.SEARCH_START);
            assert.deepStrictEqual(msg.content.data, searchData);
        });

        test('should create search end message', () => {
            const searchResult = { playerName: 'Alice', weaponFound: true, weapon: 'sword' };
            const msg = GameMsg.createSearchEnd('player888', searchResult);
            
            assert.strictEqual(msg.content.type, GameMsg.TYPE.SEARCH_END);
            assert.deepStrictEqual(msg.content.data, searchResult);
        });

        test('should create grace period message', () => {
            const graceData = { active: true, timeRemaining: 30000 };
            const msg = GameMsg.createGracePeriod('player999', graceData);
            
            assert.strictEqual(msg.content.type, GameMsg.TYPE.GRACE_PERIOD);
            assert.deepStrictEqual(msg.content.data, graceData);
        });
    });

    describe('validation', () => {
        test('should validate correct message structure', () => {
            const validMsg = {
                id: 'player123',
                action: GameMsg.ACTION.SHOW,
                content: { test: 'data' }
            };
            
            assert.strictEqual(GameMsg.isValid(validMsg), true);
        });

        test('should reject message without id', () => {
            const invalidMsg = {
                action: GameMsg.ACTION.SHOW,
                content: { test: 'data' }
            };
            
            assert.strictEqual(GameMsg.isValid(invalidMsg), false);
        });

        test('should reject message without action', () => {
            const invalidMsg = {
                id: 'player123',
                content: { test: 'data' }
            };
            
            assert.strictEqual(GameMsg.isValid(invalidMsg), false);
        });

        test('should reject message with invalid action', () => {
            const invalidMsg = {
                id: 'player123',
                action: 'INVALID_ACTION',
                content: { test: 'data' }
            };
            
            assert.strictEqual(GameMsg.isValid(invalidMsg), false);
        });

        test('should reject non-object message', () => {
            assert.strictEqual(GameMsg.isValid(null), false);
            assert.strictEqual(GameMsg.isValid('string'), false);
            assert.strictEqual(GameMsg.isValid(123), false);
        });

        test('should accept message with undefined content', () => {
            const validMsg = {
                id: 'player123',
                action: GameMsg.ACTION.SHOW,
                content: undefined
            };
            
            assert.strictEqual(GameMsg.isValid(validMsg), true);
        });
    });

    describe('constants', () => {
        test('should have all required action types', () => {
            assert.strictEqual(GameMsg.ACTION.SHOW, 'SHOW');
            assert.strictEqual(GameMsg.ACTION.UPDATE, 'UPDATE');
            assert.strictEqual(GameMsg.ACTION.REPLY, 'REPLY');
            assert.strictEqual(GameMsg.ACTION.AWAIT, 'AWAIT');
            assert.strictEqual(GameMsg.ACTION.RESUME, 'RESUME');
        });

        test('should have all required message types', () => {
            assert.strictEqual(GameMsg.TYPE.GAME_STATE, 'GAME_STATE');
            assert.strictEqual(GameMsg.TYPE.ROOM_UPDATE, 'ROOM_UPDATE');
            assert.strictEqual(GameMsg.TYPE.BATTLE_START, 'BATTLE_START');
            assert.strictEqual(GameMsg.TYPE.BATTLE_END, 'BATTLE_END');
            assert.strictEqual(GameMsg.TYPE.CHAT_MSG, 'CHAT_MSG');
            assert.strictEqual(GameMsg.TYPE.ERROR, 'ERROR');
            assert.strictEqual(GameMsg.TYPE.PLAYER_JOIN, 'PLAYER_JOIN');
            assert.strictEqual(GameMsg.TYPE.PLAYER_LEAVE, 'PLAYER_LEAVE');
            assert.strictEqual(GameMsg.TYPE.SEARCH_START, 'SEARCH_START');
            assert.strictEqual(GameMsg.TYPE.SEARCH_END, 'SEARCH_END');
            assert.strictEqual(GameMsg.TYPE.GRACE_PERIOD, 'GRACE_PERIOD');
        });

        test('should have legacy build functions', () => {
            assert(typeof GameMsg.BUILD.invalidMove === 'function');
            assert(typeof GameMsg.BUILD.invalidDir === 'function');
            assert(typeof GameMsg.BUILD.otherExit === 'function');
            assert(typeof GameMsg.BUILD.otherEnter === 'function');
        });
    });

    describe('timestamp handling', () => {
        test('should include timestamp in factory methods', () => {
            const before = Date.now();
            const msg = GameMsg.createGameState('player123', {});
            const after = Date.now();
            
            assert(msg.content.timestamp >= before);
            assert(msg.content.timestamp <= after);
        });

        test('should have different timestamps for different messages', (t, done) => {
            const msg1 = GameMsg.createGameState('player123', {});
            
            setTimeout(() => {
                const msg2 = GameMsg.createGameState('player123', {});
                assert(msg2.content.timestamp > msg1.content.timestamp);
                done();
            }, 10);
        });
    });
});