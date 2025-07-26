const { randomUUID } = require('node:crypto')

class Match {
    constructor () {
        this.matchId = randomUUID();
        this.players = new Map(); // playerId -> pieceId
        this.minPlayers = 1;
        this.maxPlayers = 5;
        this.matchState = null; // A state machine to keep track of state
        /*
            State machine
            waitingPlayers          - Waiting for players to start Match
                -> startCountdown   - Cond: once the minPlayers is met)
            startCountdown          - Starts the Countdown to start game
                -> countdown        - Cond: Inmediately after creating countdown
            countdown               - Waiting for the countdown to finish
                -> waitingPlayers   - Cond: if players leave and minPlayers not met
                -> startGame        - Cond: inmediately after countdown finishes
            startGame               - Starts the game
                -> gracePeriod      - Cond: Inmediately after starting
            gracePeriod             - Grace period where players can't attack
                -> battlePeriod     - Cond: after countdown ends
                -> closeMatch       - Cond: if there are no players
            battlePeriod            - Normal gameplay
                -> winner           - Cond: when only one player remains
            winner                  - Announces winner and dremoves last player
                -> closeMatch       - Cond: if there are no players
            closeMatch              - Cleans data structures, etc.
        */
    }

    addPlayer (playerId) {
        if (this.players.size < this.maxPlayers) {
            this.players.add(playerId);
            return true;
        }
        return false;
    }

    totalPlayers () {
        return this.players.size;
    }

    clean() {
        this.players.clean();
    }
}

class MatchManager {
    constructor () {
        this.matches = new Map(); // For now, only one match
        this.maxNumMatches = 1;
        this.countdownSecs = 10;
    }

    createMatch () {
        let matchId = null;
        if (this.matches.size < this.maxNumMatches) {
            const newMatch = new Match();
            matchId = newMatch.matchId;
            this.matches.set(matchId, newMatch);
        }
        return matchId;
    }

    getMatch (matchId) {
        return this.matches.get(matchId);
    }

    deleteMatch (matchId) {
        const match = this.getMatch(matchId);
        match.clean();
        this.matches.delete(matchId);
    }

    deleteEmptyMatches () {
        let toRemove = [];
        for (const [matchId, match] of this.matches) {
            if (match.totalPlayers() < 1) {
                toRemove.push(matchId);
            }
        }
        for (let i = 0; i < toRemove.length; i++) {
            this.deleteMatch(toRemove[i]);
        }
    }
}

module.exports = { MatchManager, Match}