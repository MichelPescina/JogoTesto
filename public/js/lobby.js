const socket = io({
    auth: {
        sessionId: localStorage.sessionId,
        creationDate: localStorage.creationDate
    }
});

// All elements that will be used in this page
const elems = {
    playerForm: null,
    playerName: null
};

/**
 * Initializes the elements that will be used during the script
 */
function setElements() {
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

socket.on('session', (session) => {
    console.log(session);
    // ADD SESSION PERSISTANCE
})

/**
 * Callback for submit operation. Gets the name, retrieves playerId and matchId
 * and sends user to waiting room.
 */
const joinGameHandler = (event) => {
    event.preventDefault();
    const name = elems.playerName.value;
    console.log(name);
}

/**
 * Sets all callbacks
 */
function setCallbacks() {
    elems.playerForm.addEventListener('submit', joinGameHandler);
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