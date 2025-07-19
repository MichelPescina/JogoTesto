/**
 * Message Handler for Terminal Game Client
 * Handles formatting and display of all message types received from the server
 */

const { MESSAGE_TYPES, COLORS } = require('./config');

/**
 * MessageHandler class manages message formatting and display
 */
class MessageHandler {
  /**
   * Initialize the message handler
   * @param {Object} options - Configuration options
   * @param {boolean} options.useColors - Whether to use terminal colors
   * @param {number} options.maxHistory - Maximum messages to keep in history
   */
  constructor(options = {}) {
    this.useColors = options.useColors !== false; // Default to true
    this.maxHistory = options.maxHistory || 500;
    this.messageHistory = [];
  }

  /**
   * Display a player message in the terminal
   * Replicates the web client's displayPlayerMessage functionality
   * @param {Object} data - Message data from server
   * @param {string} data.playerId - ID of the player who sent the message
   * @param {string} data.text - Message text
   * @param {string} data.timestamp - ISO timestamp
   * @param {string} currentPlayerId - Current player's ID for self-identification
   */
  displayPlayerMessage(data, currentPlayerId) {
    if (!data || !data.text) {
      console.error('Invalid player message data');
      return;
    }

    const isOwnMessage = data.playerId === currentPlayerId;
    const playerName = isOwnMessage ? 'You' : `Player ${data.playerId.substring(0, 8)}`;
    const timestamp = this.formatTimestamp(data.timestamp);
    
    let formattedMessage;
    if (this.useColors) {
      const nameColor = isOwnMessage ? COLORS.GREEN : COLORS.CYAN;
      const timeColor = COLORS.DIM;
      formattedMessage = `${nameColor}${playerName}${COLORS.RESET} ${timeColor}[${timestamp}]${COLORS.RESET}: ${data.text}`;
    } else {
      formattedMessage = `${playerName} [${timestamp}]: ${data.text}`;
    }

    this.outputMessage(formattedMessage, MESSAGE_TYPES.PLAYER);
  }

  /**
   * Display a system message in the terminal
   * Replicates the web client's addSystemMessage functionality
   * @param {string} text - System message text
   * @param {string} type - Message type (system, error, join, leave)
   */
  displaySystemMessage(text, type = MESSAGE_TYPES.SYSTEM) {
    if (!text) {
      return;
    }

    const timestamp = this.formatTimestamp(new Date().toISOString());
    let formattedMessage;

    if (this.useColors) {
      let color = COLORS.YELLOW; // Default system color
      
      switch (type) {
      case MESSAGE_TYPES.ERROR:
        color = COLORS.RED;
        break;
      case MESSAGE_TYPES.JOIN:
        color = COLORS.GREEN;
        break;
      case MESSAGE_TYPES.LEAVE:
        color = COLORS.MAGENTA;
        break;
      case MESSAGE_TYPES.CONNECTION:
        color = COLORS.BLUE;
        break;
      }

      formattedMessage = `${color}[SYSTEM]${COLORS.RESET} ${COLORS.DIM}[${timestamp}]${COLORS.RESET}: ${text}`;
    } else {
      formattedMessage = `[SYSTEM] [${timestamp}]: ${text}`;
    }

    this.outputMessage(formattedMessage, type);
  }

  /**
   * Display a Game Master message in the terminal
   * Replicates the web client's displayGameMasterMessage functionality
   * @param {Object} data - GM message data from server
   * @param {string} data.text - Message text
   * @param {string} data.timestamp - ISO timestamp
   */
  displayGameMasterMessage(data) {
    if (!data || !data.text) {
      console.error('Invalid Game Master message data');
      return;
    }

    const timestamp = this.formatTimestamp(data.timestamp);
    let formattedMessage;

    if (this.useColors) {
      formattedMessage = `${COLORS.BRIGHT}${COLORS.BLUE}[GAME MASTER]${COLORS.RESET} ${COLORS.DIM}[${timestamp}]${COLORS.RESET}:\n${COLORS.WHITE}${data.text}${COLORS.RESET}`;
    } else {
      formattedMessage = `[GAME MASTER] [${timestamp}]:\n${data.text}`;
    }

    this.outputMessage(formattedMessage, MESSAGE_TYPES.GAME_MASTER);
  }

  /**
   * Display a room chat message in the terminal
   * Replicates the web client's displayRoomChatMessage functionality
   * @param {Object} data - Room chat message data from server
   * @param {string} data.text - Message text
   * @param {string} data.timestamp - ISO timestamp
   * @param {boolean} data.isSelf - Whether this is from the current player
   */
  displayRoomChatMessage(data) {
    if (!data || !data.text) {
      console.error('Invalid room chat message data');
      return;
    }

    const timestamp = this.formatTimestamp(data.timestamp);
    let formattedMessage;

    if (this.useColors) {
      const chatColor = data.isSelf ? COLORS.GREEN : COLORS.CYAN;
      formattedMessage = `${chatColor}[ROOM CHAT]${COLORS.RESET} ${COLORS.DIM}[${timestamp}]${COLORS.RESET}: ${data.text}`;
    } else {
      formattedMessage = `[ROOM CHAT] [${timestamp}]: ${data.text}`;
    }

    this.outputMessage(formattedMessage, MESSAGE_TYPES.ROOM_CHAT);
  }

  /**
   * Display connection status messages
   * @param {string} status - Connection status (connected, connecting, disconnected)
   * @param {string} details - Additional details about the connection
   */
  displayConnectionStatus(status, details = '') {
    let message;
    let color = COLORS.YELLOW;

    switch (status) {
    case 'connected':
      message = 'Connected to JogoTesto server!';
      color = COLORS.GREEN;
      break;
    case 'connecting':
      message = 'Connecting to JogoTesto server...';
      color = COLORS.YELLOW;
      break;
    case 'disconnected':
      message = 'Disconnected from server';
      color = COLORS.RED;
      break;
    case 'reconnecting':
      message = `Reconnecting... ${details}`;
      color = COLORS.YELLOW;
      break;
    default:
      message = `Connection status: ${status}`;
    }

    if (details && status !== 'reconnecting') {
      message += ` - ${details}`;
    }

    if (this.useColors) {
      console.log(`${color}${message}${COLORS.RESET}`);
    } else {
      console.log(message);
    }
  }

  /**
   * Display error messages with appropriate formatting
   * @param {string} errorMessage - Error message to display
   * @param {Error} error - Optional error object for additional details
   */
  displayError(errorMessage, error = null) {
    let fullMessage = errorMessage;
    
    if (error && error.message) {
      fullMessage += `: ${error.message}`;
    }

    if (this.useColors) {
      console.error(`${COLORS.RED}[ERROR]${COLORS.RESET} ${fullMessage}`);
    } else {
      console.error(`[ERROR] ${fullMessage}`);
    }
  }

  /**
   * Display player count updates
   * @param {Object} data - Player count data from server
   * @param {number} data.count - Current player count
   */
  displayPlayerCount(data) {
    if (!data || typeof data.count !== 'number') {
      return;
    }

    const message = `Players online: ${data.count}`;
    
    if (this.useColors) {
      console.log(`${COLORS.DIM}${message}${COLORS.RESET}`);
    } else {
      console.log(message);
    }
  }

  /**
   * Display help information
   * @param {string} helpText - Help text to display
   */
  displayHelp(helpText) {
    if (this.useColors) {
      console.log(`${COLORS.CYAN}${helpText}${COLORS.RESET}`);
    } else {
      console.log(helpText);
    }
  }

  /**
   * Output a message to the terminal and add to history
   * @param {string} message - Formatted message to output
   * @param {string} type - Message type for history tracking
   */
  outputMessage(message, type) {
    console.log(message);
    
    // Add to message history
    this.messageHistory.push({
      message,
      type,
      timestamp: new Date().toISOString()
    });

    // Limit history size
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }
  }

  /**
   * Format timestamp for display (replicates web client formatTimestamp)
   * @param {string} timestamp - ISO timestamp string
   * @returns {string} Formatted timestamp (HH:MM format)
   */
  formatTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_error) {
      return 'N/A';
    }
  }

  /**
   * Clear the terminal screen (optional utility)
   */
  clearScreen() {
    console.clear();
  }

  /**
   * Get message history for debugging or testing
   * @returns {Array} Array of message history objects
   */
  getMessageHistory() {
    return [...this.messageHistory];
  }

  /**
   * Clear message history
   */
  clearHistory() {
    this.messageHistory = [];
  }

  /**
   * Set color usage preference
   * @param {boolean} useColors - Whether to use terminal colors
   */
  setColorUsage(useColors) {
    this.useColors = useColors;
  }
}

module.exports = MessageHandler;