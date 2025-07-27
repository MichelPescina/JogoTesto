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
    playerName: null,
    statusMessage: null
};

/**
 * Initializes the elements that will be used during the script
 */
function setElements() {
    elems.testTerminal = document.getElementById('testTerminal');
    elems.testButton = document.getElementById('testButton');
    elems.playerForm = document.getElementById('playerForm');
    elems.playerName = document.getElementById('playerName');
    
    // Create status message element if it doesn't exist
    elems.statusMessage = document.getElementById('statusMessage');
    if (!elems.statusMessage) {
        elems.statusMessage = createStatusMessageElement();
    }
}

/**
 * Creates a status message element and inserts it into the page
 */
function createStatusMessageElement() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'statusMessage';
    statusDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 15px 25px;
        border-radius: 5px;
        color: white;
        font-family: var(--font-family);
        font-size: 16px;
        z-index: 1000;
        display: none;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(statusDiv);
    return statusDiv;
}

/**
 * Shows a status message to the user
 * @param {string} message - Message to display
 * @param {string} type - Message type: 'success', 'error', 'info', 'warning'
 */
function showStatusMessage(message, type = 'info') {
    if (!elems.statusMessage) return;
    
    // Set message content
    elems.statusMessage.textContent = message;
    
    // Set styling based on type
    let backgroundColor;
    switch (type) {
        case 'success':
            backgroundColor = 'var(--terminal-green)';
            break;
        case 'error':
            backgroundColor = 'var(--terminal-red)';
            break;
        case 'warning':
            backgroundColor = 'var(--terminal-yellow)';
            break;
        case 'info':
        default:
            backgroundColor = 'var(--terminal-cyan)';
            break;
    }
    
    elems.statusMessage.style.backgroundColor = backgroundColor;
    elems.statusMessage.style.display = 'block';
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        if (elems.statusMessage) {
            elems.statusMessage.style.display = 'none';
        }
    }, 4000);
}

/**
 * Hides the status message
 */
function hideStatusMessage() {
    if (elems.statusMessage) {
        elems.statusMessage.style.display = 'none';
    }
}

// Event Callbacks

// Socket callbacks
socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
    console.log('Session ID:', socket.sessionId);
    console.log('Creation Date:', socket.creationDate);
    
    showStatusMessage('Connected to server!', 'success');
    
    // Request match info on connection
    socket.emit('requestMatchInfo');
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected from server:', reason);
    showStatusMessage('Disconnected from server', 'error');
    
    // Re-enable form if it was disabled
    if (elems.playerForm) {
        const submitButton = elems.playerForm.querySelector('input[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.value = 'Play';
        }
    }
});

socket.on('reconnect', () => {
    console.log('Reconnected to server');
    showStatusMessage('Reconnected to server!', 'success');
});

// This saves sessionId in localStorage
socket.on('session', (session) => {
    sessionStorage.setItem('sessionId', session.sessionId);
    console.log('Session established:', session);
});

socket.on('test', (msg) => {
    if (elems.testTerminal) {
        elems.testTerminal.innerHTML += `${msg}\n`;
    }
    console.log(msg);
});

/**
 * Handle successful match join - navigate to game interface
 */
socket.on('matchJoined', (data) => {
    console.log('Successfully joined match:', data);
    
    // Store match information for the game interface
    sessionStorage.setItem('matchId', data.matchId);
    sessionStorage.setItem('playerId', data.playerId);
    sessionStorage.setItem('playerName', data.playerName);
    
    // Show success message briefly
    showStatusMessage(`Joined match! Redirecting to game...`, 'success');
    
    // Navigate to game interface after a short delay
    setTimeout(() => {
        window.location.href = '/game.html';
    }, 1500);
});

/**
 * Handle match join errors
 */
socket.on('joinError', (error) => {
    console.error('Failed to join match:', error);
    showStatusMessage(`Failed to join: ${error.message}`, 'error');
    
    // Re-enable the form
    if (elems.playerForm) {
        const submitButton = elems.playerForm.querySelector('input[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.value = 'Play';
        }
    }
});

/**
 * Handle match countdown and status updates
 */
socket.on('matchInfo', (matchInfo) => {
    console.log('Match info:', matchInfo);
    
    if (matchInfo.state === 'COUNTDOWN') {
        showStatusMessage(`Match starting soon... (${matchInfo.playerCount}/${matchInfo.maxPlayers} players)`, 'info');
    } else if (matchInfo.state === 'QUEUE') {
        showStatusMessage(`Waiting for players... (${matchInfo.playerCount}/${matchInfo.maxPlayers} players)`, 'info');
    }
});

/**
 * Callback for submit operation. Gets the name, retrieves playerId and matchId
 * and sends user to waiting room.
 */
const joinGameHandler = (event) => {
    event.preventDefault();
    
    const name = elems.playerName.value.trim();
    
    // Validate player name
    if (!name || name.length === 0) {
        showStatusMessage('Please enter a valid player name', 'error');
        return;
    }
    
    if (name.length > 20) {
        showStatusMessage('Player name must be 20 characters or less', 'error');
        return;
    }
    
    // Disable the form to prevent double submission
    const submitButton = event.target.querySelector('input[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.value = 'Joining...';
    }
    
    // Show joining status
    showStatusMessage(`Joining match as "${name}"...`, 'info');
    
    // Send join request
    socket.emit('joinMatch', name);
    console.log('Attempting to join match with name:', name);
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