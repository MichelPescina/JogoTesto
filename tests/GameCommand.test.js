const { test, describe } = require('node:test');
const assert = require('node:assert');
const GameCommand = require('../server/game/GameCommand.js');

describe('GameCommand', () => {
    describe('validate', () => {
        test('should validate MOVE command successfully', (t, done) => {
            const command = { type: 'MOVE', direction: 'north' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert.strictEqual(error, null);
                assert.strictEqual(validatedCommand.type, 'MOVE');
                assert.strictEqual(validatedCommand.direction, 'north');
                done();
            });
        });

        test('should validate SEARCH command successfully', (t, done) => {
            const command = { type: 'SEARCH' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert.strictEqual(error, null);
                assert.strictEqual(validatedCommand.type, 'SEARCH');
                done();
            });
        });

        test('should validate ATTACK command successfully', (t, done) => {
            const command = { type: 'ATTACK', targetId: 'player123' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert.strictEqual(error, null);
                assert.strictEqual(validatedCommand.type, 'ATTACK');
                assert.strictEqual(validatedCommand.targetId, 'player123');
                done();
            });
        });

        test('should validate RESPOND command successfully', (t, done) => {
            const command = { type: 'RESPOND', battleId: 'battle123', decision: 'ATTACK' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert.strictEqual(error, null);
                assert.strictEqual(validatedCommand.type, 'RESPOND');
                assert.strictEqual(validatedCommand.battleId, 'battle123');
                assert.strictEqual(validatedCommand.decision, 'ATTACK');
                done();
            });
        });

        test('should validate CHAT command successfully', (t, done) => {
            const command = { type: 'CHAT', message: 'Hello world!' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert.strictEqual(error, null);
                assert.strictEqual(validatedCommand.type, 'CHAT');
                assert.strictEqual(validatedCommand.message, 'Hello world!');
                done();
            });
        });

        test('should reject invalid direction in MOVE command', (t, done) => {
            const command = { type: 'MOVE', direction: 'invalid_direction' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Invalid direction'));
                assert.strictEqual(validatedCommand, undefined);
                done();
            });
        });

        test('should reject missing direction in MOVE command', (t, done) => {
            const command = { type: 'MOVE' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Move command requires a direction'));
                done();
            });
        });

        test('should reject missing targetId in ATTACK command', (t, done) => {
            const command = { type: 'ATTACK' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Attack command requires a targetId'));
                done();
            });
        });

        test('should reject empty targetId in ATTACK command', (t, done) => {
            const command = { type: 'ATTACK', targetId: '' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Attack targetId cannot be empty'));
                done();
            });
        });

        test('should reject invalid decision in RESPOND command', (t, done) => {
            const command = { type: 'RESPOND', battleId: 'battle123', decision: 'INVALID' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Invalid decision'));
                done();
            });
        });

        test('should reject empty message in CHAT command', (t, done) => {
            const command = { type: 'CHAT', message: '   ' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Chat message cannot be empty'));
                done();
            });
        });

        test('should reject message too long in CHAT command', (t, done) => {
            const longMessage = 'a'.repeat(501);
            const command = { type: 'CHAT', message: longMessage };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Chat message too long'));
                done();
            });
        });

        test('should reject command without type', (t, done) => {
            const command = { direction: 'north' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Command type is required'));
                done();
            });
        });

        test('should reject null command', (t, done) => {
            GameCommand.validate(null, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Command must be an object'));
                done();
            });
        });

        test('should reject unknown command type', (t, done) => {
            const command = { type: 'UNKNOWN_COMMAND' };
            
            GameCommand.validate(command, (error, validatedCommand) => {
                assert(error instanceof Error);
                assert(error.message.includes('Unknown command type'));
                done();
            });
        });
    });

    describe('parseInput', () => {
        test('should parse JSON command successfully', (t, done) => {
            const input = '{"type": "MOVE", "direction": "north"}';
            
            GameCommand.parseInput(input, (error, command) => {
                assert.strictEqual(error, null);
                assert.strictEqual(command.type, 'MOVE');
                assert.strictEqual(command.direction, 'north');
                done();
            });
        });

        test('should parse text movement command', (t, done) => {
            const input = 'north';
            
            GameCommand.parseInput(input, (error, command) => {
                assert.strictEqual(error, null);
                assert.strictEqual(command.type, 'MOVE');
                assert.strictEqual(command.direction, 'north');
                done();
            });
        });

        test('should parse shorthand movement command', (t, done) => {
            const input = 'n';
            
            GameCommand.parseInput(input, (error, command) => {
                assert.strictEqual(error, null);
                assert.strictEqual(command.type, 'MOVE');
                assert.strictEqual(command.direction, 'north');
                done();
            });
        });

        test('should parse search command', (t, done) => {
            const input = 'search';
            
            GameCommand.parseInput(input, (error, command) => {
                assert.strictEqual(error, null);
                assert.strictEqual(command.type, 'SEARCH');
                done();
            });
        });

        test('should parse chat message', (t, done) => {
            const input = 'Hello everyone!';
            
            GameCommand.parseInput(input, (error, command) => {
                assert.strictEqual(error, null);
                assert.strictEqual(command.type, 'CHAT');
                assert.strictEqual(command.message, 'Hello everyone!');
                done();
            });
        });

        test('should reject empty input', (t, done) => {
            GameCommand.parseInput('', (error, command) => {
                assert(error instanceof Error);
                assert(error.message.includes('Input cannot be empty'));
                done();
            });
        });

        test('should reject null input', (t, done) => {
            GameCommand.parseInput(null, (error, command) => {
                assert(error instanceof Error);
                assert(error.message.includes('Input must be a non-empty string'));
                done();
            });
        });
    });

    describe('constants', () => {
        test('should provide valid directions', () => {
            const directions = GameCommand.getValidDirections();
            assert(Array.isArray(directions));
            assert(directions.includes('north'));
            assert(directions.includes('south'));
            assert(directions.includes('east'));
            assert(directions.includes('west'));
        });

        test('should provide valid decisions', () => {
            const decisions = GameCommand.getValidDecisions();
            assert(Array.isArray(decisions));
            assert(decisions.includes('ATTACK'));
            assert(decisions.includes('ESCAPE'));
        });

        test('should provide command types', () => {
            const types = GameCommand.getCommandTypes();
            assert(typeof types === 'object');
            assert(types.MOVE === 'MOVE');
            assert(types.SEARCH === 'SEARCH');
            assert(types.ATTACK === 'ATTACK');
            assert(types.RESPOND === 'RESPOND');
            assert(types.CHAT === 'CHAT');
        });
    });
});