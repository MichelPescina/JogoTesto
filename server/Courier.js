/**
 * Delivers a message to a function based on an address (like in real life).
 */
class Courier {
    constructor () {
        this.addressToMethod = new Map();
    }

    setAddress (address, deliveryFunc) {
        this.addressToMethod.set(address, deliveryFunc);
    }

    deliver(address, msg) {
        console.log(this.addressToMethod);
        console.log('Passing through: ', address);
        let func = this.addressToMethod.get(address);
        console.log(func);
        if (func) func(msg);
        else {
            console.log(address);
            throw new Error('Courier: Invalid address or function');
        }
    }

}

module.exports = Courier;
/*
let c1 = new Courier();
let c2 = new Courier();

c1.setAdress('premiau', (msg) => console.log(msg));
c2.setAdress('miau', (msg) => c1.deliver(msg.address, msg.msg));
c2.deliver('miau', {address: 'premiau', msg: 'holo'});
*/