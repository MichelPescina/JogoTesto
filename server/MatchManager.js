const { randomUUID } = require('node:crypto');

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