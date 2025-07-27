const socket = io({
    auth: {
        sessionId: sessionStorage.sessionId
    }
});

// All elements that will be used in this page
const elems = {
    testButton: null,
    testTerminal: null,
    playerForm: null,
    playerName: null
};

/**
 * Initializes the elements that will be used during the script
 */
function setElements() {
    elems.testTerminal = document.getElementById('testTerminal');
    elems.testButton = document.getElementById('testButton');
    elems.playerForm = document.getElementById('playerForm');
    elems.playerName = document.getElementById('playerName');
}

// Event Callbacks

// Socket callbacks
socket.on('connect', () => {
    console.log(socket.id)
    console.log(socket.sessionId)
    console.log(socket.creationDate)
});

// This saves sessionId in localStorage
socket.on('session', (session) => {
    sessionStorage.setItem('sessionId', session.sessionId);
    console.log(session);
});

socket.on('test', (msg) => {
    elems.testTerminal.innerHtml += `${msg}\n`;
    console.log(msg);
});

/**
 * Callback for submit operation. Gets the name, retrieves playerId and matchId
 * and sends user to waiting room.
 */
const joinGameHandler = (event) => {
    event.preventDefault();
    const name = elems.playerName.value;
    socket.emit('joinMatch', name);
    console.log(name);
}

const testHandler = (event) => {
    socket.emit('testCall', 'lol');
}

/**
 * Sets all callbacks
 */
function setCallbacks() {
    elems.playerForm.addEventListener('submit', joinGameHandler);
    elems.testButton.addEventListener('click', testHandler);
}


/**
 * Callback for initialization of application
 */
const init = () => {
    setElements();
    setCallbacks();
}
/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', init);