# Product Requirement Prompt: BasicEngine

## Overview

Create a foundational text-based multiplayer RPG engine using Node.js and Socket.IO that supports approximately 20 concurrent players. The engine consists of a real-time server backend and a web-based client interface that enables players to send text inputs and receive responses, with initial functionality focused on message broadcasting between players.

## Technical Context

### Current Codebase Status
- **Greenfield Project**: No existing source code
- **Dependencies**: Socket.IO v4.8.1, ESLint v9.31.0, dotenv v17.2.0
- **Development Commands**: `npm test` (node:test), `npm run lint` (ESLint)
- **Project Structure**: Root-level package.json, CLAUDE.md guidelines
- **Development Rules**: 500-line file limit, TDD approach, JSDoc documentation, KISS/YAGNI principles

### Technology Stack
- **Backend**: Node.js with Express and Socket.IO v4
- **Frontend**: Basic HTML/CSS/JavaScript web client
- **Communication**: WebSocket-based real-time bidirectional messaging
- **Architecture**: Single-server setup with Socket.IO rooms

## Architecture Blueprint

### Server Architecture
```javascript
// Pseudocode structure
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  pingInterval: 10000,
  pingTimeout: 5000,
  maxHttpBufferSize: 1e6
});

// Serve static client files
app.use(express.static('public'));

// Handle player connections
io.on('connection', (socket) => {
  // Player joins game room
  socket.join('gameRoom');
  
  // Handle text messages
  socket.on('playerMessage', (data) => {
    // Broadcast to all players in room
    io.to('gameRoom').emit('messageReceived', data);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    // Clean up player state
  });
});
```

### Client Architecture
```html
<!-- Basic HTML structure -->
<!DOCTYPE html>
<html>
<head>
    <title>JogoTesto</title>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <div id="messages"></div>
    <input type="text" id="messageInput" placeholder="Enter command...">
    <button onclick="sendMessage()">Send</button>
    
    <script>
        const socket = io();
        
        // Send player input
        function sendMessage() {
            const input = document.getElementById('messageInput');
            socket.emit('playerMessage', {
                text: input.value,
                timestamp: new Date().toISOString()
            });
            input.value = '';
        }
        
        // Receive game messages
        socket.on('messageReceived', (data) => {
            displayMessage(data);
        });
    </script>
</body>
</html>
```

## Implementation Roadmap

### Phase 1: Basic Server Setup
1. **Create main server file** (`src/server.js`)
   - Initialize Express app with Socket.IO
   - Configure static file serving for client
   - Set up basic error handling

2. **Implement connection handling**
   - Player join/leave events
   - Basic room management (single 'gameRoom')
   - Connection logging and player counting

### Phase 2: Client Interface
3. **Create web client** (`public/index.html`, `public/style.css`, `public/client.js`)
   - Simple chat-like interface
   - Text input for player commands
   - Message display area
   - Basic responsive design

### Phase 3: Message Broadcasting
4. **Implement core messaging**
   - Bidirectional text communication
   - Message validation and sanitization
   - Timestamp and player identification
   - Broadcast to all connected players

### Phase 4: Testing & Optimization
5. **Multi-connection testing**
   - Test with multiple browser tabs/windows
   - Verify message delivery to all clients
   - Performance testing with simulated load

## Technical References

### Socket.IO Documentation
- **Official Docs**: https://socket.io/docs/v4/
- **Performance Tuning**: https://socket.io/docs/v4/performance-tuning/
- **Rooms Documentation**: https://socket.io/docs/v3/rooms/

### Key Socket.IO Concepts
- **Bidirectional Communication**: Low-latency, event-based messaging
- **Automatic Reconnection**: Built-in connection resilience
- **Room Broadcasting**: `io.to('roomName').emit()` for targeted messaging
- **Packet Buffering**: Message queuing during network interruptions

### Performance Considerations
- **Concurrent Connection Limits**: 10,000-30,000 per Node.js instance
- **Message Rate**: 10-20 updates/second for smooth gameplay
- **Server Tick Rate**: Maintain >1000 ticks for responsive events
- **20 Player Target**: Well within single-server capacity

### Architecture Patterns from Research
- **Ranvier MUD Engine**: Unopinionated network layer, robust bundle system
- **Room-based Broadcasting**: Use single room for 20 players
- **Event-driven Architecture**: Socket.IO's event-based communication model
- **Stateless Server Design**: Client state management with server validation

## Error Handling Strategy

### Connection Management
```javascript
// Graceful disconnection handling
socket.on('disconnect', (reason) => {
  console.log(`Player disconnected: ${reason}`);
  // Update player count
  // Notify other players if needed
});

// Connection error handling
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

### Input Validation
```javascript
// Message sanitization
socket.on('playerMessage', (data) => {
  if (!data || typeof data.text !== 'string' || data.text.length > 500) {
    socket.emit('error', 'Invalid message format');
    return;
  }
  // Process valid message
});
```

### Server Error Handling
```javascript
// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Graceful shutdown
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
```

## File Structure
```
src/
  ├── server.js           # Main server application
  ├── config/
  │   └── socket.js       # Socket.IO configuration
  └── utils/
      └── validation.js   # Input validation utilities
public/
  ├── index.html          # Client web interface
  ├── style.css           # Client styling
  └── client.js           # Client-side JavaScript
tests/
  ├── server.test.js      # Server unit tests
  └── integration.test.js # Multi-client integration tests
```

## Validation Gates

### 1. Code Quality
```bash
# Lint check
npm run lint

# Run all tests
npm test
```

### 2. Server Functionality
```bash
# Start server (should run without errors)
node src/server.js

# Server should log:
# - "Server listening on port 3000"
# - Socket.IO initialization
# - No uncaught exceptions
```

### 3. Client Connection Test
```bash
# Manual test steps:
# 1. Navigate to http://localhost:3000
# 2. Verify page loads without console errors
# 3. Check Socket.IO connection established
# 4. Send test message, verify it appears in message area
```

### 4. Multi-Player Test
```bash
# Manual test steps:
# 1. Open multiple browser tabs to http://localhost:3000
# 2. Send messages from different tabs
# 3. Verify all tabs receive all messages
# 4. Close tabs, verify no server errors
# 5. Check server logs for connection/disconnection events
```

### 5. Performance Validation
```bash
# Basic load test (optional, for confidence)
# Use browser dev tools to simulate slow network
# Verify automatic reconnection works
# Check message delivery under packet loss
```

## Success Criteria

### Functional Requirements
- [x] Server starts and accepts connections
- [x] Web client connects to server via Socket.IO
- [x] Players can send text messages
- [x] Messages are broadcast to all connected players
- [x] Multiple players can connect simultaneously
- [x] Graceful handling of player disconnections

### Technical Requirements
- [x] Uses Socket.IO v4 for real-time communication
- [x] Serves static web client files
- [x] Supports up to 20 concurrent connections
- [x] Implements proper error handling
- [x] Follows project coding standards (JSDoc, file size limits)
- [x] Includes unit and integration tests

### Performance Requirements
- [x] Sub-second message delivery latency
- [x] Stable connections under normal network conditions
- [x] Automatic reconnection on connection drops
- [x] No memory leaks during extended operation

## Implementation Priority
1. **Critical**: Server setup and basic Socket.IO integration
2. **High**: Client interface and connection handling
3. **High**: Message broadcasting functionality
4. **Medium**: Error handling and input validation
5. **Medium**: Testing and performance validation
6. **Low**: UI polish and additional features

## Risk Mitigation

### Known Issues
- **Socket.IO Versions**: Ensure client/server Socket.IO versions match
- **CORS Issues**: Configure properly for local development
- **Connection Limits**: Monitor for file descriptor limits on server
- **Message Flooding**: Implement basic rate limiting if needed

### Development Guidelines
- Follow CLAUDE.md development rules
- Use TDD approach with tests before implementation
- Keep files under 500 lines
- Use JSDoc for all functions
- Apply KISS and YAGNI principles

## Confidence Score: 8/10

This PRP provides comprehensive context for one-pass implementation including:
- ✅ Complete technical research and documentation links
- ✅ Detailed architecture with code examples
- ✅ Clear implementation roadmap with priorities
- ✅ Executable validation gates
- ✅ Error handling strategies
- ✅ Performance considerations and best practices
- ✅ Project-specific conventions and constraints

The implementation should succeed in one pass given the thorough preparation, clear requirements, and abundant technical context provided.