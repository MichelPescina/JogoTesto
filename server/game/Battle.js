const Piece = require('./Piece');

class BattleRes {
    static RESULT = {
        WON: 'WON',
        ESCAPED: 'ESCAPED',
        DIED: 'DIED'
    }

    constructor (pieceId, result) {
        this.pieceId = pieceId;
        this.result = result;
    }
}

class Battle {
    static DECISION = {
        ATTACK: 'ATTACK',
        ESCAPE: 'ESCAPE'
    }
    /**
     * Constructor for the Battle
     * @param {string} battleId - Unique identifier for battle instance.
     * @param {string} instigatorId - The piece id of the battle initiator. 
     * @param {Object[]} pieces - An array of involved pieces in battle.
     * @param {number} escapeProb - Probability for escaping battle [0.0, 1.0]
     */
    constructor (battleId, instigatorId, pieces, escapeProb = 0.25) {
        this.battleId = battleId;
        this.pieces = Array.from(pieces);
        this.pieceDecision = new Map(pieces.map(x => [x.pieceId, 'AWAITING']));
        this.pieceDecision.set(instigatorId, Battle.DECISION.ATTACK);
        this.escapeProb = escapeProb;
        this.winnerName = null;
        this.winnerWeapon = null;
    }

    /**
     * Sets the action that will be performed by the piece once it is played.
     * @param {string} pieceId - Id of the piece
     * @param {string} decision - The action that will be taken, must be one of Battle.DECISION options.
     */
    setDecision(pieceId, decision) {
        if (this.pieceDecision.get(pieceId) !== 'AWAITING') return false;
        this.pieceDecision.set(pieceId, decision);
        return true;
    }

    play () {
        // Sets all awaiting pieces to escape mode
        this.pieces.forEach(piece => {
            if (this.pieceDecision.get(piece.getPieceId()) === 'AWAITING') {
                this.pieceDecision.set(piece.getPieceId(), Battle.DECISION.ESCAPE);
            }
        })
        // Find the strongest Piece
        let strongest = this.pieces.reduce((prev, curr) => {
            let cond1 = curr.getDamage() > (prev? prev.getDamage(): 0);
            let cond2 = this.pieceDecision.get(curr.getPieceId()) === Battle.DECISION.ATTACK;
            return cond1 && cond2? curr : prev;
        }, null);
        this.winnerName = strongest.getName();
        this.winnerWeapon = strongest.weapon? strongest.weapon.name: 'Fists';
        // Creates result of battle
        let result = this.pieces.map(piece => {
            let name = piece.getPieceId();
            let res = new BattleRes(name, BattleRes.RESULT.DIED);
            if (piece.getPieceId() === strongest.getPieceId()) {
                res.result = BattleRes.RESULT.WON;
            }
            else if (this.pieceDecision.get(piece.getPieceId()) === Battle.DECISION.ESCAPE) {
                if (this.#escaped()) res.result = BattleRes.RESULT.ESCAPED;
            }
            return res;
        })
        return result;
    }

    #escaped () {
        return Math.random() < this.escapeProb;
    }
}

module.exports = {BattleRes, Battle};