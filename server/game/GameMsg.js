/**
 * GameMsg represents a unidirectional message sent to the client that
 * tells it what to do. The client must reply with a GameComm when action
 * is REPLY.
 */
class GameMsg {
    static BUILD = {
        invalidMove: () =>  `You can't move right now!`,
        invalidDir: (dir) => `You can't go towards ${dir}`,
        otherExit: (otherPiece) => `${otherPiece} left this place!`,
        otherEnter: (otherPiece) => `${otherPiece} just arrived!`,
    }
    
    static ACTION = {
        SHOW: 'SHOW',       // Show message
        UPDATE: 'UPDATE',   // Update state
        REPLY: 'REPLY',     // Reply to message received
        AWAIT: 'AWAIT',     // Await for a response from the server
        RESUME: 'RESUME'    // Resume the execution
    }

    /**
     * Game message types for real-time client communication
     */
    static TYPE = {
        GAME_STATE: 'GAME_STATE',     // Complete game state update
        ROOM_UPDATE: 'ROOM_UPDATE',   // Room description and players
        BATTLE_START: 'BATTLE_START', // Combat initiation
        BATTLE_END: 'BATTLE_END',     // Combat resolution
        CHAT_MSG: 'CHAT_MSG',         // Chat messages
        ERROR: 'ERROR',               // Error notifications
        PLAYER_JOIN: 'PLAYER_JOIN',   // Player joined room
        PLAYER_LEAVE: 'PLAYER_LEAVE', // Player left room
        SEARCH_START: 'SEARCH_START', // Search action started
        SEARCH_END: 'SEARCH_END',     // Search action completed
        GRACE_PERIOD: 'GRACE_PERIOD'  // Grace period status
    }

    /**
     * @param {string} id - The id of the receiver
     * @param {string} action - What action the receiver must do at arrival
     * @param {*} content - The content you want to send
     */
    constructor (id, action, content) {
        this.id = id;
        this.action = action;
        this.content = content;
    }

    /**
     * Creates a game state update message
     * @param {string} playerId - Target player ID
     * @param {Object} gameState - Complete game state
     * @returns {GameMsg} - Game state message
     */
    static createGameState(playerId, gameState) {
        return new GameMsg(playerId, GameMsg.ACTION.UPDATE, {
            type: GameMsg.TYPE.GAME_STATE,
            data: gameState,
            timestamp: Date.now()
        });
    }

    /**
     * Creates a room update message
     * @param {string} playerId - Target player ID
     * @param {Object} roomData - Room information and players
     * @returns {GameMsg} - Room update message
     */
    static createRoomUpdate(playerId, roomData) {
        return new GameMsg(playerId, GameMsg.ACTION.UPDATE, {
            type: GameMsg.TYPE.ROOM_UPDATE,
            data: roomData,
            timestamp: Date.now()
        });
    }

    /**
     * Creates a battle start message
     * @param {string} playerId - Target player ID
     * @param {Object} battleData - Battle information
     * @returns {GameMsg} - Battle start message
     */
    static createBattleStart(playerId, battleData) {
        return new GameMsg(playerId, GameMsg.ACTION.REPLY, {
            type: GameMsg.TYPE.BATTLE_START,
            data: battleData,
            timestamp: Date.now()
        });
    }

    /**
     * Creates a battle end message
     * @param {string} playerId - Target player ID
     * @param {Object} battleResult - Battle resolution data
     * @returns {GameMsg} - Battle end message
     */
    static createBattleEnd(playerId, battleResult) {
        return new GameMsg(playerId, GameMsg.ACTION.SHOW, {
            type: GameMsg.TYPE.BATTLE_END,
            data: battleResult,
            timestamp: Date.now()
        });
    }

    /**
     * Creates a chat message
     * @param {string} playerId - Target player ID
     * @param {Object} chatData - Chat message data
     * @returns {GameMsg} - Chat message
     */
    static createChatMessage(playerId, chatData) {
        return new GameMsg(playerId, GameMsg.ACTION.SHOW, {
            type: GameMsg.TYPE.CHAT_MSG,
            data: chatData,
            timestamp: Date.now()
        });
    }

    /**
     * Creates an error message
     * @param {string} playerId - Target player ID
     * @param {string} errorMessage - Error description
     * @param {string} errorCode - Optional error code
     * @returns {GameMsg} - Error message
     */
    static createError(playerId, errorMessage, errorCode = null) {
        return new GameMsg(playerId, GameMsg.ACTION.SHOW, {
            type: GameMsg.TYPE.ERROR,
            data: {
                message: errorMessage,
                code: errorCode
            },
            timestamp: Date.now()
        });
    }

    /**
     * Creates a player join notification
     * @param {string} playerId - Target player ID
     * @param {Object} playerData - Joining player information
     * @returns {GameMsg} - Player join message
     */
    static createPlayerJoin(playerId, playerData) {
        return new GameMsg(playerId, GameMsg.ACTION.SHOW, {
            type: GameMsg.TYPE.PLAYER_JOIN,
            data: playerData,
            timestamp: Date.now()
        });
    }

    /**
     * Creates a player leave notification
     * @param {string} playerId - Target player ID
     * @param {Object} playerData - Leaving player information
     * @returns {GameMsg} - Player leave message
     */
    static createPlayerLeave(playerId, playerData) {
        return new GameMsg(playerId, GameMsg.ACTION.SHOW, {
            type: GameMsg.TYPE.PLAYER_LEAVE,
            data: playerData,
            timestamp: Date.now()
        });
    }

    /**
     * Creates a search start notification
     * @param {string} playerId - Target player ID
     * @param {Object} searchData - Search action data
     * @returns {GameMsg} - Search start message
     */
    static createSearchStart(playerId, searchData) {
        return new GameMsg(playerId, GameMsg.ACTION.SHOW, {
            type: GameMsg.TYPE.SEARCH_START,
            data: searchData,
            timestamp: Date.now()
        });
    }

    /**
     * Creates a search end notification
     * @param {string} playerId - Target player ID
     * @param {Object} searchResult - Search completion data
     * @returns {GameMsg} - Search end message
     */
    static createSearchEnd(playerId, searchResult) {
        return new GameMsg(playerId, GameMsg.ACTION.SHOW, {
            type: GameMsg.TYPE.SEARCH_END,
            data: searchResult,
            timestamp: Date.now()
        });
    }

    /**
     * Creates a grace period status message
     * @param {string} playerId - Target player ID
     * @param {Object} graceData - Grace period information
     * @returns {GameMsg} - Grace period message
     */
    static createGracePeriod(playerId, graceData) {
        return new GameMsg(playerId, GameMsg.ACTION.SHOW, {
            type: GameMsg.TYPE.GRACE_PERIOD,
            data: graceData,
            timestamp: Date.now()
        });
    }

    /**
     * Validates message structure
     * @param {Object} message - Message to validate
     * @returns {boolean} - True if valid
     */
    static isValid(message) {
        return message && 
               typeof message.id === 'string' &&
               typeof message.action === 'string' &&
               Object.values(GameMsg.ACTION).includes(message.action) &&
               message.content !== undefined;
    }
}

module.exports = GameMsg;