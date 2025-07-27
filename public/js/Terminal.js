/**
 * Terminal.js - Terminal-like interface for JogoTesto game
 * Provides a text-based interface for game interaction with keyboard input handling
 */
class Terminal {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with id '${containerId}' not found`);
        }

        this.lines = [];
        this.maxLines = 100;
        this.inputHistory = [];
        this.historyIndex = -1;
        this.currentInput = '';
        this.inputCallback = null;
        
        this.initializeTerminal();
        this.setupEventListeners();
    }

    /**
     * Initializes the terminal HTML structure
     */
    initializeTerminal() {
        this.container.innerHTML = `
            <div class="terminal-wrapper">
                <div class="terminal-header">
                    <div class="terminal-title">JogoTesto - Battle Royale Terminal</div>
                    <div class="terminal-controls">
                        <span class="terminal-dot red"></span>
                        <span class="terminal-dot yellow"></span>
                        <span class="terminal-dot green"></span>
                    </div>
                </div>
                <div class="terminal-content" id="terminal-content">
                    <div class="terminal-output" id="terminal-output"></div>
                    <div class="terminal-input-line">
                        <span class="terminal-prompt">$</span>
                        <input type="text" class="terminal-input" id="terminal-input" 
                               placeholder="Enter command (w/a/s/d to move, 'search', or chat)">
                    </div>
                </div>
            </div>
        `;

        this.outputElement = document.getElementById('terminal-output');
        this.inputElement = document.getElementById('terminal-input');
        
        // Add terminal-specific styles
        this.addTerminalStyles();
        
        // Focus on input
        this.inputElement.focus();
    }

    /**
     * Adds terminal-specific CSS styles
     */
    addTerminalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .terminal-wrapper {
                background-color: var(--terminal-bg);
                border: 1px solid var(--terminal-border);
                border-radius: 8px;
                height: 90vh;
                width: 90vw;
                margin: 5vh auto;
                display: flex;
                flex-direction: column;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            }

            .terminal-header {
                background-color: var(--terminal-dark-gray);
                border-bottom: 1px solid var(--terminal-border);
                padding: 10px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 8px 8px 0 0;
            }

            .terminal-title {
                color: var(--terminal-white);
                font-weight: bold;
                font-size: 16px;
            }

            .terminal-controls {
                display: flex;
                gap: 8px;
            }

            .terminal-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
            }

            .terminal-dot.red { background-color: var(--terminal-red); }
            .terminal-dot.yellow { background-color: var(--terminal-yellow); }
            .terminal-dot.green { background-color: var(--terminal-green); }

            .terminal-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                padding: 15px;
                overflow: hidden;
            }

            .terminal-output {
                flex: 1;
                overflow-y: auto;
                margin-bottom: 15px;
                line-height: var(--line-height);
            }

            .terminal-input-line {
                display: flex;
                align-items: center;
                gap: 10px;
                border-top: 1px solid var(--terminal-border);
                padding-top: 10px;
            }

            .terminal-prompt {
                color: var(--terminal-green);
                font-weight: bold;
                font-size: var(--font-size);
            }

            .terminal-input {
                flex: 1;
                background: transparent;
                border: none;
                color: var(--terminal-white);
                font-family: var(--font-family);
                font-size: var(--font-size);
                outline: none;
                padding: 5px 0;
            }

            .terminal-input::placeholder {
                color: var(--terminal-gray);
            }

            .terminal-line {
                margin: 2px 0;
                word-wrap: break-word;
            }

            .terminal-line.system {
                color: var(--terminal-cyan);
            }

            .terminal-line.error {
                color: var(--terminal-red);
            }

            .terminal-line.success {
                color: var(--terminal-green);
            }

            .terminal-line.warning {
                color: var(--terminal-yellow);
            }

            .terminal-line.chat {
                color: var(--terminal-white);
            }

            .terminal-line.game-state {
                color: var(--terminal-fg);
                border-left: 3px solid var(--terminal-cyan);
                padding-left: 10px;
                margin: 5px 0;
            }

            .terminal-timestamp {
                color: var(--terminal-gray);
                font-size: 14px;
            }

            /* Scrollbar styling */
            .terminal-output::-webkit-scrollbar {
                width: 8px;
            }

            .terminal-output::-webkit-scrollbar-track {
                background: var(--terminal-dark-gray);
            }

            .terminal-output::-webkit-scrollbar-thumb {
                background: var(--terminal-border);
                border-radius: 4px;
            }

            .terminal-output::-webkit-scrollbar-thumb:hover {
                background: var(--terminal-gray);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Sets up event listeners for keyboard input
     */
    setupEventListeners() {
        this.inputElement.addEventListener('keydown', (event) => {
            switch (event.key) {
                case 'Enter':
                    this.handleInput();
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    this.navigateHistory('up');
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    this.navigateHistory('down');
                    break;
                case 'Tab':
                    event.preventDefault();
                    this.handleTabCompletion();
                    break;
            }
        });

        // Keep input focused
        document.addEventListener('click', () => {
            this.inputElement.focus();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.scrollToBottom();
        });
    }

    /**
     * Handles user input submission
     */
    handleInput() {
        const input = this.inputElement.value.trim();
        
        if (input.length === 0) {
            return;
        }

        // Add to history
        this.inputHistory.push(input);
        if (this.inputHistory.length > 50) {
            this.inputHistory.shift();
        }
        this.historyIndex = -1;

        // Display the input
        this.writeLine(`$ ${input}`, 'system');

        // Process the command
        if (this.inputCallback) {
            this.inputCallback(input);
        }

        // Clear input
        this.inputElement.value = '';
        this.currentInput = '';
    }

    /**
     * Navigates through input history
     */
    navigateHistory(direction) {
        if (this.inputHistory.length === 0) return;

        if (direction === 'up') {
            if (this.historyIndex === -1) {
                this.currentInput = this.inputElement.value;
                this.historyIndex = this.inputHistory.length - 1;
            } else if (this.historyIndex > 0) {
                this.historyIndex--;
            }
            this.inputElement.value = this.inputHistory[this.historyIndex];
        } else if (direction === 'down') {
            if (this.historyIndex === -1) return;
            
            this.historyIndex++;
            if (this.historyIndex >= this.inputHistory.length) {
                this.historyIndex = -1;
                this.inputElement.value = this.currentInput;
            } else {
                this.inputElement.value = this.inputHistory[this.historyIndex];
            }
        }
    }

    /**
     * Handles tab completion for commands
     */
    handleTabCompletion() {
        const input = this.inputElement.value.toLowerCase();
        const commands = ['north', 'south', 'east', 'west', 'search', 'attack', 'help'];
        
        const matches = commands.filter(cmd => cmd.startsWith(input));
        if (matches.length === 1) {
            this.inputElement.value = matches[0];
        } else if (matches.length > 1) {
            this.writeLine(`Available: ${matches.join(', ')}`, 'system');
        }
    }

    /**
     * Sets the callback function for input processing
     */
    setInputCallback(callback) {
        this.inputCallback = callback;
    }

    /**
     * Writes a line to the terminal output
     */
    writeLine(text, type = 'normal') {
        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        
        if (type === 'system' || type === 'error') {
            line.innerHTML = `<span class="terminal-timestamp">[${timestamp}]</span> ${text}`;
        } else {
            line.textContent = text;
        }

        this.outputElement.appendChild(line);
        this.lines.push(line);

        // Limit number of lines
        if (this.lines.length > this.maxLines) {
            const oldLine = this.lines.shift();
            oldLine.remove();
        }

        this.scrollToBottom();
    }

    /**
     * Writes multiple lines at once
     */
    writeLines(lines, type = 'normal') {
        lines.forEach(line => this.writeLine(line, type));
    }

    /**
     * Clears the terminal output
     */
    clear() {
        this.outputElement.innerHTML = '';
        this.lines = [];
    }

    /**
     * Scrolls to the bottom of the output
     */
    scrollToBottom() {
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }

    /**
     * Shows a welcome message
     */
    showWelcome() {
        this.writeLine('='.repeat(60), 'system');
        this.writeLine('Welcome to JogoTesto - Battle Royale Terminal!', 'success');
        this.writeLine('='.repeat(60), 'system');
        this.writeLine('');
        this.writeLine('Commands:', 'system');
        this.writeLine('  Movement: north, south, east, west (or n, s, e, w)', 'normal');
        this.writeLine('  Actions: search (to find weapons)', 'normal');
        this.writeLine('  Combat: attack <player> (during battle)', 'normal');
        this.writeLine('  Chat: Type any message to chat with other players', 'normal');
        this.writeLine('  History: Use ↑/↓ arrows to navigate command history', 'normal');
        this.writeLine('  Tab completion: Press Tab to complete commands', 'normal');
        this.writeLine('');
        this.writeLine('Waiting for game to start...', 'warning');
        this.writeLine('');
    }

    /**
     * Updates the game state display
     */
    updateGameState(gameState) {
        this.writeLine('Game State Updated:', 'game-state');
        if (gameState.room) {
            this.writeLine(`Current Room: ${gameState.room.name}`, 'normal');
            this.writeLine(`Description: ${gameState.room.description}`, 'normal');
            
            if (gameState.room.players && gameState.room.players.length > 0) {
                this.writeLine(`Players here: ${gameState.room.players.join(', ')}`, 'normal');
            }
            
            if (gameState.room.weapon) {
                this.writeLine(`Weapon available: ${gameState.room.weapon}`, 'success');
            }
        }
        
        if (gameState.health !== undefined) {
            this.writeLine(`Health: ${gameState.health}`, gameState.health > 50 ? 'success' : 'warning');
        }
        
        if (gameState.weapon) {
            this.writeLine(`Current weapon: ${gameState.weapon}`, 'success');
        }
        
        this.writeLine('');
    }

    /**
     * Shows an error message
     */
    showError(message) {
        this.writeLine(`ERROR: ${message}`, 'error');
    }

    /**
     * Shows a chat message
     */
    showChatMessage(playerName, message) {
        this.writeLine(`<${playerName}> ${message}`, 'chat');
    }

    /**
     * Shows system messages
     */
    showSystemMessage(message) {
        this.writeLine(message, 'system');
    }

    /**
     * Shows battle-related messages
     */
    showBattleMessage(message, isSuccess = true) {
        this.writeLine(message, isSuccess ? 'success' : 'warning');
    }

    /**
     * Enables or disables input
     */
    setInputEnabled(enabled) {
        this.inputElement.disabled = !enabled;
        if (enabled) {
            this.inputElement.focus();
        }
    }

    /**
     * Sets the input placeholder text
     */
    setInputPlaceholder(text) {
        this.inputElement.placeholder = text;
    }
}

// Make Terminal available globally
window.Terminal = Terminal;