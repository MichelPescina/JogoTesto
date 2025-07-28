class Piece {
    static STATE = {
        MOVING: "MOVING",               // -> SEARCHING | BATTLING | AWAITING_RES
        SEARCHING: "SEARCHING",         // -> MOVING | DEAD
        BATTLING: "BATTLING",           // -> MOVING | DEAD
        DEAD: "DEAD"
    }

    constructor (pieceId, name, spawnRoomId) {
        this.pieceId = pieceId; // The piece unique identifier
        this.name = name;
        this.roomId = spawnRoomId; // The room where the piece is
        this.state = Piece.STATE.MOVING;
        this.weapon = null; // Reference to Weapon
        this.strength = 1;
    }

    getName () {
        return this.name;
    }

    getPieceId() {
        return this.pieceId;
    }

    getRoomId() {
        return this.roomId;
    }

    setRoomId(roomId) {
        this.roomId = roomId
    }

    setState (state) {
        this.state = state;
    }

    getState () {
        return this.state;
    }

    addStrength (amount) {
        this.strength += amount;
    }

    getStrength () {
        return this.strength;
    }

    getDamage() {
        return this.strength + (this.weapon? this.weapon.getAttack(): 0);
    }

    getWeapon() {
        return this.weapon;
    }

    setWeapon(weapon) {
        this.weapon = weapon;
    }
}

module.exports = Piece;