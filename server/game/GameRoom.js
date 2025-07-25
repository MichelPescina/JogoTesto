class GameRoom {
    constructor (roomId, contents) {
        this.id = roomId;
        this.name = contents.name;
        this.description = contents.description;
        this.exits = contents.exits;
        this.weaponSpawnProb = contents.weaponSpawnProb;
        this.pieces = new Set();
        this.weapon = null;
    }

    setWeapon(weaponId) {
        this.weapon = weaponId;
    }

    getWeapon() {
        return this.weapon;
    }

    addPiece (pieceId) {
        this.pieces.add(pieceId);
    }

    removePiece (pieceId) {
        this.pieces.delete(pieceId);
    }

    getAllPieces() {
        return this.pieces;
    }

    getExits () {
        return this.exits;
    }

    validateExit (direction) {
        return Object.hasOwn(this.exits, direction);
    }
}

module.exports = GameRoom;