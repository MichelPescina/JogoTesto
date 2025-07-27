const { randomUUID } = require('node:crypto');
const Courier = require('./Courier');

const GameEngine = require('./game/GameEngine');

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
        this.countdownDuration = 0 * 1000; // secs * millisecs
        this.countdownTimerId = null;
        this.game = null;
        this.outCourier = outCourier;
        this.gameCourier = new Courier();
        this.state = Match.STATE.QUEUE;
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

    execGameComm (comm) {

    }

    #startMatch () {
        console.log('START MATCH');
        this.game = new GameEngine(this.gameCourier);
        //// HERE THE FUNCTIONALITY FOR PROCEDURAL OR AI GENERATION WILL BE USED
        this.game.loadWorld('./server/data/simplerTestWorld.json');
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
        this.state = Match.STATE.GRACE;
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