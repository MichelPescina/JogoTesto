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
     * @param {string} instigatorId - The piece id of the battle initiator. 
     * @param {Object[]} pieces - An array of involved pieces in battle.
     */
    constructor (instigatorId, pieces, escapeProb = 0.25) {
        this.pieces = Array.from(pieces);
        this.pieceDecision = new Map(pieces.map(x => [x.pieceId, 'AWAITING']));
        this.pieceDecision.set(instigatorId, Battle.DECISION.ATTACK);
        this.escapeProb = escapeProb;
    }

    /**
     * Sets the action that will be performed by the piece once it is played.
     * @param {string} pieceId - Id of the piece
     * @param {string} decision - The action that will be taken, must be one of Battle.DECISION options.
     */
    setDecision(pieceId, decision) {
        this.pieceDecision.set(pieceId, decision);
    }

    playBattle () {
        // Sets all awaiting pieces to escape mode
        this.pieces.forEach(piece => {
            if (this.pieceDecision.get(piece.getPieceId()) === 'AWAITING') {
                this.pieceDecision.set(piece.getPieceId(), Battle.DECISION.ESCAPE);
            }
        })
        // Find the strongest Piece
        let strongest = this.pieces.reduce((prev, curr) => {
            let cond1 = curr.getDamage() >= (prev? prev.getDamage(): 0);
            let cond2 = this.pieceDecision.get(curr.getPieceId()) === Battle.DECISION.ATTACK;
            console.log(curr.getDamage());
            return cond1 && cond2? curr : prev;
        }, null);
        console.log(this.pieceDecision);
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

module.exports = Battle;

let p1 = new Piece('player_0', 'spawn');
let p2 = new Piece('player_1', 'spawn');
let p3 = new Piece('player_2', 'spawn');
let p4 = new Piece('player_3', 'spawn');
let p5 = new Piece('player_4', 'spawn');
p5.addStrength(100);

let players = [p1, p2, p3, p4, p5];
let battle = new Battle(p1.getPieceId(), Array.from(players));
battle.setDecision(p5.getPieceId(), 'ATTACK')
console.log(battle);
let res = battle.playBattle();
console.log(res);