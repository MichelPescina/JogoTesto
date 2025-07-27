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
        this.weaponId = weaponId;
    }

    getWeaponId() {
        return this.weaponId;
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
        return this.weaponId !== null;
    }
}

module.exports = GameRoom;