/**
 * GameMsg represents a unidirectional message sent to the client that
 * tells it what to do. The client must reply with a GameComm when action
 * is REPLY.
 */
class GameMsg {
    static BUILD = {
        invalidMove: () =>  `You can't move right now!`,
        invalidDir: (dir) => `You can't go towards ${dir}`,
        otherExit: (otherPiece) => `${otherPiece} left this place!`,
        otherEnter: (otherPiece) => `${otherPiece} just arrived!`,
    }
    static ACTION = {
        SHOW: 'SHOW',       // Show message
        UPDATE: 'UPDATE',   // Update state
        REPLY: 'REPLY',     // Reply to message received
        AWAIT: 'AWAIT',     // Await for a response from the server
        RESUME: 'RESUME'    // Resume the execution
    }

    /**
     * 
     * @param {*} id - The id of the receiver
     * @param {*} action - What action the receiver must do at arrival
     * @param {*} content - The content you want to send
     */
    constructor (id, action, content) {
        this.id = id;
        this.action = action;
        this.content = content;
    }
}

module.exports = GameMsg;