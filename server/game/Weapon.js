class Weapon {
    constructor (weaponId, contents) {
        this.weaponId = weaponId;
        this.attack = contents.attack;
        this.spawnChance = contents.spawnChance;
    }

    getAttack() {
        return this.attack;
    }
}

module.exports = Weapon;