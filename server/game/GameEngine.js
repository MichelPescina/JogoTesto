const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

const Piece = require('./Piece');
const Weapon = require('./Weapon');
const GameRoom = require('./GameRoom');
const {BattleRes, Battle} = require('./Battle');

/**
 * Generates random integer
 * @param {int} start - Start of range (included)
 * @param {int} end  - End of range (not included)
 */
function randomInt (start, end) {
    let dist = end - start;
    return Math.floor(Math.random() * dist) + start;
}

class GameEngine {
    /**
     * 
     * @param {*} courier - A Courier instance which maps pieceIds to a delivery function
     */
    constructor (outCourier) {
        this.allPieces = new Map(); //pieceId -> Piece
        this.allWeapons = new Map(); // weaponId -> Weapon
        this.totalChances = null; // Sum of all weapon chances
        this.worldMap = new Map(); // roomId -> GameRoom
        this.spawnRoom = null; // roomId of spawn Room
        this.battles = new Map();
        this.escapeProb = 1.5;
        this.killBonus = 2; // Strength added to piece per kill
        this.remainingPieces = 0;
        this.outCourier = outCourier;
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
            room.setWeaponId(this.getRandomWeapon());
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

    createPiece (pieceId = null, name = 'Piece', spawnRoomId = this.spawnRoomId) {
        const id = pieceId? pieceId : randomUUID();
        const room = this.worldMap.get(spawnRoomId);
        let newPiece = new Piece(id, name, spawnRoomId);
        this.allPieces.set(id, newPiece);
        room.addPiece(id);
        this.remainingPieces++;
        return id;
    }

    movePiece(pieceId, direction) {
        if (this.allPieces.get(pieceId).getState() !== Piece.STATE.MOVING)
            return false;
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
     * Manages the attack action and creates a new Battle instance.
     * @param {string} attackerId - Piece id of the initiator.
     */
    startBattle (attackerId) {
        const attacker = this.allPieces.get(attackerId);
        if (attacker.getState() !== Piece.STATE.MOVING) return null;
        const room = this.worldMap.get(attacker.getRoomId());
        // Filters all pieces not available for combat (DEAD or BATTLING)
        // and maps the ids into the actual Objects.
        const filter = (id, state) => this.allPieces.get(id).getState() === state;
        let pieces = Array.from(room.getAllPieces()).filter(
                id => filter(id, Piece.STATE.MOVING) || filter(id, Piece.STATE.SEARCHING))
            .map(
                id => this.allPieces.get(id)
            );
        // Sets the state for all involved pieces and filters out new dead pieces
        pieces = pieces.filter(piece => {
            let passed = true;
            // If searching kill inmediately
            if (piece.getState() === Piece.STATE.SEARCHING) {
                this.#handleKill(piece.getPieceId());
                attacker.addStrength(this.killBonus);
                passed = false;
            }
            else piece.setState(Piece.STATE.BATTLING);
            return passed;
        });
        // Error - Only one piece remains
        if (pieces.length < 2) {
            attacker.setState(Piece.STATE.MOVING);
            return null; //// Maybe a message?
        }
        // Creates battle and stores it
        let id = randomUUID();
        let battle = new Battle(id, attackerId, pieces, this.escapeProb);
        this.battles.set(id, battle);
        return id;
    }

    respondToAttack (battleId, defenderId, decision) {
        let battle = this.battles.get(battleId);
        if (battle) {
            battle.setDecision(defenderId, decision);
        }
        return; //// Game Messages
    }

    endBattle (battleId) {
        let battleRes = this.battles.get(battleId).play();
        let totalKilled = 0;
        let winnerId = null;
        battleRes.forEach(res => {
            switch (res.result) {
                case BattleRes.RESULT.WON:
                    winnerId = res.pieceId;
                    break
                case BattleRes.RESULT.ESCAPED:
                    this.#handleEscape(res.pieceId);
                    break;
                case BattleRes.RESULT.DIED:
                    this.#handleKill(res.pieceId);
                    totalKilled++;
                    break;
            }
        })
        // Handle winner
        this.#handleWinner(winnerId, totalKilled);
        //// CLEANUP OF DATA STRUCTURES
        this.battles.delete(battleId);
    }

    #handleWinner (winnerId, kills) {
        let winner = this.allPieces.get(winnerId);
        winner.addStrength(kills * this.killBonus);
        winner.setState(Piece.STATE.MOVING);
    }

    #handleEscape (pieceId) {
        let piece = this.allPieces.get(pieceId);
        let room = this.worldMap.get(piece.getRoomId());
        let dirs = Array.from(Object.getOwnPropertyNames(room.getExits()));
        let dir = dirs[randomInt(0, dirs.length)]
        piece.setState(Piece.STATE.MOVING);
        this.movePiece(pieceId, dir);
        //// Send message.
    }

    #handleKill (pieceId) {
        let piece = this.allPieces.get(pieceId);
        let room = this.worldMap.get(piece.getRoomId());
        room.removePiece(pieceId);
        piece.setState(Piece.STATE.DEAD);
        this.remainingPieces--;
        //// Check if we have a win condition
        //// Send message.
    }

    startSearch (pieceId) {
        let piece = this.allPieces.get(pieceId);
        // Check if it's in an appropiate State
        if (piece.getState() !== Piece.STATE.MOVING) return false;
        piece.setState(Piece.STATE.SEARCHING);
        return true;
    }

    endSearch (pieceId) {
        let piece = this.allPieces.get(pieceId);
        // Check if it's in an appropiate State
        if (piece.getState() !== Piece.STATE.SEARCHING) return false;
        let room = this.worldMap.get(piece.getRoomId());
        piece.setState(Piece.STATE.MOVING);
        piece.setWeapon(this.allWeapons.get(room.getWeaponId()));
        room.setWeaponId(null);
    }

    getStatePiece (pieceId) {
        let piece = this.allPieces.get(pieceId);
        let obs = {};
        obs.pieceId = pieceId;
        obs.pieceAttack = piece.getStrength();
        obs.pieceState = piece.getState();
        return {piece: obs};
    }

    getStateRoom (pieceId) {
        let piece = this.allPieces.get(pieceId);
        let room = this.worldMap.get(piece.getRoomId());
        let obs = {};
        obs.name = room.getName();
        obs.desc = room.getDescription();
        obs.hidden = room.hasWeapon();
        obs.exits = {};
        Object.entries(room.getExits()).forEach(([dir, roomId]) => {
            obs.exits[dir] = this.worldMap.get(roomId).getName();
        });
        return {room: obs};
    }

    getStateOthers (pieceId) {
        let piece = this.allPieces.get(pieceId);
        let room = this.worldMap.get(piece.getRoomId());
        return {others: Array.from(room.getAllPieces())};
    }

    testCall () {
        console.log('GAME ENGINE TEST CALL');
        for (const [pieceId, piece] of this.allPieces) {
            this.outCourier.deliver(
                pieceId, 
                {id: pieceId, text: `Hello from ${piece.name}`}
            );
        }
    }
}

module.exports = GameEngine;
/*
const game = new GameEngine();
let miau = game.loadWorld('./server/data/simplerTestWorld.json');
let id1 = game.createPiece('p1');
let id2 = game.createPiece('p2');
let id3 = game.createPiece('p3');

//game.movePiece(id1, 'north');
//game.movePiece(id2, 'north');
game.startSearch(id2);
game.endSearch(id2);
console.log(game.allPieces.get(id2));
//game.startSearch(id3);
let battleId = game.startBattle(id1);
console.log(battleId);
if (battleId) {
    game.respondToAttack(battleId, id2, 'ATTACK');
    game.endBattle(battleId);
}

console.log(game.getObservation(id1));
console.log(game.getObservation(id2));
console.log(game.getObservation(id3));
*/