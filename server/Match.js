const { randomUUID } = require('node:crypto');
const Courier = require('./Courier');

const GameEngine = require('./game/GameEngine');
const GameCommand = require('./game/GameCommand');
const GameMsg = require('./game/GameMsg');
const {Battle} = require('./game/Battle');

class Player {
    constructor (playerId, name) {
        this.playerId = playerId;
        this.name = name;
        //this.matchId = null;
        this.ownPieceId = null;
        this.state = null; // PLAYING | AWAITING_RES
    }

    setOwnPieceId (pieceId) {
        this.ownPieceId = pieceId;
    }

    getOwnPieceId () {
        return this.ownPieceId;
    }
}

class Match {
    static STATE = {
        QUEUE: 'QUEUE',
        COUNTDOWN: 'COUNTDOWN',
        GRACE: 'GRACE',
        BATTLE: 'BATTLE'
    }

    constructor (outCourier) {
        this.matchId = randomUUID();
        this.players = new Map(); // playerId -> Player
        this.pieceToPlayer = new Map(); // pieceId -> playerId
        this.minPlayers = 2;
        this.maxPlayers = 5;
        this.countdownDuration = 10 * 1000; // 10 seconds countdown
        this.countdownTimerId = null;
        this.gracePeriodDuration = 60 * 1000; // 60 seconds grace period
        this.gracePeriodTimerId = null;
        this.gracePeriodStartTime = null;
        this.game = null;
        this.outCourier = outCourier;
        this.gameCourier = new Courier();
        this.state = Match.STATE.QUEUE;
        this.battleTimers = new Map(); // battleId -> timer data
        this.battleTimeout = 10 * 1000; // 10 seconds for battle responses
    }

    createPlayer (playerId = null, name) {
        if (!(this.state === Match.STATE.QUEUE || this.state === Match.STATE.COUNTDOWN))
            return null;
        let id = playerId? playerId: randomUUID();
        if (this.players.size < this.maxPlayers) {
            this.players.set(id, new Player(id, name));
        }
        this.#updateState();
        return playerId;
    }

    /**
     * Removes a player from the Match
     * @param {*} playerId 
     */
    removePlayer(playerId) {
        //// Maybe kill the piece inside the game, that will need adding some functionality.
        switch (this.state) {
            case Match.STATE.QUEUE:
                this.players.delete(playerId);
                break;
            case Match.STATE.COUNTDOWN:
                this.players.delete(playerId);
                break;
        }
        this.#updateState();
    }

    /**
     * Executes a game command from a player
     * @param {string} playerId - ID of the player issuing the command
     * @param {Object} command - The game command object
     */
    execGameComm (playerId, command) {
        // Check if player exists in this match
        const player = this.players.get(playerId);
        if (!player) {
            console.log(`Player ${playerId} not found in match ${this.matchId}`);
            return false;
        }

        // Check if the match has a game running
        if (!this.game) {
            this.outCourier.deliver(
                playerId,
                GameMsg.createError(playerId, "Game has not started yet")
            );
            return false;
        }

        const pieceId = player.getOwnPieceId();

        // Validate the command first
        GameCommand.validate(command, (error, validatedCommand) => {
            if (error) {
                this.outCourier.deliver(
                    playerId,
                    GameMsg.createError(playerId, `Invalid command: ${error.message}`)
                );
                return;
            }

            // Route the command based on type
            this.#routeCommand(playerId, pieceId, validatedCommand);
        });

        return true;
    }

    /**
     * Routes validated commands to appropriate game methods
     * @param {string} playerId - Player ID
     * @param {string} pieceId - Piece ID in the game
     * @param {Object} command - Validated command
     */
    #routeCommand(playerId, pieceId, command) {
        switch (command.type) {
            case GameCommand.TYPE.MOVE:
                this.#handleMoveCommand(playerId, pieceId, command);
                break;

            case GameCommand.TYPE.SEARCH:
                this.#handleSearchCommand(playerId, pieceId, command);
                break;

            case GameCommand.TYPE.ATTACK:
                this.#handleAttackCommand(playerId, pieceId, command);
                break;

            case GameCommand.TYPE.RESPOND:
                this.#handleRespondCommand(playerId, pieceId, command);
                break;

            case GameCommand.TYPE.CHAT:
                this.#handleChatCommand(playerId, pieceId, command);
                break;

            default:
                this.outCourier.deliver(
                    playerId,
                    GameMsg.createError(playerId, `Unknown command type: ${command.type}`)
                );
        }
    }

    /**
     * Handles movement commands
     */
    #handleMoveCommand(playerId, pieceId, command) {
        const success = this.game.movePiece(pieceId, command.direction);
        if (!success) {
            this.outCourier.deliver(
                playerId,
                GameMsg.createError(playerId, `Cannot move ${command.direction} from current location`)
            );
        }
    }

    /**
     * Handles search commands
     */
    #handleSearchCommand(playerId, pieceId, _command) {
        const success = this.game.startSearch(pieceId);
        if (!success) {
            this.outCourier.deliver(
                playerId,
                GameMsg.createError(playerId, "Cannot search right now")
            );
        }
    }

    /**
     * Handles attack commands (checks grace period)
     */
    #handleAttackCommand(playerId, pieceId, command) {
        // Check if grace period is still active
        if (this.state === Match.STATE.GRACE) {
            const timeRemaining = this.getRemainingGraceTime();
            this.outCourier.deliver(
                playerId,
                GameMsg.createError(playerId, `Cannot attack during grace period (${Math.ceil(timeRemaining / 1000)}s remaining)`)
            );
            return;
        }

        // Find target player by name
        const targetPieceId = this.#findPieceByPlayerName(command.targetId);
        if (!targetPieceId) {
            this.outCourier.deliver(
                playerId,
                GameMsg.createError(playerId, `Player '${command.targetId}' not found`)
            );
            return;
        }

        const battleId = this.game.startBattle(pieceId);
        if (!battleId) {
            this.outCourier.deliver(
                playerId,
                GameMsg.createError(playerId, "Cannot start battle")
            );
            return;
        }

        // Start the 10-second timer for this battle
        // Get all pieces in the attacker's room that are in BATTLING state
        const attacker = this.game.allPieces.get(pieceId);
        const room = this.game.worldMap.get(attacker.getRoomId());
        const participants = Array.from(room.getAllPieces())
            .filter(id => this.game.allPieces.get(id).getState() === 'BATTLING');
        
        this.#startBattleTimer(battleId, participants);
    }

    /**
     * Handles battle response commands
     */
    #handleRespondCommand(playerId, pieceId, command) {
        const timerData = this.battleTimers.get(command.battleId);
        if (!timerData) {
            this.outCourier.deliver(
                playerId,
                GameMsg.createError(playerId, "Battle timer has expired or battle not found")
            );
            return;
        }
        
        // Record the response
        timerData.responses.set(pieceId, command.decision);
        
        // Set decision in battle system
        this.game.respondToAttack(command.battleId, pieceId, command.decision);
        
        // Check if all participants have responded
        if (timerData.responses.size === timerData.participants.size) {
            // All players responded, end battle early
            this.game.endBattle(command.battleId);
            this.#cleanupBattleTimer(command.battleId);
        }
    }

    /**
     * Handles chat commands
     */
    #handleChatCommand(playerId, pieceId, command) {
        const success = this.game.processChatMessage(pieceId, command.message);
        if (!success) {
            this.outCourier.deliver(
                playerId,
                GameMsg.createError(playerId, "Cannot send chat message")
            );
        }
    }

    /**
     * Finds a piece ID by player name
     */
    #findPieceByPlayerName(playerName) {
        for (const [_playerId, player] of this.players) {
            if (player.name.toLowerCase() === playerName.toLowerCase()) {
                return player.getOwnPieceId();
            }
        }
        return null;
    }

    #startMatch () {
        console.log('START MATCH');
        this.game = new GameEngine(this.gameCourier);
        //// HERE THE FUNCTIONALITY FOR PROCEDURAL OR AI GENERATION WILL BE USED
        this.game.loadWorld('./server/data/simplerTestWorld.json');
        
        // Create game pieces for all players
        for (let [playerId, player] of this.players) {
            let pieceId = this.game.createPiece(null, player.name);
            player.setOwnPieceId(pieceId);
            this.pieceToPlayer.set(pieceId, playerId);
            
            let delivery = (msg) => {
                console.log('GAME -> MATCH');
                let playerId = this.pieceToPlayer.get(msg.id);
                msg.id = playerId;
                this.outCourier.deliver(playerId, msg);
            };
            console.log(delivery);
            // Delivers messages to this level
            this.gameCourier.setAddress(pieceId, delivery);
        }
        
        // Transition to grace period
        this.state = Match.STATE.GRACE;
        this.gracePeriodStartTime = Date.now();
        
        // Notify all players that the match has started
        this.#broadcastToAllPlayers(
            GameMsg.createGracePeriod(null, {
                active: true,
                duration: this.gracePeriodDuration,
                timeRemaining: this.gracePeriodDuration,
                message: "Match started! Grace period active - no combat for 60 seconds"
            })
        );
        
        // Set grace period timer
        this.gracePeriodTimerId = setTimeout(() => {
            this.#endGracePeriod();
        }, this.gracePeriodDuration);
        
        // Send periodic grace period updates
        this.#scheduleGracePeriodUpdates();
        
        console.log(`Grace period started for ${this.gracePeriodDuration / 1000} seconds`);
    }

    /**
     * Ends the grace period and transitions to battle phase
     */
    #endGracePeriod() {
        this.state = Match.STATE.BATTLE;
        this.gracePeriodTimerId = null;
        
        // Notify all players that combat is now allowed
        this.#broadcastToAllPlayers(
            GameMsg.createGracePeriod(null, {
                active: false,
                timeRemaining: 0,
                message: "Grace period ended! Combat is now allowed!"
            })
        );
        
        console.log('Grace period ended - combat now allowed');
    }

    /**
     * Schedules periodic grace period countdown updates
     */
    #scheduleGracePeriodUpdates() {
        if (this.state !== Match.STATE.GRACE) return;
        
        const updateInterval = 10000; // Update every 10 seconds
        const timeElapsed = Date.now() - this.gracePeriodStartTime;
        const timeRemaining = Math.max(0, this.gracePeriodDuration - timeElapsed);
        
        if (timeRemaining > 0) {
            // Send update to all players
            this.#broadcastToAllPlayers(
                GameMsg.createGracePeriod(null, {
                    active: true,
                    timeRemaining: timeRemaining,
                    message: `Grace period: ${Math.ceil(timeRemaining / 1000)} seconds remaining`
                })
            );
            
            // Schedule next update
            setTimeout(() => {
                this.#scheduleGracePeriodUpdates();
            }, Math.min(updateInterval, timeRemaining));
        }
    }

    /**
     * Gets remaining grace period time in milliseconds
     */
    getRemainingGraceTime() {
        if (this.state !== Match.STATE.GRACE || !this.gracePeriodStartTime) {
            return 0;
        }
        
        const timeElapsed = Date.now() - this.gracePeriodStartTime;
        return Math.max(0, this.gracePeriodDuration - timeElapsed);
    }

    /**
     * Broadcasts a message to all players in the match
     */
    #broadcastToAllPlayers(message) {
        for (const [playerId, player] of this.players) {
            const playerMessage = { ...message };
            playerMessage.id = playerId;
            this.outCourier.deliver(playerId, playerMessage);
        }
    }

    totalPlayers () {
        return this.players.size;
    }
    
    #updateState () {
        switch (this.state) {
            case Match.STATE.QUEUE:
                if (this.players.size >= this.minPlayers) {
                    this.state = Match.STATE.COUNTDOWN;
                    this.countdownTimerId = setTimeout(() => {
                        this.countdownTimerId = null;
                        this.#startMatch();
                    }, this.countdownDuration);
                }
                break;
            case Match.STATE.COUNTDOWN:
                if (this.players.size < this.minPlayers) {
                    clearTimeout(this.countdownTimerId);
                    this.state = Match.STATE.QUEUE;
                    this.countdownTimerId = null;
                }
                break;
        }
    }

    playersCanJoin() {
        let cond1 = this.players.size < this.maxPlayers;
        let cond2 = this.state === Match.STATE.QUEUE;
        let cond3 = this.state === Match.STATE.COUNTDOWN;
        return  cond1 && cond2 || cond3;
    }

    /**
     * Cleanup method to clear timers and resources
     */
    clean() {
        // Clear countdown timer
        if (this.countdownTimerId) {
            clearTimeout(this.countdownTimerId);
            this.countdownTimerId = null;
        }
        
        // Clear grace period timer
        if (this.gracePeriodTimerId) {
            clearTimeout(this.gracePeriodTimerId);
            this.gracePeriodTimerId = null;
        }
        
        // Clear all battle timers
        for (const [_battleId, timerData] of this.battleTimers) {
            clearTimeout(timerData.timerId);
        }
        this.battleTimers.clear();
        
        // Clear players
        this.players.clear();
        this.pieceToPlayer.clear();
        
        console.log(`Match ${this.matchId} cleaned up`);
    }

    /**
     * Checks if the match is in a state where commands can be executed
     */
    canExecuteCommands() {
        return this.state === Match.STATE.GRACE || this.state === Match.STATE.BATTLE;
    }

    /**
     * Gets current match info for players
     */
    getMatchInfo() {
        return {
            matchId: this.matchId,
            state: this.state,
            playerCount: this.players.size,
            maxPlayers: this.maxPlayers,
            gracePeriodActive: this.state === Match.STATE.GRACE,
            gracePeriodRemaining: this.getRemainingGraceTime()
        };
    }

    /**
     * Starts a 10-second battle timer for the given battle
     * @param {string} battleId - The battle identifier
     * @param {string[]} participants - Array of pieceIds participating in the battle
     */
    #startBattleTimer(battleId, participants) {
        const timerId = setTimeout(() => {
            this.#onBattleTimerExpired(battleId);
        }, this.battleTimeout);
        
        const timerData = {
            timerId,
            startTime: Date.now(),
            participants: new Set(participants),
            responses: new Map(),
            battleId
        };
        
        this.battleTimers.set(battleId, timerData);
        
        // Notify participants of timer start
        participants.forEach(pieceId => {
            const playerId = this.pieceToPlayer.get(pieceId);
            if (playerId) {
                this.outCourier.deliver(
                    playerId,
                    GameMsg.createBattleStart(playerId, {
                        battleId,
                        timeLimit: this.battleTimeout,
                        message: "You have 10 seconds to respond!",
                        participants: participants.length
                    })
                );
            }
        });
    }

    /**
     * Handles battle timer expiration - sets default ESCAPE for non-responsive players
     * @param {string} battleId - The battle identifier
     */
    #onBattleTimerExpired(battleId) {
        const timerData = this.battleTimers.get(battleId);
        if (!timerData) return;
        
        // Set default ESCAPE decision for non-responsive players
        timerData.participants.forEach(pieceId => {
            if (!timerData.responses.has(pieceId)) {
                // Player didn't respond, treat as ESCAPE
                this.game.respondToAttack(battleId, pieceId, Battle.DECISION.ESCAPE);
            }
        });
        
        // End the battle
        this.game.endBattle(battleId);
        this.#cleanupBattleTimer(battleId);
    }

    /**
     * Cleans up battle timer resources
     * @param {string} battleId - The battle identifier
     */
    #cleanupBattleTimer(battleId) {
        const timerData = this.battleTimers.get(battleId);
        if (timerData) {
            clearTimeout(timerData.timerId);
            this.battleTimers.delete(battleId);
        }
    }

    testCall () {
        console.log('Hello from match');
        if (this.game) this.game.testCall();
    }
}

module.exports = Match;

/*
let match = new Match();
let p1 = match.createPlayer('p1');
let p2 = match.createPlayer('p2');
match.removePlayer(p2);
console.log(match.testCall());
*/