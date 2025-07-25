const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

const Piece = require('./Piece');
const Weapon = require('./Weapon');
const GameRoom = require('./GameRoom');
const Battle = require('./Battle');

/**
 * Generates random integer
 * @param {int} start - Start of range (included)
 * @param {int} end  - End of range (not included)
 */
function randomInt (start, end) {
    let dist = end - start;
    return Math.floor(Math.random() * dist) + start;
}

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



class GameEngine {
    constructor () {
        this.allPieces = new Map(); //pieceId -> Piece
        this.allWeapons = new Map(); // weaponId -> Weapon
        this.totalChances = null; // Sum of all weapon chances
        this.worldMap = new Map(); // roomId -> GameRoom
        this.spawnRoom = null; // roomId of spawn Room
        this.escapeProb = 0.5;
    }

    loadWorld(path) {
        const data = fs.readFileSync(path, 'utf8');
        const jsonObj = JSON.parse(data);
        this.spawnRoomId = jsonObj.spawnRoomId;
        // Load all weapon info
        for (const [weaponId, value] of Object.entries(jsonObj.weapons)) {
            const newWeapon = new Weapon(weaponId, value);
            this.totalChances += newWeapon.spawnChance;
            this.allWeapons.set(weaponId, newWeapon);
        }
        // Load all rooms info
        for (const [roomId, value] of Object.entries(jsonObj.rooms)) {
            const newRoom = new GameRoom(roomId, value);
            this.worldMap.set(roomId, newRoom);
            this.spawnWeapon(roomId);
        }
        return true;
    }

    spawnWeapon(roomId) {
        const room = this.worldMap.get(roomId);
        if (Math.random() < room.weaponSpawnProb) {
            room.setWeapon(this.getRandomWeapon());
            return true;
        }
        return false;
    }

    getRandomWeapon() {
        let newWeaponId = null;
        const chance = randomInt(0, this.totalChances);
        let accum = 0; // Accumulated chances
        for (const [weaponId, weapon] of this.allWeapons) {
            if (chance >= accum && chance < accum + weapon.spawnChance) {
                newWeaponId = weaponId;
                break;
            }
            accum += weapon.spawnChance;
        }
        return newWeaponId;
    }

    createPiece (spawnRoomId = this.spawnRoomId) {
        const id = randomUUID();
        const room = this.worldMap.get(spawnRoomId);
        let newPiece = new Piece(id, spawnRoomId);
        this.allPieces.set(id, newPiece);
        room.addPiece(id);
        return id;
    }

    movePiece(pieceId, direction) {
        let result = false;
        const origin = this.worldMap.get(this.allPieces.get(pieceId).getRoomId());
        switch (direction) {
            case "north":
                if (origin.validateExit(direction)) {
                    result = true;
                    this.#swapPieceRooms(pieceId, origin.exits.north);
                }
                break;
            case "south":
                if (origin.validateExit(direction)) {
                    result = true;
                    this.#swapPieceRooms(pieceId, origin.exits.south);
                }
                break;
            case "east":
                if (origin.validateExit(direction)) {
                    result = true;
                    this.#swapPieceRooms(pieceId, origin.exits.east);
                }
                break;
            case "west":
                if (origin.validateExit(direction)) {
                    result = true;
                    this.#swapPieceRooms(pieceId, origin.exits.west);
                }
                break;
        }
        return result;
    }

    #swapPieceRooms (pieceId, targetRoomId) {
        const piece = this.allPieces.get(pieceId);
        const origin = this.worldMap.get(piece.getRoomId());
        const target = this.worldMap.get(targetRoomId);

        piece.setRoomId(targetRoomId);
        origin.removePiece(pieceId);
        target.addPiece(pieceId);
        return true;
    }

    /**
     * Manages the attack event.
     * @param {string} attackerId - Piece id of the attacker.
     * @param {int} tripTime - Time taken for a message to go to client and come back in milliseconds.
     */
    attack (attackerId) {
        const attacker = this.allPieces.get(attackerId);
        const room = this.worldMap.get(attacker.getRoomId());
        // Change the attacker state
        attacker.setState(Piece.STATE.BATTLING);
        // Change all players inside a room to await a response from the user or controller.
        for (const defenderId of room.getAllPieces()) {
            if (defenderId != attackerId) {
                let defender = this.allPieces.get(defenderId);
                switch (defender.getState()) {
                    // Usual scenario of player moving and receiving the attack message
                    case Piece.STATE.MOVING:
                        defender.setState(Piece.STATE.AWAITING_RES);
                        //// Send message through Courier
                        break;
                    // Inmediately resolve battle and die
                    case Piece.STATE.SEARCHING:
                        //defender.setState(Piece.STATE.DEAD);
                        //// Send message through Courier
                }
                defender.setState(Piece.STATE.AWAITING_RES);
            }
        }

    }

    respondToAttack (defenderId, decision) {
        const defender = this.allPieces.get(defenderId);
        if (defender.getState() !== AWAITING_RES) {
            //// Send error message through Courier
            return false;
        }
        switch (decision) {
            case "attack":
                defender.setState(Piece.STATE.ATTACK_RES);
                break;
            case "escape":
                defender.setState(Piece.STATE.ESCAPE_RES);
                break;
        }

    }

    /**
     * Handles combat finalization.
     * @param {Piece} winner 
     * @param {Piece} loser 
     */
    #endCombat(winner, loser) {
        // Handle winner
        winner.addStrength(this.strengthReward);
        winner.setState(Piece.STATE.MOVING);
        //// Add logic for winning the match????
        //// Send message through Courier
        // Handle loser
        loser.setState(Piece.STATE.DEAD);
        //// Send message through Courier
    }

    #defenderEscaped () {
        //// Take into account the attack difference in the future
        return  Math.random() < this.escapeProb;
    }
}

const game = new GameEngine();
let miau = game.loadWorld('./server/data/simplerTestWorld.json');
//console.log(miau);
let weapons = new Map();
for (let i=0; i < 1000; i++) {
    let w = game.getRandomWeapon();
    weapons.set(w, (weapons.get(w)+1) || 1);
}
/* //Movement test
let id1 = game.createPiece();
let id2 = game.createPiece();
let id3 = game.createPiece();
console.log(weapons);
console.log(game.worldMap.get('spawn').validateExit('north'));
let dirs = ['north', 'south', 'east', 'west'];
for (let i=0; i < 5; i++) {
    let dir = dirs[Math.floor(Math.random() * dirs.length)];
    //console.log('START ', i);
    console.log(game.worldMap.get(game.allPieces.get(id1).getRoomId()).id, dir);
    let res = game.movePiece(id1, dir);
    //console.log(`END ${i} res = ${res}`);
    //console.log(game.worldMap.get(game.allPieces.get(id1).getRoomId()).id);
}
*/
