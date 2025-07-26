class GameCommand {
    static TYPE = {
        MOVE: "MOVE",
        SEARCH: "SEARCH",
        ATTACK: "ATTACK",
        RES_ATTACK: "RES_ATTACK",
        RES_ESCAPE: "RES_ESCAPE",
    }

    constructor (type, pieceId, target) {
        this.type = type;
        this.pieceId = pieceId;
        this.target = target;
    }
}

module.exports = GameCommand;