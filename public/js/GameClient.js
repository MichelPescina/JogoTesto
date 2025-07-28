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

const keyboardModeMsg = '[w][a][s][d] move, [s] search, [t] chat';
const terminalModeMsg = 'Enter a message or /help - Press [esc] to exit chat';
const resToAttackMsg = 'Press [1] to attack or [3] to escape';

// Game client state
const gameState = {
    playerId: null,
    matchId: null,
    battleId: null,
    currentRoom: null,
    isInBattle: false,
    isInGracePeriod: false,
    playerList: [],
    terminal: null,
    inputMode: null
};

// DOM elements
const gameElements = {
    terminal: null,
    gameContainer: null,
    statusConn: null,
    statusPlayer: null,
    statusAttack: null,
    statusWeapon: null,
};

/**
 * Initializes the game client elements
 */
function setGameElements() {
    gameElements.gameContainer = document.getElementById('gameContainer');
    gameElements.statusConn = document.getElementById('connectionStatus');
    gameElements.statusPlayer = document.getElementById('playerName');
    gameElements.statusAttack = document.getElementById('playerAttack');
    gameElements.statusWeapon = document.getElementById('playerWeapon');
    
    // Initialize terminal
    if (gameElements.gameContainer) {
        gameState.terminal = new Terminal('gameContainer');
        gameState.terminal.showWelcome();
        gameState.terminal.setInputCallback(handleTerminalInput);
        gameState.terminal.setInputEnabled(false);
        gameState.terminal.setInputPlaceholder(keyboardModeMsg);
        gameState.inputMode = 'Keyboard';
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
        
        showLocalFeedback(command);
    });
}

function showLocalFeedback (command) {
    if (!command) return;
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

    parseTextCommand(trimmed, callback);
}

/**
 * Parses simple text commands (only chat)
 */
function parseTextCommand(input, callback) {
    const parts = input.toLowerCase().split(/\s+/);
    const firstWord = parts[0];

    try {
        let command;

        // Help command
        if (firstWord === '/help') {
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
    gameState.terminal.writeLine('=== Controls ===', 'warning');
    gameState.terminal.writeLine('Movement: [W] north, [S] south, [D] east, [A] west', 'normal');
    gameState.terminal.writeLine('[E] Search (find weapons)', 'normal');
    gameState.terminal.writeLine('[Espace] Attack', 'normal');
    gameState.terminal.writeLine('[T] Enable Chat', 'normal');
    gameState.terminal.writeLine('[T] Disable Chat', 'normal');
    gameState.terminal.writeLine('Help: in chat write /help', 'normal');
    gameState.terminal.writeLine('================', 'warning');
}


function updateStatusConn (connected) {
    if (connected) {
        gameElements.statusConn.textContent = 'Connected';
		gameElements.statusConn.className = 'status-connected';
    }
    else {
        gameElements.statusConn.textContent = 'Disconnected';
		gameElements.statusConn.className = 'status-disconnected';
    }
}

function setPlayerStatus (player, attack, weapon) {
    gameElements.statusPlayer.textContent = player || 'Loading...';
	gameElements.statusAttack.textContent = `${attack}` || '1';
    gameElements.statusAttack.textContent = weapon || 'None';
}
// Socket Event Handlers

/**
 * Handle connection to server
 */
gameSocket.on('connect', () => {
    console.log('Connected to game server:', gameSocket.id);
    updateStatusConn(true);
    if (gameState.terminal) {
        gameState.terminal.showSystemMessage('Connected to game server');
    }
});

/**
 * Handle disconnection from server
 */
gameSocket.on('disconnect', () => {
    console.log('Disconnected from game server');
    updateStatusConn(false);
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
    setPlayerStatus(sessionStorage.playerName);
    gameState.playerId = sessionStorage.playerId;
    gameState.matchId = sessionStorage.matchId;
    console.log('Session established:', session);
});

/**
 * Handle successful match join
 */
gameSocket.on('matchJoined', (data) => {
    console.log('MATCH JOINED', data);
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
        
        if (data.exits && Object.keys(data.exits).length > 0) {
            for (let exit in data.exits) {
                gameState.terminal.writeLine(`To the ${exit}: ${data.exits[exit]}`, 'normal');
            }
        }

        if (data.players && data.players.length > 0) {
            gameState.terminal.writeLine(`Players here: ${data.players.join(', ')}`, 'normal');
        }
        
        if (data.weapon) {
            gameState.terminal.writeLine(`There is something hidden here...`, 'success');
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
    gameState.battleId = data.battleId;
    
    if (gameState.terminal) {
        gameState.terminal.showBattleMessage('=== BATTLE STARTED ===', false);
        gameState.terminal.writeLine(`${data.attacker} is attacking ${data.defender}!`);
        
        if (data.isParticipant) {
            if (data.isAttacker) {
                gameState.terminal.writeLine("Wait for the other players responses!");
            }
            else {
                gameState.terminal.writeLine('You are being attacked! Choose your action:');
                gameState.terminal.writeLine('Press [1] to attack or [3] to try to escape', 'warning');
                gameState.terminal.setInputPlaceholder(resToAttackMsg);
            }
            gameState.terminal.setInputEnabled(false);
        } else {
            gameState.terminal.showBattleMessage('You are watching this battle.', false);
        }
    }
});

/**
 * Handle battle timer message
 */
gameSocket.on('battleTimer', (data) => {
    if (gameState.isInBattle) {
        gameState.terminal.writeLine(data.message, 'alert');
    }
});

/**
 * Handle battle end
 */
gameSocket.on('battleEnd', (data) => {
    gameState.isInBattle = false;
    gameState.battleId = null;
    let name = sessionStorage.playerName;
    
    if (gameState.terminal) {
        gameState.terminal.showBattleMessage('=== BATTLE ENDED ===', false);
        gameState.terminal.showBattleMessage(`Winner: ${data.winner}`, true);
        gameState.terminal.showBattleMessage(`Result: ${data.description}`, true);
        gameState.terminal.setInputPlaceholder(keyboardModeMsg);
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
        }
    }
});

/**
 * Handle search end
 */
gameSocket.on('searchEnd', (data) => {
    console.log(data);
    if (gameState.terminal) {
        if (data.weaponFound) {
            gameState.terminal.showSystemMessage(`${data.playerName} found a ${data.weapon}!`, 'system');
        } else {
            gameState.terminal.showSystemMessage(`${data.playerName} found nothing.`, 'system');
        }
        if (data.isYou) {
            if (data.weaponFound) {
                setPlayerStatus(sessionStorage.playerName, 1 + data.weaponDmg, data.weapon);
                gameState.terminal.writeLine(`You found a ${data.weapon}!`, 'success');
            }
            else {
                gameState.terminal.writeLine(`${data.playerName} found nothing.`, 'warning');
            }
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
            //gameState.terminal.showSystemMessage(`Grace period: ${data.timeRemaining} seconds remaining`, 'warning');
            gameState.terminal.showSystemMessage(data.message, 'warning');
        } else {
            gameState.terminal.showSystemMessage(data.message, 'success');
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
 * Handle player death notifications
 */
gameSocket.on('playerDead', (data) => {
    if (gameState.terminal) {
        gameState.terminal.writeLine(data, 'alert');
    }
});

/**
 * Handle player leave notifications
 */
gameSocket.on('playerLeft', (data) => {
    if (gameState.terminal) {
        switch (data.reason) {
            case 'moved':
                gameState.terminal.writeLine(`${data.playerName} left the location`);
                break;
            case 'escaped':
                gameState.terminal.writeLine(`${data.playerName} escaped to safety!`);
                break;
            default:
                gameState.terminal.showSystemMessage(`${data.playerName} left the game`, 'system');
                break;
        }
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
        gameState.terminal.showSystemMessage('Grace period is active - no combat for 30 seconds', 'warning');
        gameState.terminal.setInputEnabled(true);
    }
});

/**
 * Sets up event listeners for keyboard input
 */
function setupKeyboardListener() {
    document.addEventListener('keydown', (event) => {
        let command = null;
        if (gameState.inputMode === 'Keyboard') {
            switch (event.key.toLowerCase()) {
                case 'w':
                    command = { type: 'MOVE', direction: 'north' };
                    break;
                case 's':
                    command = { type: 'MOVE', direction: 'south' };
                    break;
                case 'a':
                    command = { type: 'MOVE', direction: 'west' };
                    break;
                case 'd':
                    command = { type: 'MOVE', direction: 'east' };
                    break;
                case 'e':
                    command = { type: 'SEARCH' };
                    break;
                case ' ':
                    command = { type: 'ATTACK', targetId: gameState.playerId };
                    break;
                case 't':
                    //// ENABLE CHAT
                    gameState.terminal.setInputPlaceholder(terminalModeMsg);
                    gameState.inputMode = 'Terminal';
                    gameState.terminal.setInputEnabled(true);
                    event.preventDefault();
                    break;
                case '1':
                    if (gameState.isInBattle) {
                        gameState.terminal.writeLine('You decided to ATTACK', 'alert');
                        command = { type: 'RESPOND', battleId: gameState.battleId, decision: 'ATTACK' };
                    }
                    break;
                case '3':
                    if (gameState.isInBattle) {
                        gameState.terminal.writeLine('You decided to ESCAPE', 'alert');
                        command = { type: 'RESPOND', battleId: gameState.battleId, decision: 'ESCAPE' };
                    }
                    break;
            }
        }
        else {
            if (event.key === 'Escape') {
                gameState.terminal.setInputPlaceholder(keyboardModeMsg);
                gameState.inputMode = 'Keyboard';
                gameState.terminal.setInputEnabled(false);
            }
        }
        emitKeyboardCommand(command);
        showLocalFeedback(command);
    });
}

function emitKeyboardCommand (command) {
    console.log(command);
    if (!command) return false;
    gameSocket.emit('gameCommand', command);
}

/**
 * Sets all game callbacks and initializes components
 */
function setGameCallbacks() {
    // Any additional callbacks can be set here
    setupKeyboardListener();
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