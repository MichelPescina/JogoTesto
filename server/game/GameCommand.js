/**
 * Game command validation and processing system
 * Handles all player input commands with proper validation and error handling
 */
class GameCommand {
    static TYPE = {
        MOVE: "MOVE",
        SEARCH: "SEARCH",
        ATTACK: "ATTACK",
        RES_ATTACK: "RES_ATTACK",    // Legacy - preserved for compatibility
        RES_ESCAPE: "RES_ESCAPE",    // Legacy - preserved for compatibility
        RESPOND: "RESPOND",          // New unified response command
        CHAT: "CHAT"                 // New chat command
    }

    /**
     * Valid movement directions
     */
    static DIRECTIONS = ['north', 'south', 'east', 'west'];

    /**
     * Valid battle response decisions
     */
    static DECISIONS = ['ATTACK', 'ESCAPE'];

    constructor (type, pieceId, target) {
        this.type = type;
        this.pieceId = pieceId;
        this.target = target;
    }

    /**
     * Validates a game command structure and parameters
     * @param {Object} command - Command object to validate
     * @param {Function} callback - Error-first callback (err, validatedCommand)
     */
    static validate(command, callback) {
        // Input validation
        if (!command || typeof command !== 'object') {
            return callback(new Error('Command must be an object'));
        }

        if (!command.type || typeof command.type !== 'string') {
            return callback(new Error('Command type is required and must be a string'));
        }

        const type = command.type.toUpperCase();
        
        try {
            let validatedCommand;

            switch (type) {
                case GameCommand.TYPE.MOVE:
                    validatedCommand = GameCommand.#validateMoveCommand(command);
                    break;
                
                case GameCommand.TYPE.SEARCH:
                    validatedCommand = GameCommand.#validateSearchCommand(command);
                    break;
                
                case GameCommand.TYPE.ATTACK:
                    validatedCommand = GameCommand.#validateAttackCommand(command);
                    break;
                
                case GameCommand.TYPE.RESPOND:
                    validatedCommand = GameCommand.#validateRespondCommand(command);
                    break;
                
                case GameCommand.TYPE.CHAT:
                    validatedCommand = GameCommand.#validateChatCommand(command);
                    break;
                
                default:
                    throw new Error(`Unknown command type: ${command.type}`);
            }

            // Success - return validated command
            callback(null, validatedCommand);

        } catch (error) {
            // Validation failed
            callback(error);
        }
    }

    /**
     * Validates MOVE command
     * @param {Object} command - Move command object
     * @returns {Object} - Validated command
     * @private
     */
    static #validateMoveCommand(command) {
        if (!command.direction || typeof command.direction !== 'string') {
            throw new Error('Move command requires a direction');
        }

        const direction = command.direction.toLowerCase();
        if (!GameCommand.DIRECTIONS.includes(direction)) {
            throw new Error(`Invalid direction: ${command.direction}. Must be: ${GameCommand.DIRECTIONS.join(', ')}`);
        }

        return {
            type: GameCommand.TYPE.MOVE,
            direction: direction
        };
    }

    /**
     * Validates SEARCH command
     * @param {Object} command - Search command object
     * @returns {Object} - Validated command
     * @private
     */
    static #validateSearchCommand(command) {
        // Search command has no additional parameters
        return {
            type: GameCommand.TYPE.SEARCH
        };
    }

    /**
     * Validates ATTACK command
     * @param {Object} command - Attack command object
     * @returns {Object} - Validated command
     * @private
     */
    static #validateAttackCommand(command) {
        if (!command.targetId || typeof command.targetId !== 'string') {
            throw new Error('Attack command requires a targetId');
        }

        if (command.targetId.trim().length === 0) {
            throw new Error('Attack targetId cannot be empty');
        }

        return {
            type: GameCommand.TYPE.ATTACK,
            targetId: command.targetId.trim()
        };
    }

    /**
     * Validates RESPOND command (for battle responses)
     * @param {Object} command - Respond command object
     * @returns {Object} - Validated command
     * @private
     */
    static #validateRespondCommand(command) {
        if (!command.battleId || typeof command.battleId !== 'string') {
            throw new Error('Respond command requires a battleId');
        }

        if (!command.decision || typeof command.decision !== 'string') {
            throw new Error('Respond command requires a decision');
        }

        const decision = command.decision.toUpperCase();
        if (!GameCommand.DECISIONS.includes(decision)) {
            throw new Error(`Invalid decision: ${command.decision}. Must be: ${GameCommand.DECISIONS.join(', ')}`);
        }

        return {
            type: GameCommand.TYPE.RESPOND,
            battleId: command.battleId.trim(),
            decision: decision
        };
    }

    /**
     * Validates CHAT command
     * @param {Object} command - Chat command object
     * @returns {Object} - Validated command
     * @private
     */
    static #validateChatCommand(command) {
        if (!command.message || typeof command.message !== 'string') {
            throw new Error('Chat command requires a message');
        }

        const message = command.message.trim();
        if (message.length === 0) {
            throw new Error('Chat message cannot be empty');
        }

        if (message.length > 500) {
            throw new Error('Chat message too long (max 500 characters)');
        }

        return {
            type: GameCommand.TYPE.CHAT,
            message: message
        };
    }

    /**
     * Parses raw input into a command object
     * @param {string} input - Raw input string
     * @param {Function} callback - Error-first callback (err, command)
     */
    static parseInput(input, callback) {
        if (!input || typeof input !== 'string') {
            return callback(new Error('Input must be a non-empty string'));
        }

        const trimmed = input.trim();
        if (trimmed.length === 0) {
            return callback(new Error('Input cannot be empty'));
        }

        try {
            // Try to parse as JSON first (for structured commands)
            const command = JSON.parse(trimmed);
            callback(null, command);
        } catch (jsonError) {
            // If not JSON, try to parse as simple text command
            GameCommand.#parseTextCommand(trimmed, callback);
        }
    }

    /**
     * Parses simple text commands (like 'north', 'search', etc.)
     * @param {string} input - Text input
     * @param {Function} callback - Error-first callback
     * @private
     */
    static #parseTextCommand(input, callback) {
        const parts = input.toLowerCase().split(/\s+/);
        const firstWord = parts[0];

        try {
            let command;

            // Movement shortcuts
            if (['north', 'south', 'east', 'west', 'n', 's', 'e', 'w'].includes(firstWord)) {
                const directionMap = { 'n': 'north', 's': 'south', 'e': 'east', 'w': 'west' };
                const direction = directionMap[firstWord] || firstWord;
                command = { type: 'MOVE', direction: direction };
            }
            // Search command
            else if (firstWord === 'search') {
                command = { type: 'SEARCH' };
            }
            // Chat command (everything else treated as chat)
            else {
                command = { type: 'CHAT', message: input };
            }

            callback(null, command);

        } catch (error) {
            callback(error);
        }
    }
}

module.exports = GameCommand;