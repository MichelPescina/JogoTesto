# Product Requirement Prompt: TestClient

## Overview

Create a terminal-based test client for JogoTesto that replicates all core functionality of the web client using Node.js and Socket.IO. This client will provide a command-line interface suitable for AI agent testing, automated testing scenarios, and manual testing without a web browser. The client must handle real-time communication, room navigation, chat functionality, and provide a modular architecture for easy integration into testing workflows.

## Technical Context

### Current Codebase Status
- **Existing Web Client**: `public/client.js` with 497 lines implementing full Socket.IO functionality
- **Dependencies**: socket.io-client v4.8.1 already in devDependencies, Node.js built-in readline
- **Development Commands**: `npm test` (node:test), `npm run lint` (ESLint)
- **Server Architecture**: Express + Socket.IO server with room system, player management, chat
- **Development Rules**: 500-line file limit, TDD approach, JSDoc documentation, KISS/YAGNI principles

### Existing Client Functionality to Replicate
Based on analysis of `public/client.js`, the terminal client must support:
- **Connection Management**: Connect, disconnect, reconnect with automatic retry
- **Message Types**: Player messages, system messages, Game Master messages, room chat
- **Commands**: `/go <direction>`, `/look`, `/l` for room navigation and inspection
- **Player Tracking**: Connection status, player count, ping monitoring
- **Input Validation**: Message length limits (500 chars), text sanitization
- **Error Handling**: Connection errors, server errors, input validation errors

### Server Socket Events (from `src/server.js`)
- **Outbound**: `playerMessage`, `ping`
- **Inbound**: `connect`, `disconnect`, `messageReceived`, `playerJoined`, `playerLeft`, `playerCount`, `error`, `pong`, `gameMasterMessage`, `roomChatMessage`

## Architecture Blueprint

### Core Client Structure
```javascript
// Terminal client main structure
const { io } = require('socket.io-client');
const readline = require('readline');

class TerminalGameClient {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.isConnected = false;
    this.playerId = null;
    this.rl = null;
    this.pingInterval = null;
  }

  // Connection management
  async connect() { /* Socket.IO connection setup */ }
  disconnect() { /* Clean disconnect */ }
  
  // Input/Output handling
  setupReadlineInterface() { /* Terminal input setup */ }
  displayMessage(message, type) { /* Formatted message display */ }
  
  // Game functionality
  sendMessage(text) { /* Send player message to server */ }
  handleCommand(command) { /* Process game commands */ }
  
  // Event handlers
  setupSocketListeners() { /* All socket event handlers */ }
}
```

### Modular Architecture
```javascript
// Separate modules for clean organization
// src/testClient/
//   ├── index.js           # Main entry point and CLI setup
//   ├── client.js          # Core TerminalGameClient class
//   ├── messageHandler.js  # Message processing and display
//   ├── inputProcessor.js  # Command parsing and validation
//   └── connectionManager.js # Socket.IO connection logic
```

### Readline Interface Setup
```javascript
// Interactive terminal interface using Node.js readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'JogoTesto> '
});

// Handle user input
rl.on('line', (input) => {
  client.handleInput(input.trim());
  rl.prompt();
});

// Graceful shutdown handling
rl.on('SIGINT', () => {
  client.disconnect();
  rl.close();
});
```

### Socket.IO Client Implementation
```javascript
// Connection with automatic reconnection
this.socket = io(this.serverUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  timeout: 20000
});

// Event handling mirroring web client
this.socket.on('connect', () => {
  this.handleConnection();
});

this.socket.on('messageReceived', (data) => {
  this.displayPlayerMessage(data);
});

this.socket.on('gameMasterMessage', (data) => {
  this.displayGameMasterMessage(data);
});
```

## Implementation Roadmap

### Phase 1: Core Terminal Client (Priority: Critical)
1. **Create main client class** (`src/testClient/client.js`)
   - Basic TerminalGameClient class with connection management
   - Socket.IO client initialization and configuration
   - Connection state tracking and error handling

2. **Implement readline interface** (`src/testClient/inputProcessor.js`)
   - Interactive terminal prompt setup
   - Input parsing and command detection
   - Graceful shutdown and signal handling

### Phase 2: Socket Communication (Priority: High)
3. **Replicate socket event handlers** (`src/testClient/connectionManager.js`)
   - All socket events from web client: connect, disconnect, messageReceived, etc.
   - Connection status management and automatic reconnection
   - Ping/pong monitoring for connection health

4. **Implement message handling** (`src/testClient/messageHandler.js`)
   - Display formatting for different message types
   - Player message, system message, GM message, room chat formatting
   - Timestamp formatting and player identification

### Phase 3: Game Functionality (Priority: High)
5. **Add command processing**
   - `/go <direction>` movement commands
   - `/look` and `/l` room inspection commands
   - Default chat message handling for non-commands

6. **Implement input validation**
   - Message length validation (500 character limit)
   - Text sanitization and error handling
   - Command syntax validation

### Phase 4: Testing & AI Integration (Priority: Medium)
7. **Add automation support**
   - Programmatic command execution for AI agents
   - Batch command processing capability
   - Event logging for test verification

8. **Create test scenarios**
   - Connection/disconnection testing
   - Multi-client interaction testing
   - Command validation testing

## Technical References

### Socket.IO Client Documentation
- **Official Client API**: https://socket.io/docs/v4/client-api/
- **Client Installation**: https://socket.io/docs/v4/client-installation/
- **Node.js Client Examples**: https://socket.io/get-started/chat

### Node.js Readline Module
- **Official Documentation**: https://nodejs.org/api/readline.html
- **Interactive CLI Patterns**: https://nodejs.org/en/learn/command-line/accept-input-from-the-command-line-in-nodejs

### AI Agent Testing References
- **Game Testing Automation**: https://www.regression.gg/post/practical-tips-for-implementing-ai-agents-in-games
- **AI Agents in Testing**: https://www.accelq.com/blog/ai-agents-in-software-testing/

### Socket.IO Key Methods for Terminal Client
```javascript
// Connection management
const socket = io("http://localhost:3000");
socket.connect(); // Manual connection
socket.disconnect(); // Manual disconnection

// Event emission and listening
socket.emit("playerMessage", data);
socket.on("messageReceived", (data) => { /* handle */ });

// Connection state
socket.connected; // Boolean connection status
socket.id; // Unique session identifier
```

### Readline Key Methods for Terminal Interface
```javascript
// Interface creation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'JogoTesto> '
});

// Input handling
rl.on('line', (line) => { /* process input */ });
rl.question('Enter command: ', (answer) => { /* handle response */ });
rl.prompt(); // Display prompt
```

## Error Handling Strategy

### Connection Error Management
```javascript
// Robust connection error handling
socket.on('connect_error', (error) => {
  console.error(`Connection error: ${error.message}`);
  this.isConnected = false;
  // Implement retry logic if needed
});

socket.on('disconnect', (reason) => {
  console.log(`Disconnected: ${reason}`);
  this.isConnected = false;
  if (reason === 'io server disconnect') {
    // Server initiated disconnect - don't auto-reconnect
    console.log('Server closed the connection');
  }
});
```

### Input Validation and Error Handling
```javascript
// Message validation before sending
function validateAndSendMessage(text) {
  if (!this.isConnected) {
    console.error('Not connected to server');
    return false;
  }
  
  if (!text || text.trim().length === 0) {
    console.error('Cannot send empty message');
    return false;
  }
  
  if (text.length > 500) {
    console.error('Message too long (max 500 characters)');
    return false;
  }
  
  // Send validated message
  this.socket.emit('playerMessage', {
    text: text.trim(),
    timestamp: new Date().toISOString()
  });
  return true;
}
```

### Terminal Interface Error Handling
```javascript
// Graceful shutdown and signal handling
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  if (this.socket && this.isConnected) {
    this.socket.disconnect();
  }
  if (this.rl) {
    this.rl.close();
  }
  process.exit(0);
});

// Handle readline errors
rl.on('error', (error) => {
  console.error('Readline error:', error);
});
```

## File Structure
```
src/
  └── testClient/
      ├── index.js              # CLI entry point and argument parsing
      ├── client.js             # Main TerminalGameClient class
      ├── connectionManager.js  # Socket.IO connection and event handling
      ├── messageHandler.js     # Message formatting and display
      ├── inputProcessor.js     # Command parsing and validation
      └── config.js             # Client configuration and constants
tests/
  └── testClient/
      ├── client.test.js        # Unit tests for main client class
      ├── connection.test.js    # Connection management tests
      ├── commands.test.js      # Command processing tests
      └── integration.test.js   # Integration tests with real server
```

## Validation Gates

### 1. Code Quality and Standards
```bash
# Lint check - must pass
npm run lint

# Run all tests - must pass
npm test

# Check file length limits - all files must be under 500 lines
find src/testClient -name "*.js" -exec wc -l {} \; | awk '$1 > 500 {print "File " $2 " exceeds 500 lines (" $1 " lines)"}'
```

### 2. Basic Functionality Test
```bash
# Start server in one terminal
npm start

# Run test client in another terminal  
node src/testClient/index.js

# Should display:
# - "Connecting to JogoTesto server..."
# - "Connected! Type /help for commands"
# - "JogoTesto> " prompt
```

### 3. Connection and Communication Test
```bash
# Manual test steps with server running:
# 1. Start test client: node src/testClient/index.js
# 2. Verify connection message appears
# 3. Type "hello world" and press Enter
# 4. Open web client at http://localhost:3000
# 5. Verify message appears in web client
# 6. Send message from web client
# 7. Verify message appears in terminal client
```

### 4. Game Command Test
```bash
# Manual command validation:
# 1. Connect terminal client
# 2. Type "/look" - should display current room description
# 3. Type "/go north" - should attempt movement (may fail if no exit)
# 4. Type "/go invalidDirection" - should display error message
# 5. Verify all outputs are properly formatted
```

### 5. Multi-Client Integration Test
```bash
# Test multiple terminal clients:
# 1. Start server: npm start
# 2. Start first terminal client: node src/testClient/index.js
# 3. Start second terminal client in another terminal
# 4. Send messages from each client
# 5. Verify both clients receive all messages
# 6. Test movement commands from both clients
# 7. Verify room-based chat works correctly
```

### 6. Automated Test Suite
```bash
# Run integration tests with real server
npm test -- --grep "testClient"

# Tests should cover:
# - Connection establishment and cleanup
# - Message sending and receiving
# - Command processing
# - Error handling scenarios
# - Graceful shutdown
```

## Success Criteria

### Functional Requirements
- [x] Terminal client connects to JogoTesto server via Socket.IO
- [x] Interactive command-line interface using readline
- [x] All message types displayed correctly (player, system, GM, room chat)
- [x] Movement commands (`/go`, `/look`) function identically to web client
- [x] Chat messages sent and received in real-time
- [x] Multiple terminal clients can connect simultaneously
- [x] Graceful connection/disconnection handling
- [x] Input validation and error messages

### Technical Requirements
- [x] Uses socket.io-client v4.8.1 (already in devDependencies)
- [x] Modular architecture with files under 500 lines each
- [x] JSDoc documentation for all public methods
- [x] Error-first callbacks and proper async handling
- [x] TDD approach with comprehensive test coverage
- [x] Follows KISS and YAGNI principles

### AI Agent Integration Requirements
- [x] Programmatic interface for automated command execution
- [x] Event logging for test verification and debugging
- [x] Batch command processing capability
- [x] Clean separation between UI and game logic
- [x] Easy integration into testing frameworks

### Performance Requirements
- [x] Sub-second response time for all commands
- [x] Stable connection under normal network conditions
- [x] Automatic reconnection on connection drops
- [x] Memory efficient (no memory leaks during extended use)
- [x] Multiple concurrent instances supported

## Implementation Priority

1. **Critical**: Core terminal client class and Socket.IO connection
2. **Critical**: Readline interface and input processing
3. **High**: Socket event handlers replicating web client functionality
4. **High**: Message display formatting and handling
5. **High**: Game command processing (`/go`, `/look`, chat)
6. **Medium**: Input validation and error handling
7. **Medium**: Automation support for AI agent integration
8. **Medium**: Comprehensive testing and integration tests
9. **Low**: Advanced features (command history, configuration options)
10. **Low**: Performance optimizations and monitoring

## Risk Mitigation

### Known Issues and Solutions
- **Socket.IO Version Compatibility**: Using exact same version (4.8.1) as server ensures compatibility
- **Terminal Display Issues**: Use ANSI escape codes sparingly, focus on clean text output
- **Input Parsing Complexity**: Keep command parsing simple, follow existing web client patterns
- **Connection State Management**: Mirror web client's connection handling exactly
- **Multi-Instance Conflicts**: Each client instance manages its own socket connection

### Development Guidelines
- **Follow CLAUDE.md Rules**: File size limits, JSDoc comments, error-first callbacks
- **Test-Driven Development**: Write tests before implementation for all core functionality
- **Modular Design**: Separate concerns into focused modules for maintainability
- **Error Handling**: Comprehensive error handling at every level (network, input, game logic)
- **AI Agent Considerations**: Design with automation in mind from the start

### Integration Challenges
- **Server Compatibility**: Ensure all socket events match server expectations exactly
- **Message Format Consistency**: Use identical message formats as web client
- **Command Syntax**: Maintain exact command syntax compatibility
- **State Synchronization**: Keep client state in sync with server state

## Confidence Score: 9/10

This PRP provides comprehensive context for one-pass implementation including:
- ✅ **Complete codebase analysis**: Detailed examination of existing client and server code
- ✅ **Proven technology stack**: socket.io-client and readline are well-established, documented technologies
- ✅ **Clear architecture blueprint**: Modular design with specific code examples
- ✅ **Detailed implementation roadmap**: Phase-by-phase development plan with clear priorities
- ✅ **Executable validation gates**: Specific commands and manual tests to verify functionality
- ✅ **Comprehensive error handling**: Covers network, input, and application-level errors
- ✅ **External research integration**: Incorporates best practices from Socket.IO docs and terminal CLI patterns
- ✅ **AI agent considerations**: Designed specifically for AI testing scenarios
- ✅ **Risk mitigation strategies**: Addresses known compatibility and implementation challenges

The implementation should succeed in one pass given the thorough codebase analysis, proven technology choices, detailed technical context, and clear validation criteria. The only minor risk is the complexity of replicating all web client functionality, but the modular approach and existing code patterns significantly reduce this risk.