/**
 * Configuration constants for the Terminal Game Client
 * Contains all configuration values and constants used across the test client
 */

/**
 * Default server configuration
 */
const SERVER_CONFIG = {
  /** Default server URL */
  DEFAULT_URL: 'http://localhost:3000',
  /** Connection timeout in milliseconds */
  CONNECTION_TIMEOUT: 20000,
  /** Reconnection attempts before giving up */
  RECONNECTION_ATTEMPTS: 5,
  /** Delay between reconnection attempts in milliseconds */
  RECONNECTION_DELAY: 1000,
  /** Ping interval for connection monitoring in milliseconds */
  PING_INTERVAL: 5000
};

/**
 * Socket.IO client configuration options
 */
const SOCKET_CONFIG = {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: SERVER_CONFIG.RECONNECTION_DELAY,
  reconnectionAttempts: SERVER_CONFIG.RECONNECTION_ATTEMPTS,
  timeout: SERVER_CONFIG.CONNECTION_TIMEOUT
};

/**
 * Message validation constants
 */
const MESSAGE_CONFIG = {
  /** Maximum message length in characters */
  MAX_MESSAGE_LENGTH: 500,
  /** Minimum message length in characters */
  MIN_MESSAGE_LENGTH: 1
};

/**
 * Terminal interface configuration
 */
const TERMINAL_CONFIG = {
  /** Default command prompt */
  PROMPT: 'JogoTesto> ',
  /** Help command trigger */
  HELP_COMMAND: '/help',
  /** Exit command triggers */
  EXIT_COMMANDS: ['/exit', '/quit', '/q'],
  /** Maximum messages to keep in history */
  MAX_MESSAGE_HISTORY: 500
};

/**
 * Game command constants
 */
const GAME_COMMANDS = {
  /** Movement command prefix */
  GO_COMMAND: '/go',
  /** Look command variations */
  LOOK_COMMANDS: ['/look', '/l'],
  /** Valid movement directions */
  DIRECTIONS: [
    'north', 'south', 'east', 'west',
    'northeast', 'northwest', 'southeast', 'southwest',
    'up', 'down', 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'u', 'd'
  ]
};

/**
 * Message type constants for display formatting
 */
const MESSAGE_TYPES = {
  PLAYER: 'player',
  SYSTEM: 'system',
  ERROR: 'error',
  GAME_MASTER: 'gm',
  ROOM_CHAT: 'roomChat',
  CONNECTION: 'connection',
  JOIN: 'join',
  LEAVE: 'leave'
};

/**
 * Color codes for terminal output (optional, basic colors only)
 */
const COLORS = {
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m'
};

/**
 * Socket event names that the client will handle
 */
const SOCKET_EVENTS = {
  // Outbound events (client to server)
  PLAYER_MESSAGE: 'playerMessage',
  PING: 'ping',
  
  // Inbound events (server to client)
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ATTEMPT: 'reconnect_attempt',
  RECONNECT_FAILED: 'reconnect_failed',
  MESSAGE_RECEIVED: 'messageReceived',
  PLAYER_JOINED: 'playerJoined',
  PLAYER_LEFT: 'playerLeft',
  PLAYER_COUNT: 'playerCount',
  ERROR: 'error',
  PONG: 'pong',
  GAME_MASTER_MESSAGE: 'gameMasterMessage',
  ROOM_CHAT_MESSAGE: 'roomChatMessage'
};

/**
 * Help text for commands
 */
const HELP_TEXT = `
Available commands:
  /help                    - Show this help message
  /look, /l               - Look around the current room
  /go <direction>         - Move in a direction (north, south, east, west, etc.)
  /exit, /quit, /q        - Exit the client
  
  Any other text will be sent as a chat message to other players in your room.
  
Examples:
  /look
  /go north
  /go n
  Hello everyone!
`;

module.exports = {
  SERVER_CONFIG,
  SOCKET_CONFIG,
  MESSAGE_CONFIG,
  TERMINAL_CONFIG,
  GAME_COMMANDS,
  MESSAGE_TYPES,
  COLORS,
  SOCKET_EVENTS,
  HELP_TEXT
};