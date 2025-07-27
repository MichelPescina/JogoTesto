class Weapon {
    constructor (weaponId, contents) {
        this.weaponId = weaponId;
        this.name = contents.name;
        this.attack = contents.attack;
        this.spawnChance = contents.spawnChance;
    }

    getAttack() {
        return this.attack;
    }
}

module.exports = Weapon;