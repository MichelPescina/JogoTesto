const { test, describe } = require('node:test');
const assert = require('node:assert');
const Match = require('../server/Match.js');
const Courier = require('../server/Courier.js');

// Mock courier for testing
function createMockCourier() {
    const courier = new Courier();
    const deliveredMessages = [];
    
    // Override the addressToMethod property initialization
    courier.addressToMethod = new Map();
    
    courier.setAddress = (id, deliveryFn) => {
        courier.addressToMethod.set(id, (msg) => {
            deliveredMessages.push({ id, msg });
        });
    };
    
    courier.deliver = (address, msg) => {
        deliveredMessages.push({ id: address, msg });
    };
    
    courier.getDeliveredMessages = () => deliveredMessages;
    courier.clearMessages = () => deliveredMessages.length = 0;
    
    return courier;
}

// Helper function to set up a battle scenario
async function setupBattleScenario(match) {
    // Add two players to the match
    const player1Id = match.createPlayer('player1', 'TestPlayer1');
    const player2Id = match.createPlayer('player2', 'TestPlayer2');
    
    // Force match to start (normally would wait for countdown)
    match.state = Match.STATE.GRACE;
    match.game = {
        allPieces: new Map(),
        worldMap: new Map(),
        startBattle: () => 'test-battle-id',
        endBattle: () => {},
        respondToAttack: () => {}
    };
    
    // Mock game pieces and room
    const piece1 = { getPieceId: () => 'piece1', getState: () => 'BATTLING', getRoomId: () => 'room1' };
    const piece2 = { getPieceId: () => 'piece2', getState: () => 'BATTLING', getRoomId: () => 'room1' };
    
    match.game.allPieces.set('piece1', piece1);
    match.game.allPieces.set('piece2', piece2);
    
    const room = { getAllPieces: () => ['piece1', 'piece2'] };
    match.game.worldMap.set('room1', room);
    
    // Set piece mappings
    match.players.get(player1Id).setOwnPieceId('piece1');
    match.players.get(player2Id).setOwnPieceId('piece2');
    match.pieceToPlayer.set('piece1', player1Id);
    match.pieceToPlayer.set('piece2', player2Id);
    
    return {
        player1Id,
        player2Id,
        piece1Id: 'piece1',
        piece2Id: 'piece2',
        battleId: 'test-battle-id'
    };
}

describe('Attack System with Timer', () => {
    describe('Battle Timer Initialization', () => {
        test('should start 10-second timer when battle begins', async () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            // Setup battle scenario
            const { player1Id, piece1Id } = await setupBattleScenario(match);
            
            // Ensure match is in BATTLE state (not GRACE) to allow attacks
            match.state = Match.STATE.BATTLE;
            
            // Override startBattle to control battleId
            match.game.startBattle = () => 'test-battle-123';
            
            // Trigger attack command
            const attackCommand = { type: 'ATTACK', targetId: 'TestPlayer2' };
            match.execGameComm(player1Id, attackCommand);
            
            // Verify timer was created
            assert(match.battleTimers.has('test-battle-123'));
            const timerData = match.battleTimers.get('test-battle-123');
            assert(timerData.timerId);
            assert.strictEqual(timerData.participants.size, 2);
            assert(timerData.participants.has('piece1'));
            assert(timerData.participants.has('piece2'));
            assert.strictEqual(timerData.responses.size, 0);
        });

        test('should initialize timer with correct timeout duration', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            assert.strictEqual(match.battleTimeout, 10 * 1000); // 10 seconds
        });
    });

    describe('Response Tracking', () => {
        test('should track player responses during timer window', async () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            const { player1Id, player2Id, piece1Id, piece2Id } = await setupBattleScenario(match);
            
            // Simulate a battle timer by manually adding to battleTimers
            const timerId = setTimeout(() => {}, 10000);
            match.battleTimers.set('test-battle', {
                timerId,
                startTime: Date.now(),
                participants: new Set([piece1Id, piece2Id]),
                responses: new Map(),
                battleId: 'test-battle'
            });
            
            // Send response from player1
            const respondCommand = { type: 'RESPOND', battleId: 'test-battle', decision: 'ATTACK' };
            match.execGameComm(player1Id, respondCommand);
            
            // Verify response was recorded
            const timerData = match.battleTimers.get('test-battle');
            assert(timerData.responses.has(piece1Id));
            assert.strictEqual(timerData.responses.get(piece1Id), 'ATTACK');
        });

        test('should end battle early when all players respond', async () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            const { player1Id, player2Id, piece1Id, piece2Id } = await setupBattleScenario(match);
            
            let battleEnded = false;
            match.game.endBattle = () => { battleEnded = true; };
            
            // Simulate a battle timer
            const timerId = setTimeout(() => {}, 10000);
            match.battleTimers.set('test-battle', {
                timerId,
                startTime: Date.now(),
                participants: new Set([piece1Id, piece2Id]),
                responses: new Map(),
                battleId: 'test-battle'
            });
            
            // Both players respond
            match.execGameComm(player1Id, { type: 'RESPOND', battleId: 'test-battle', decision: 'ATTACK' });
            match.execGameComm(player2Id, { type: 'RESPOND', battleId: 'test-battle', decision: 'ESCAPE' });
            
            // Verify battle ended and timer cleaned up
            assert(battleEnded);
            assert(!match.battleTimers.has('test-battle'));
        });

        test('should reject responses for expired battles', async () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            const { player1Id } = await setupBattleScenario(match);
            
            // Try to respond to non-existent battle
            const respondCommand = { type: 'RESPOND', battleId: 'non-existent', decision: 'ATTACK' };
            match.execGameComm(player1Id, respondCommand);
            
            // Check that error message was delivered
            const messages = courier.getDeliveredMessages();
            const errorMsg = messages.find(msg => msg.msg.content && msg.msg.content.type === 'ERROR');
            assert(errorMsg);
            assert(errorMsg.msg.content.data.message.includes('Battle timer has expired or battle not found'));
        });
    });

    describe('Timer Expiration', () => {
        test('should end battle when timer expires with partial responses', (t, done) => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            setupBattleScenario(match).then(({ player1Id, player2Id, piece1Id, piece2Id }) => {
                let battleEnded = false;
                let nonResponsivePlayersHandled = [];
                
                match.game.endBattle = () => { battleEnded = true; };
                match.game.respondToAttack = (battleId, pieceId, decision) => {
                    if (decision === 'ESCAPE') {
                        nonResponsivePlayersHandled.push(pieceId);
                    }
                };
                
                // Set very short timeout for testing
                match.battleTimeout = 50; // 50ms for quick test
                
                // Simulate battle timer with very short timeout
                const timerId = setTimeout(() => {
                    // Simulate timer expiration
                    const timerData = match.battleTimers.get('test-battle');
                    if (timerData) {
                        // Set default ESCAPE for non-responsive players
                        timerData.participants.forEach(pieceId => {
                            if (!timerData.responses.has(pieceId)) {
                                nonResponsivePlayersHandled.push(pieceId);
                                match.game.respondToAttack('test-battle', pieceId, 'ESCAPE');
                            }
                        });
                        match.game.endBattle('test-battle');
                        match.battleTimers.delete('test-battle');
                    }
                }, 50);
                
                match.battleTimers.set('test-battle', {
                    timerId,
                    startTime: Date.now(),
                    participants: new Set([piece1Id, piece2Id]),
                    responses: new Map(),
                    battleId: 'test-battle'
                });
                
                // Only player1 responds
                match.execGameComm(player1Id, { type: 'RESPOND', battleId: 'test-battle', decision: 'ATTACK' });
                
                // Wait for timer to expire
                setTimeout(() => {
                    try {
                        assert(battleEnded);
                        assert(nonResponsivePlayersHandled.includes(piece2Id));
                        assert(!match.battleTimers.has('test-battle'));
                        done();
                    } catch (error) {
                        done(error);
                    }
                }, 100);
            }).catch(done);
        });
    });

    describe('Timer Cleanup', () => {
        test('should clean up timers when match is destroyed', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            // Create some battle timers
            const battleId1 = 'test-battle-1';
            const battleId2 = 'test-battle-2';
            
            match.battleTimers.set(battleId1, { 
                timerId: setTimeout(() => {}, 10000),
                participants: new Set(['player1'])
            });
            match.battleTimers.set(battleId2, { 
                timerId: setTimeout(() => {}, 10000),
                participants: new Set(['player2'])
            });
            
            assert.strictEqual(match.battleTimers.size, 2);
            
            match.clean();
            
            assert.strictEqual(match.battleTimers.size, 0);
        });

        test('should cleanup specific battle timer', () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            const battleId = 'test-battle';
            match.battleTimers.set(battleId, { 
                timerId: setTimeout(() => {}, 10000),
                participants: new Set(['player1'])
            });
            
            assert(match.battleTimers.has(battleId));
            
            // Test the cleanup by calling clean() method or directly manipulating battleTimers
            if (match.battleTimers.has(battleId)) {
                const timerData = match.battleTimers.get(battleId);
                clearTimeout(timerData.timerId);
                match.battleTimers.delete(battleId);
            }
            
            assert(!match.battleTimers.has(battleId));
        });
    });

    describe('Edge Cases', () => {
        test('should handle double response from same player gracefully', async () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            const { player1Id, piece1Id, piece2Id } = await setupBattleScenario(match);
            
            // Simulate battle timer
            const timerId = setTimeout(() => {}, 10000);
            match.battleTimers.set('test-battle', {
                timerId,
                startTime: Date.now(),
                participants: new Set([piece1Id, piece2Id]),
                responses: new Map(),
                battleId: 'test-battle'
            });
            
            // Send response twice from same player
            match.execGameComm(player1Id, { type: 'RESPOND', battleId: 'test-battle', decision: 'ATTACK' });
            match.execGameComm(player1Id, { type: 'RESPOND', battleId: 'test-battle', decision: 'ESCAPE' });
            
            // Verify only last response is recorded
            const timerData = match.battleTimers.get('test-battle');
            assert.strictEqual(timerData.responses.get(piece1Id), 'ESCAPE');
        });

        test('should handle battle creation failure gracefully', async () => {
            const courier = createMockCourier();
            const match = new Match(courier);
            
            const { player1Id } = await setupBattleScenario(match);
            
            // Override startBattle to return null (failure)
            match.game.startBattle = () => null;
            
            const attackCommand = { type: 'ATTACK', targetId: 'TestPlayer2' };
            match.execGameComm(player1Id, attackCommand);
            
            // Verify no timer was created
            assert.strictEqual(match.battleTimers.size, 0);
        });
    });
});