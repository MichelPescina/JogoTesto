/**
 * GameClient.js - Socket.IO client for JogoTesto game interface
 * Handles real-time game communication and integrates with Terminal.js
 */

// Initialize Socket.IO connection with session authentication
const gameSocket = io({
    auth: {
        sessionId: sessionStorage.sessionId
    }
});

// Game client state
const gameState = {
    playerId: null,
    matchId: null,
    currentRoom: null,
    isInBattle: false,
    isInGracePeriod: false,
    playerList: [],
    terminal: null
};

// DOM elements
const gameElements = {
    terminal: null,
    gameContainer: null,
    statusBar: null
};

/**
 * Initializes the game client elements
 */
function setGameElements() {
    gameElements.gameContainer = document.getElementById('gameContainer');
    gameElements.statusBar = document.getElementById('statusBar');
    
    // Initialize terminal
    if (gameElements.gameContainer) {
        gameState.terminal = new Terminal('gameContainer');
        gameState.terminal.showWelcome();
        gameState.terminal.setInputCallback(handleTerminalInput);
    }
}

/**
 * Handles terminal input from the user
 */
function handleTerminalInput(input) {
    // Parse the input using the same logic as the server
    parseGameCommand(input, (error, command) => {
        if (error) {
            gameState.terminal.showError(error.message);
            return;
        }

        // Send command to server
        gameSocket.emit('gameCommand', command);
        
        // Show local feedback for certain commands
        switch (command.type) {
            case 'MOVE':
                gameState.terminal.showSystemMessage(`Moving ${command.direction}...`);
                break;
            case 'SEARCH':
                gameState.terminal.showSystemMessage('Searching for weapons...');
                break;
            case 'CHAT':
                // Chat will be echoed back from server
                break;
        }
    });
}

/**
 * Parses game command input (simplified version of server logic)
 */
function parseGameCommand(input, callback) {
    if (!input || typeof input !== 'string') {
        return callback(new Error('Input must be a non-empty string'));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return callback(new Error('Input cannot be empty'));
    }

    try {
        // Try to parse as JSON first
        const command = JSON.parse(trimmed);
        callback(null, command);
    } catch (jsonError) {
        // Parse as simple text command
        parseTextCommand(trimmed, callback);
    }
}

/**
 * Parses simple text commands
 */
function parseTextCommand(input, callback) {
    const parts = input.toLowerCase().split(/\s+/);
    const firstWord = parts[0];

    try {
        let command;

        // Movement shortcuts
        if (['north', 'south', 'east', 'west', 'n', 's', 'e', 'w'].includes(firstWord)) {
            const directionMap = { 'n': 'north', 's': 'south', 'e': 'east', 'w': 'west' };
            const direction = directionMap[firstWord] || firstWord;
            command = { type: 'MOVE', direction: direction };
        }
        // Search command
        else if (firstWord === 'search') {
            command = { type: 'SEARCH' };
        }
        // Attack command
        else if (firstWord === 'attack' && parts.length > 1) {
            const targetId = parts[1];
            command = { type: 'ATTACK', targetId: targetId };
        }
        // Help command
        else if (firstWord === 'help') {
            showHelpMessage();
            return;
        }
        // Chat command (everything else)
        else {
            command = { type: 'CHAT', message: input };
        }

        callback(null, command);

    } catch (error) {
        callback(error);
    }
}

/**
 * Shows help message in terminal
 */
function showHelpMessage() {
    gameState.terminal.writeLine('=== COMMANDS ===', 'system');
    gameState.terminal.writeLine('Movement: north, south, east, west (or n, s, e, w)', 'normal');
    gameState.terminal.writeLine('Actions: search (find weapons)', 'normal');
    gameState.terminal.writeLine('Combat: attack <player_name>', 'normal');
    gameState.terminal.writeLine('Chat: Just type your message', 'normal');
    gameState.terminal.writeLine('Help: help', 'normal');
    gameState.terminal.writeLine('===============', 'system');
}

// Socket Event Handlers

/**
 * Handle connection to server
 */
gameSocket.on('connect', () => {
    console.log('Connected to game server:', gameSocket.id);
    if (gameState.terminal) {
        gameState.terminal.showSystemMessage('Connected to game server');
    }
});

/**
 * Handle disconnection from server
 */
gameSocket.on('disconnect', () => {
    console.log('Disconnected from game server');
    if (gameState.terminal) {
        gameState.terminal.showError('Disconnected from game server');
        gameState.terminal.setInputEnabled(false);
    }
});

/**
 * Handle session information
 */
gameSocket.on('session', (session) => {
    sessionStorage.setItem('sessionId', session.sessionId);
    gameState.playerId = session.playerId;
    console.log('Session established:', session);
});

/**
 * Handle successful match join
 */
gameSocket.on('matchJoined', (data) => {
    gameState.matchId = data.matchId;
    gameState.playerId = data.playerId;
    
    if (gameState.terminal) {
        gameState.terminal.showSystemMessage(`Joined match ${data.matchId} as ${data.playerName}`);
        gameState.terminal.showSystemMessage(`Players in match: ${data.playerCount}/${data.maxPlayers}`);
    }
});

/**
 * Handle game state updates
 */
gameSocket.on('gameStateUpdate', (data) => {
    if (gameState.terminal) {
        gameState.terminal.updateGameState(data);
    }
    
    // Update local state
    if (data.room) {
        gameState.currentRoom = data.room;
    }
    if (data.playerList) {
        gameState.playerList = data.playerList;
    }
});

/**
 * Handle room updates
 */
gameSocket.on('roomUpdate', (data) => {
    if (gameState.terminal) {
        gameState.terminal.writeLine(`=== ${data.roomName} ===`, 'game-state');
        gameState.terminal.writeLine(data.description, 'normal');
        
        if (data.players && data.players.length > 0) {
            gameState.terminal.writeLine(`Players here: ${data.players.join(', ')}`, 'normal');
        }
        
        if (data.exits && Object.keys(data.exits).length > 0) {
            gameState.terminal.writeLine(`Exits: ${Object.keys(data.exits).join(', ')}`, 'system');
        }
        
        if (data.weapon) {
            gameState.terminal.writeLine(`A weapon is here: ${data.weapon}`, 'success');
        }
        
        gameState.terminal.writeLine('', 'normal');
    }
});

/**
 * Handle chat messages
 */
gameSocket.on('chatMessage', (data) => {
    if (gameState.terminal) {
        gameState.terminal.showChatMessage(data.playerName, data.message);
    }
});

/**
 * Handle battle start
 */
gameSocket.on('battleStart', (data) => {
    gameState.isInBattle = true;
    
    if (gameState.terminal) {
        gameState.terminal.showBattleMessage('=== BATTLE STARTED ===', true);
        gameState.terminal.showBattleMessage(`${data.attacker} is attacking ${data.defender}!`, true);
        
        if (data.isParticipant) {
            gameState.terminal.showBattleMessage('You are in this battle! Choose your action:', true);
            gameState.terminal.setInputPlaceholder('Enter: attack or escape');
        } else {
            gameState.terminal.showBattleMessage('You are watching this battle.', false);
        }
    }
});

/**
 * Handle battle end
 */
gameSocket.on('battleEnd', (data) => {
    gameState.isInBattle = false;
    
    if (gameState.terminal) {
        gameState.terminal.showBattleMessage('=== BATTLE ENDED ===', true);
        gameState.terminal.showBattleMessage(`Winner: ${data.winner}`, true);
        gameState.terminal.showBattleMessage(`Result: ${data.description}`, false);
        gameState.terminal.setInputPlaceholder('Enter command (w/a/s/d to move, search, or chat)');
    }
});

/**
 * Handle search start
 */
gameSocket.on('searchStart', (data) => {
    if (gameState.terminal) {
        gameState.terminal.showSystemMessage(`${data.playerName} started searching...`);
        if (data.isYou) {
            gameState.terminal.showSystemMessage('You are vulnerable while searching!');
            gameState.terminal.setInputEnabled(false);
        }
    }
});

/**
 * Handle search end
 */
gameSocket.on('searchEnd', (data) => {
    if (gameState.terminal) {
        if (data.weaponFound) {
            gameState.terminal.showSystemMessage(`${data.playerName} found a ${data.weapon}!`, 'success');
        } else {
            gameState.terminal.showSystemMessage(`${data.playerName} found nothing.`, 'warning');
        }
        
        if (data.isYou) {
            gameState.terminal.setInputEnabled(true);
        }
    }
});

/**
 * Handle grace period updates
 */
gameSocket.on('gracePeriod', (data) => {
    gameState.isInGracePeriod = data.active;
    
    if (gameState.terminal) {
        if (data.active) {
            gameState.terminal.showSystemMessage(`Grace period: ${data.timeRemaining} seconds remaining`, 'warning');
        } else {
            gameState.terminal.showSystemMessage('Grace period ended - combat is now allowed!', 'success');
        }
    }
});

/**
 * Handle player join notifications
 */
gameSocket.on('playerJoined', (data) => {
    if (gameState.terminal) {
        gameState.terminal.showSystemMessage(`${data.playerName} joined the game`, 'system');
    }
});

/**
 * Handle player leave notifications
 */
gameSocket.on('playerLeft', (data) => {
    if (gameState.terminal) {
        gameState.terminal.showSystemMessage(`${data.playerName} left the game`, 'system');
    }
});

/**
 * Handle error messages
 */
gameSocket.on('gameError', (data) => {
    if (gameState.terminal) {
        gameState.terminal.showError(data.message);
    }
});

/**
 * Handle match end
 */
gameSocket.on('matchEnd', (data) => {
    if (gameState.terminal) {
        gameState.terminal.writeLine('='.repeat(50), 'success');
        gameState.terminal.writeLine('MATCH ENDED!', 'success');
        gameState.terminal.writeLine(`Winner: ${data.winner}`, 'success');
        gameState.terminal.writeLine('='.repeat(50), 'success');
        gameState.terminal.setInputEnabled(false);
    }
});

/**
 * Handle match countdown
 */
gameSocket.on('matchCountdown', (data) => {
    if (gameState.terminal) {
        gameState.terminal.showSystemMessage(`Match starting in ${data.seconds} seconds...`, 'warning');
    }
});

/**
 * Handle match start
 */
gameSocket.on('matchStart', (data) => {
    if (gameState.terminal) {
        gameState.terminal.showSystemMessage('MATCH STARTED!', 'success');
        gameState.terminal.showSystemMessage('Grace period is active - no combat for 60 seconds', 'warning');
        gameState.terminal.setInputEnabled(true);
    }
});

/**
 * Sets all game callbacks and initializes components
 */
function setGameCallbacks() {
    // Any additional callbacks can be set here
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && gameState.terminal) {
            gameState.terminal.inputElement.focus();
        }
    });
}

/**
 * Initialize the game client
 */
const initGameClient = () => {
    setGameElements();
    setGameCallbacks();
    
    console.log('Game client initialized');
};

/**
 * Initialize when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', initGameClient);

// Expose game state for debugging
window.gameState = gameState;
window.gameSocket = gameSocket;