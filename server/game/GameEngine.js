const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

const Piece = require('./Piece');
const Weapon = require('./Weapon');
const GameRoom = require('./GameRoom');
const {BattleRes, Battle} = require('./Battle');
const GameMsg = require('./GameMsg');

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
        this.spawnRoomId = null; // roomId of spawn Room
        this.battles = new Map();
        this.escapeProb = 1.5;
        this.killBonus = 2; // Strength added to piece per kill
        this.remainingPieces = 0;
        this.outCourier = outCourier;
        this.finished = false;
        this.searchTime = 3 * 1000;
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
        const piece = this.allPieces.get(pieceId);
        const origin = this.worldMap.get(piece.getRoomId());
        let targetRoomId = null;
        
        switch (direction) {
            case "north":
                if (origin.validateExit(direction)) {
                    result = true;
                    targetRoomId = origin.exits.north;
                }
                break;
            case "south":
                if (origin.validateExit(direction)) {
                    result = true;
                    targetRoomId = origin.exits.south;
                }
                break;
            case "east":
                if (origin.validateExit(direction)) {
                    result = true;
                    targetRoomId = origin.exits.east;
                }
                break;
            case "west":
                if (origin.validateExit(direction)) {
                    result = true;
                    targetRoomId = origin.exits.west;
                }
                break;
        }

        if (result) {
            this.#swapPieceRooms(pieceId, targetRoomId);
            // Send real-time updates after successful movement
            this.#broadcastRoomUpdate(pieceId);
            this.#broadcastMovementNotification(pieceId, piece.name, origin.id, targetRoomId);
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
        
        // Handle searching pieces (vulnerable players are killed immediately)
        const searchingPieces = pieces.filter(piece => piece.getState() === Piece.STATE.SEARCHING);
        searchingPieces.forEach(piece => {
            let weaponName = attacker.weapon? attacker.weapon.name: 'Bare Hands';
            this.#handleKill(piece.getPieceId(), attacker.name, weaponName);
            attacker.addStrength(this.killBonus);
        });
        
        // Sets the state for all involved pieces and filters out new dead pieces
        pieces = pieces.filter(piece => {
            let passed = true;
            if (piece.getState() === Piece.STATE.SEARCHING || piece.getState() === Piece.STATE.DEAD) {
                passed = false; // Already handled above
            } else {
                piece.setState(Piece.STATE.BATTLING);
            }
            return passed;
        });
        
        // Error - Only one piece remains
        if (pieces.length < 2) {
            attacker.setState(Piece.STATE.MOVING);
            // Send message about failed attack
            this.outCourier.deliver(
                attackerId, 
                GameMsg.createError(attackerId, "No valid targets for battle in this room")
            );
            return null;
        }
        
        // Creates battle and stores it
        let battleId = randomUUID();
        let battle = new Battle(battleId, attackerId, pieces, this.escapeProb);
        this.battles.set(battleId, battle);
        
        // Broadcast battle start to all participants and room observers
        this.#broadcastBattleStart(battleId, attackerId, pieces);
        
        return battleId;
    }

    respondToAttack (battleId, defenderId, decision) {
        let battle = this.battles.get(battleId);
        if (battle) {
            battle.setDecision(defenderId, decision);
        }
        return; //// Game Messages
    }

    endBattle (battleId) {
        let battle = this.battles.get(battleId);
        if (!battle) return null;
        
        let battleRes = battle.play();
        let totalKilled = 0;
        let winnerId = null;
        let escapeIds = [];
        let deadIds = [];
        
        battleRes.forEach(res => {
            switch (res.result) {
                case BattleRes.RESULT.WON:
                    winnerId = res.pieceId;
                    break
                case BattleRes.RESULT.ESCAPED:
                    this.#handleEscape(res.pieceId);
                    escapeIds.push(res.pieceId);
                    break;
                case BattleRes.RESULT.DIED:
                    this.#handleKill(res.pieceId, battle.winnerName, battle.winnerWeapon);
                    deadIds.push(res.pieceId);
                    totalKilled++;
                    break;
            }
        });
        
        // Handle winner
        this.#handleWinner(winnerId, totalKilled);
        
        // Broadcast battle end to all relevant parties
        this.#broadcastBattleEnd(battleId, winnerId, escapeIds, deadIds, battle.pieces);
        
        // Check win condition after battle
        this.#checkWinCondition();
        
        // CLEANUP OF DATA STRUCTURES
        this.battles.delete(battleId);
        
        return {
            winnerId,
            escaped: escapeIds,
            killed: deadIds,
            totalKilled
        };
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
        let dir = dirs[randomInt(0, dirs.length)];
        
        const originalRoomId = piece.getRoomId();
        piece.setState(Piece.STATE.MOVING);
        this.movePiece(pieceId, dir);
        
        // Send escape notification to the escaped player
        this.outCourier.deliver(
            pieceId,
            GameMsg.createGameState(pieceId, { 
                type: 'ESCAPE',
                message: `You escaped to the ${dir}!`
            })
        );
        
        // Notify other players in the original room
        this.#broadcastToRoom(originalRoomId, pieceId, 
            GameMsg.createPlayerLeave(null, { playerName: piece.name, reason: 'escaped' }));
    }

    #handleKill (pieceId, winnerName, winnerWeapon) {
        let piece = this.allPieces.get(pieceId);
        let room = this.worldMap.get(piece.getRoomId());
        const playerName = piece.name;
        const roomId = piece.getRoomId();
        
        room.removePiece(pieceId);
        piece.setState(Piece.STATE.DEAD);
        this.remainingPieces--;
        
        // Send death notification to the killed player
        this.outCourier.deliver(
            pieceId,
            GameMsg.createPlayerDead(pieceId, "You have been killed! Game over.")
        );
        
        // Notify all players
        this.#broadcastToAll(
            pieceId, 
            GameMsg.createPlayerDead(null, `${playerName} was killed by ${winnerName} using ${winnerWeapon}`)
        );

        // Notify other players in the room
        this.#broadcastToRoom(roomId, pieceId,
            GameMsg.createPlayerLeave(null, { playerName: playerName, reason: 'killed' }));
        
        // Check if we have a win condition after this kill
        this.#checkWinCondition();
    }

    startSearch (pieceId) {
        let piece = this.allPieces.get(pieceId);
        // Check if it's in an appropriate state
        if (piece.getState() !== Piece.STATE.MOVING) return false;
        
        piece.setState(Piece.STATE.SEARCHING);
        
        // Broadcast search start notification
        this.#broadcastSearchStart(pieceId, piece.name);
        
        // Set automatic search completion timer
        setTimeout(() => {
            this.endSearch(pieceId);
        }, this.searchTime);
        
        return true;
    }

    endSearch (pieceId) {
        let piece = this.allPieces.get(pieceId);
        // Check if it's in an appropriate state
        if (piece.getState() !== Piece.STATE.SEARCHING) return false;
        
        let room = this.worldMap.get(piece.getRoomId());
        let weaponFound = null;
        let foundWeapon = false;
        
        // Check if there's a weapon in the room
        if (room.hasWeapon() && room.getWeaponId()) {
            weaponFound = this.allWeapons.get(room.getWeaponId());
            piece.setWeapon(weaponFound);
            room.setWeaponId(null);
            foundWeapon = true;
        }
        
        piece.setState(Piece.STATE.MOVING);
        
        // Broadcast search completion
        this.#broadcastSearchEnd(pieceId, piece.name, foundWeapon, weaponFound);
        
        // Update room state for all players in the room
        this.#broadcastRoomUpdate(pieceId);
        
        return foundWeapon;
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


    /**
     * Broadcasts state of the room
     */
    broadcastStart () {
        const room = this.worldMap.get(this.spawnRoomId);
        
        // Get all players in the room
        const playersInRoom = Array.from(room.getAllPieces())
            .map(id => this.allPieces.get(id)?.name)
            .filter(name => name);
        console.log('Players in room: ', playersInRoom);

        const roomData = {
            roomName: room.getName(),
            description: room.getDescription(),
            players: playersInRoom,
            exits: room.getExits(),
            weapon: room.hasWeapon() ? this.allWeapons.get(room.getWeaponId())?.name : null
        };

        this.#broadcastToRoom(this.spawnRoomId, [], 
            GameMsg.createRoomUpdate(null, roomData)
        );
    }
    /**
     * Broadcasts room update to a specific player
     */
    #broadcastRoomUpdate(pieceId) {
        const piece = this.allPieces.get(pieceId);
        const room = this.worldMap.get(piece.getRoomId());
        
        // Get all players in the room
        const playersInRoom = Array.from(room.getAllPieces())
            .map(id => this.allPieces.get(id)?.name)
            .filter(name => name);

        let exits = room.getExits();
        for(let ex in exits) {
            exits[ex] = this.worldMap.get(exits[ex]).getName();
        }

        const roomData = {
            roomName: room.getName(),
            description: room.getDescription(),
            players: playersInRoom,
            exits: room.getExits(),
            weapon: room.hasWeapon() ? this.allWeapons.get(room.getWeaponId())?.name : null
        };

        this.outCourier.deliver(
            pieceId,
            GameMsg.createRoomUpdate(pieceId, roomData)
        );
    }

    /**
     * Broadcasts movement notification to affected rooms
     */
    #broadcastMovementNotification(pieceId, playerName, fromRoomId, toRoomId) {
        // Notify players in the origin room that someone left
        this.#broadcastToRoom(fromRoomId, pieceId,
            GameMsg.createPlayerLeave(null, { playerName, reason: 'moved' }));

        // Notify players in the destination room that someone entered
        this.#broadcastToRoom(toRoomId, pieceId,
            GameMsg.createPlayerJoin(null, { playerName }));
    }

    /**
     * Broadcasts search start notification
     */
    #broadcastSearchStart(pieceId, playerName) {
        const piece = this.allPieces.get(pieceId);
        const roomId = piece.getRoomId();
        
        // Notify the searching player
        this.outCourier.deliver(
            pieceId,
            GameMsg.createSearchStart(pieceId, { 
                playerName, 
                isYou: true,
                message: "You are searching... (vulnerable for 2 seconds)"
            })
        );
        
        // Notify other players in the room
        this.#broadcastToRoom(roomId, pieceId,
            GameMsg.createSearchStart(null, { 
                playerName, 
                isYou: false,
                message: `${playerName} is searching and vulnerable to attack!`
            }));
    }

    /**
     * Broadcasts search end notification
     */
    #broadcastSearchEnd(pieceId, playerName, foundWeapon, weapon) {
        const piece = this.allPieces.get(pieceId);
        const roomId = piece.getRoomId();
        
        const searchResult = {
            playerName,
            weaponFound: foundWeapon,
            weapon: weapon ? weapon.name : null,
            weaponDmg: weapon ? weapon.getAttack(): null,
            isYou: true
        };

        // Notify the searching player
        this.outCourier.deliver(
            pieceId,
            GameMsg.createSearchEnd(pieceId, searchResult)
        );
        
        // Notify other players in the room
        searchResult.isYou = false;
        this.#broadcastToRoom(roomId, pieceId,
            GameMsg.createSearchEnd(null, searchResult));
    }

    /**
     * Broadcasts battle start notification
     */
    #broadcastBattleStart(battleId, attackerId, pieces) {
        const attacker = this.allPieces.get(attackerId);
        const roomId = attacker.getRoomId();
        
        const battleData = {
            battleId,
            attacker: attacker.name,
            participants: pieces.map(p => p.name),
            roomName: this.worldMap.get(roomId).getName()
        };

        // Notify all participants
        pieces.forEach(piece => {
            const isParticipant = true;
            this.outCourier.deliver(
                piece.getPieceId(),
                GameMsg.createBattleStart(piece.getPieceId(), { 
                    ...battleData, 
                    isParticipant,
                    isAttacker: piece.getPieceId() === attackerId,
                    defender: piece.name
                })
            );
        });

        // Notify observers in the room
        this.#broadcastToRoom(roomId, pieces.map(p => p.getPieceId()),
            GameMsg.createBattleStart(null, { 
                ...battleData, 
                isParticipant: false
            }));
    }

    /**
     * Broadcasts battle end notification
     */
    #broadcastBattleEnd(battleId, winnerId, escapeIds, deadIds, participants) {
        const winner = this.allPieces.get(winnerId);
        const roomId = winner.getRoomId();
        const remain = this.allPieces.values()
            .reduce(
                (accum, piece) => piece.getState() !== Piece.STATE.DEAD? 1: 0, 
                0
            );
        const s = remain != 1? 's': '';
        const notS = remain != 1? '': 's';
        
        const battleResult = {
            battleId,
            winner: winner.name,
            escaped: escapeIds.map(id => this.allPieces.get(id).name),
            killed: deadIds.map(id => this.allPieces.get(id).name),
            description: `${winner.name} won the battle! ${remain} player${s} remain${notS}`
        };

        // Notify all participants (alive and dead)
        participants.forEach(piece => {
            this.outCourier.deliver(
                piece.getPieceId(),
                GameMsg.createBattleEnd(piece.getPieceId(), battleResult)
            );
        });

        // Notify observers in the room
        const participantIds = participants.map(p => p.getPieceId());
        this.#broadcastToRoom(roomId, participantIds,
            GameMsg.createBattleEnd(null, battleResult));
    }

    /**
     * Broadcasts message to all players in a room except excluded ones
     */
    #broadcastToRoom(roomId, excludeIds = [], message) {
        const room = this.worldMap.get(roomId);
        if (!room) return;
        
        const excludeArray = Array.isArray(excludeIds) ? excludeIds : [excludeIds];
        
        Array.from(room.getAllPieces())
            .filter(pieceId => !excludeArray.includes(pieceId))
            .forEach(pieceId => {
                // Clone the message and set the correct recipient ID
                const clonedMessage = { ...message };
                clonedMessage.id = pieceId;
                console.log("DEV - =========== SENDING MESSAGE TO: ", this.allPieces.get(pieceId).getName())
                this.outCourier.deliver(pieceId, clonedMessage);
            });
    }

    #broadcastToAll(excludeIds = [], message) {
        const excludeArray = Array.isArray(excludeIds) ? excludeIds : [excludeIds];
        
        Array.from(this.allPieces.keys())
            .filter(pieceId => !excludeArray.includes(pieceId))
            .forEach(pieceId => {
                // Clone the message and set the correct recipient ID
                const clonedMessage = { ...message };
                clonedMessage.id = pieceId;
                console.log("DEV - =========== SENDING MESSAGE TO: ", this.allPieces.get(pieceId).getName())
                this.outCourier.deliver(pieceId, clonedMessage);
            });
    }

    /**
     * Checks win condition and broadcasts game end if applicable
     */
    #checkWinCondition() {
        if (this.remainingPieces <= 1) {
            // Find the last remaining piece
            const alivePieces = Array.from(this.allPieces.values())
                .filter(piece => piece.getState() !== Piece.STATE.DEAD);
            
            if (alivePieces.length === 1 && !this.finished) {
                this.finished = true;
                const winner = alivePieces[0];
                
                // Broadcast game end to all players
                for (const [pieceId, piece] of this.allPieces) {
                    this.outCourier.deliver(
                        pieceId,
                        GameMsg.createGameState(pieceId, {
                            type: 'MATCH_END',
                            winner: winner.name,
                            winnerId: winner.getPieceId(),
                            isWinner: pieceId === winner.getPieceId()
                        })
                    );
                }
            }
        }
    }

    /**
     * Processes a chat message and broadcasts it to players in the same room
     */
    processChatMessage(pieceId, message) {
        const piece = this.allPieces.get(pieceId);
        if (!piece || piece.getState() === Piece.STATE.DEAD) {
            return false;
        }
        
        const roomId = piece.getRoomId();
        const chatData = {
            playerName: piece.name,
            message: message,
            timestamp: Date.now()
        };
        
        // Broadcast to all players in the room
        this.#broadcastToRoom(roomId, [],
            GameMsg.createChatMessage(null, chatData));
        
        return true;
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