class GameRoom {
    constructor (roomId, contents) {
        this.id = roomId;
        this.name = contents.name;
        this.description = contents.description;
        this.exits = contents.exits;
        this.weaponSpawnProb = contents.weaponSpawnProb;
        this.pieces = new Set();
        this.weaponId = null;
    }

    setWeaponId(weaponId) {
        this.weapon = weaponId;
    }

    getWeaponId() {
        return this.weaponid;
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

    getName() {
        return this.name;
    }

    getDescription() {
        return this.description;
    }

    hasWeapon() {
        return this.weapon !== false;
    }
}

module.exports = GameRoom;