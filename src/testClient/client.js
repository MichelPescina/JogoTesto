/**
 * Terminal Game Client for JogoTesto
 * Main client class that orchestrates all components and provides the terminal interface
 */

const readline = require('readline');
const MessageHandler = require('./messageHandler');
const InputProcessor = require('./inputProcessor');
const ConnectionManager = require('./connectionManager');
const { 
  SERVER_CONFIG, 
  TERMINAL_CONFIG, 
  HELP_TEXT 
} = require('./config');

/**
 * TerminalGameClient - Main client class for terminal-based game interaction
 */
class TerminalGameClient {
  /**
   * Initialize the terminal game client
   * @param {Object} options - Configuration options
   * @param {string} options.serverUrl - Server URL to connect to
   * @param {boolean} options.useColors - Whether to use terminal colors
   * @param {boolean} options.autoConnect - Whether to auto-connect on initialization
   */
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || SERVER_CONFIG.DEFAULT_URL;
    this.useColors = options.useColors !== false; // Default to true
    this.autoConnect = options.autoConnect !== false; // Default to true
    
    // Initialize components
    this.messageHandler = new MessageHandler({ 
      useColors: this.useColors,
      maxHistory: TERMINAL_CONFIG.MAX_MESSAGE_HISTORY 
    });
    this.inputProcessor = new InputProcessor();
    this.connectionManager = new ConnectionManager(this.serverUrl, this.messageHandler);
    
    // State management
    this.isRunning = false;
    this.rl = null;
    this.playerId = null;
    this.isConnected = false;
    
    // Batch processing for AI agents
    this.batchMode = false;
    this.batchCommands = [];
    this.batchResults = [];
    
    // Set up connection callbacks
    this.setupConnectionCallbacks();
    
    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Start the terminal client
   * @returns {Promise<boolean>} True if started successfully
   */
  async start() {
    try {
      this.messageHandler.displaySystemMessage('Starting JogoTesto Terminal Client...', 'system');
      
      // Set up readline interface
      this.setupReadlineInterface();
      
      // Connect to server if auto-connect is enabled
      if (this.autoConnect) {
        const connected = await this.connect();
        if (!connected) {
          this.messageHandler.displayError('Failed to connect to server. Type /help for commands.');
        }
      }
      
      this.isRunning = true;
      this.showPrompt();
      
      return true;
    } catch (error) {
      this.messageHandler.displayError('Failed to start client', error);
      return false;
    }
  }

  /**
   * Connect to the game server
   * @returns {Promise<boolean>} True if connected successfully
   */
  async connect() {
    try {
      const success = await this.connectionManager.connect();
      if (success) {
        this.messageHandler.displaySystemMessage('Connected! Type /help for commands.', 'connection');
      }
      return success;
    } catch (error) {
      this.messageHandler.displayError('Connection failed', error);
      return false;
    }
  }

  /**
   * Disconnect from the server
   * @param {boolean} graceful - Whether to disconnect gracefully
   */
  disconnect(graceful = true) {
    this.connectionManager.disconnect(graceful);
    this.messageHandler.displaySystemMessage('Disconnected from server.', 'connection');
  }

  /**
   * Stop the terminal client
   */
  stop() {
    this.isRunning = false;
    
    if (this.isConnected) {
      this.disconnect();
    }
    
    if (this.rl) {
      this.rl.close();
    }
    
    this.messageHandler.displaySystemMessage('Terminal client stopped.', 'system');
  }

  /**
   * Set up readline interface for terminal interaction
   */
  setupReadlineInterface() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: TERMINAL_CONFIG.PROMPT
    });

    // Handle user input
    this.rl.on('line', (input) => {
      this.handleInput(input);
      this.showPrompt();
    });

    // Handle readline close
    this.rl.on('close', () => {
      this.handleExit();
    });

    // Handle SIGINT (Ctrl+C)
    this.rl.on('SIGINT', () => {
      this.handleExit();
    });

    // Handle readline errors
    this.rl.on('error', (error) => {
      this.messageHandler.displayError('Readline error', error);
    });
  }

  /**
   * Handle user input from terminal
   * @param {string} input - Raw input from user
   */
  handleInput(input) {
    try {
      const result = this.inputProcessor.processInput(input);
      
      if (!result.isValid) {
        this.messageHandler.displayError(result.error);
        return;
      }

      // Route based on input type
      switch (result.type) {
      case 'help':
        this.handleHelpCommand();
        break;
          
      case 'exit':
        this.handleExit();
        break;
          
      case 'command':
        this.handleGameCommand(result);
        break;
          
      case 'chat':
        this.handleChatMessage(result.text);
        break;
          
      default:
        this.messageHandler.displayError('Unknown input type');
      }
      
    } catch (error) {
      this.messageHandler.displayError('Error processing input', error);
    }
  }

  /**
   * Handle help command
   */
  handleHelpCommand() {
    this.messageHandler.displayHelp(HELP_TEXT);
  }

  /**
   * Handle game commands (/go, /look, etc.)
   * @param {Object} result - Processed command result from input processor
   */
  handleGameCommand(result) {
    if (!this.isConnected) {
      this.messageHandler.displayError('Not connected to server. Commands require connection.');
      return;
    }

    switch (result.gameCommand) {
    case 'look':
      // Send look command as a /look message
      this.connectionManager.sendPlayerMessage('/look');
      break;
        
    case 'go':
      // Send go command with direction
      this.connectionManager.sendPlayerMessage(`/go ${result.direction}`);
      break;
        
    default:
      this.messageHandler.displayError(`Unknown game command: ${result.command}`);
    }
  }

  /**
   * Handle chat messages
   * @param {string} text - Chat message text
   */
  handleChatMessage(text) {
    if (!this.isConnected) {
      this.messageHandler.displayError('Not connected to server. Cannot send chat messages.');
      return;
    }

    const success = this.connectionManager.sendPlayerMessage(text);
    if (!success) {
      this.messageHandler.displayError('Failed to send chat message');
    }
  }

  /**
   * Handle exit command or SIGINT
   */
  handleExit() {
    this.messageHandler.displaySystemMessage('\nGracefully shutting down...', 'system');
    this.stop();
    process.exit(0);
  }

  /**
   * Show the command prompt
   */
  showPrompt() {
    if (this.rl && this.isRunning) {
      this.rl.prompt();
    }
  }

  /**
   * Set up connection status callbacks
   */
  setupConnectionCallbacks() {
    this.connectionManager.setConnectionStatusCallback((connected) => {
      this.isConnected = connected;
    });
    
    this.connectionManager.setPlayerIdCallback((playerId) => {
      this.playerId = playerId;
    });
  }

  /**
   * Set up graceful shutdown handlers
   */
  setupGracefulShutdown() {
    process.on('SIGINT', () => {
      this.handleExit();
    });
    
    process.on('SIGTERM', () => {
      this.handleExit();
    });
    
    process.on('uncaughtException', (error) => {
      this.messageHandler.displayError('Uncaught exception', error);
      this.handleExit();
    });
    
    process.on('unhandledRejection', (reason, _promise) => {
      this.messageHandler.displayError('Unhandled rejection', new Error(reason));
      this.handleExit();
    });
  }

  // AI Agent Integration Methods

  /**
   * Enable batch mode for AI agent automation
   * @param {boolean} enabled - Whether to enable batch mode
   */
  setBatchMode(enabled) {
    this.batchMode = enabled;
    if (enabled) {
      this.batchCommands = [];
      this.batchResults = [];
    }
  }

  /**
   * Execute a command programmatically (for AI agents)
   * @param {string} command - Command to execute
   * @returns {Promise<Object>} Result of command execution
   */
  async executeCommand(command) {
    return new Promise((resolve) => {
      const result = this.inputProcessor.processInput(command);
      
      if (!result.isValid) {
        resolve({ success: false, error: result.error });
        return;
      }

      // Store original input handler
      const originalHandler = this.handleInput.bind(this);
      
      // Temporarily override to capture result
      this.handleInput = (input) => {
        originalHandler(input);
        resolve({ success: true, result: result });
      };
      
      // Process the command
      this.handleInput(command);
      
      // Restore original handler
      this.handleInput = originalHandler;
    });
  }

  /**
   * Execute multiple commands in batch (for AI agents)
   * @param {Array<string>} commands - Array of commands to execute
   * @returns {Promise<Array>} Array of command results
   */
  async executeBatch(commands) {
    this.setBatchMode(true);
    const results = [];
    
    for (const command of commands) {
      const result = await this.executeCommand(command);
      results.push(result);
      
      // Add delay between commands to avoid overwhelming server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.setBatchMode(false);
    return results;
  }

  /**
   * Get current client status (for AI agents)
   * @returns {Object} Client status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isConnected: this.isConnected,
      playerId: this.playerId,
      serverUrl: this.serverUrl,
      batchMode: this.batchMode,
      connectionStats: this.connectionManager.getConnectionStats()
    };
  }

  /**
   * Get message history (for AI agents)
   * @returns {Array} Array of message history
   */
  getMessageHistory() {
    return this.messageHandler.getMessageHistory();
  }

  /**
   * Clear message history
   */
  clearHistory() {
    this.messageHandler.clearHistory();
  }

  /**
   * Set color usage preference
   * @param {boolean} useColors - Whether to use terminal colors
   */
  setColorUsage(useColors) {
    this.useColors = useColors;
    this.messageHandler.setColorUsage(useColors);
  }

  /**
   * Force reconnection to server
   */
  reconnect() {
    this.messageHandler.displaySystemMessage('Forcing reconnection...', 'connection');
    this.connectionManager.forceReconnect();
  }

  /**
   * Get available commands list
   * @returns {Array<string>} Array of available commands
   */
  getAvailableCommands() {
    return this.inputProcessor.getAvailableCommands();
  }

  /**
   * Get valid directions for movement
   * @returns {Array<string>} Array of valid directions
   */
  getValidDirections() {
    return this.inputProcessor.getValidDirections();
  }
}

module.exports = TerminalGameClient;