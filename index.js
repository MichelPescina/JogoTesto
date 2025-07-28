const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const SessionManager = require('./server/SessionManager');
const Match = require('./server/Match');
const Courier = require('./server/Courier');
const GameCommand = require('./server/game/GameCommand');
const GameMsg = require('./server/game/GameMsg');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    connectionStateRecovery: {}
})

// Initialize managers
const sessionManager = new SessionManager();
const sessionToSocket = new Courier();
const match = new Match(sessionToSocket);

// Store active sessions and their associated sockets
const activeSessions = new Map(); // sessionId -> { socket, playerId, playerName }

app.use(express.static('public'));

// Route handlers
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'game.html'));
});

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    // Authentication and session persistence
    const auth = socket.handshake.auth;
    let session = null;
    let playerId = null;
    let playerName = null;

    // Validate or create session
    if (auth.sessionId && sessionManager.isValidSession(auth.sessionId)) {
        // Use existing session
        const existingSession = sessionManager.getSession(auth.sessionId);
        session = { sessionId: existingSession.sessionId };
        playerId = existingSession.playerId;
        playerName = existingSession.playerName;
        console.log(`Reconnected session: ${auth.sessionId}`);
    } else {
        // Create new session
        const sessionId = sessionManager.createSession(null, 'Anonymous');
        const newSession = sessionManager.getSession(sessionId);
        session = { sessionId: newSession.sessionId };
        console.log(`Created new session: ${session.sessionId}`);
    }

    // Store active session
    activeSessions.set(session.sessionId, { socket, playerId, playerName });

    // Set up message delivery from match to this socket
    sessionToSocket.setAddress(session.sessionId, (msg) => {
        // Route different message types to appropriate socket events
        if (msg.content && msg.content.type) {
            switch (msg.content.type) {
                case GameMsg.TYPE.ROOM_UPDATE:
                    socket.emit('roomUpdate', msg.content.data);
                    break;
                case GameMsg.TYPE.CHAT_MSG:
                    socket.emit('chatMessage', msg.content.data);
                    break;
                case GameMsg.TYPE.BATTLE_START:
                    socket.emit('battleStart', msg.content.data);
                    break;
                case GameMsg.TYPE.BATTLE_TIMER:
                    socket.emit('battleTimer', msg.content.data);
                    break;
                case GameMsg.TYPE.BATTLE_END:
                    socket.emit('battleEnd', msg.content.data);
                    break;
                case GameMsg.TYPE.SEARCH_START:
                    socket.emit('searchStart', msg.content.data);
                    break;
                case GameMsg.TYPE.SEARCH_END:
                    socket.emit('searchEnd', msg.content.data);
                    break;
                case GameMsg.TYPE.GRACE_PERIOD:
                    socket.emit('gracePeriod', msg.content.data);
                    break;
                case GameMsg.TYPE.PLAYER_JOIN:
                    socket.emit('playerJoined', msg.content.data);
                    break;
                case GameMsg.TYPE.PLAYER_LEAVE:
                    socket.emit('playerLeft', msg.content.data);
                    break;
                case GameMsg.TYPE.PLAYER_DEAD:
                    socket.emit('playerDead', msg.content.data);
                    break;
                case GameMsg.TYPE.ERROR:
                    socket.emit('gameError', msg.content.data);
                    break;
                case GameMsg.TYPE.GAME_STATE:
                    if (msg.content.data.type === 'MATCH_END') {
                        socket.emit('matchEnd', msg.content.data);
                    } else {
                        socket.emit('gameStateUpdate', msg.content.data);
                    }
                    break;
                default:
                    socket.emit('gameMessage', msg);
            }
        } else {
            // Fallback for legacy messages
            socket.emit('gameMessage', msg);
        }
        console.log('MATCH -> CLIENT:', msg.content?.type || 'legacy');
    });

    // Socket event handlers
    
    /**
     * Handle player joining a match
     */
    socket.on('joinMatch', (playerName) => {
        console.log(`Player attempting to join: ${playerName}`);
        
        if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
            socket.emit('joinError', { message: 'Valid player name required' });
            return;
        }

        if (match.playersCanJoin()) {
            const result = match.createPlayer(session.sessionId, playerName.trim());
            if (result !== null) {
                // Update session with player info
                const updatedSession = sessionManager.getSession(session.sessionId);
                if (updatedSession) {
                    updatedSession.playerName = playerName.trim();
                    playerId = session.sessionId;
                    playerName = playerName.trim();
                    
                    // Update active sessions
                    activeSessions.set(session.sessionId, { socket, playerId, playerName });
                }

                // Send success response
                socket.emit('matchJoined', {
                    matchId: match.matchId,
                    playerId: session.sessionId,
                    playerName: playerName.trim(),
                    playerCount: match.totalPlayers(),
                    maxPlayers: match.maxPlayers,
                    matchState: match.state
                });

                console.log(`Player ${playerName} joined match ${match.matchId}`);
            } else {
                socket.emit('joinError', { message: 'Failed to join match' });
            }
        } else {
            socket.emit('joinError', { message: 'Match is full or not accepting players' });
        }
    });

    /**
     * Handle game commands from players
     */
    socket.on('gameCommand', (command) => {
        console.log(`Game command from ${session.sessionId}:`, command);
        
        if (!match.canExecuteCommands()) {
            socket.emit('gameError', { 
                message: 'Game is not ready for commands',
                code: 'GAME_NOT_READY'
            });
            return;
        }

        // Execute the command through the match
        const success = match.execGameComm(session.sessionId, command);
        if (!success) {
            socket.emit('gameError', { 
                message: 'Failed to execute command',
                code: 'COMMAND_FAILED'
            });
        }
    });

    /**
     * Handle match countdown updates
     */
    socket.on('requestMatchInfo', () => {
        const matchInfo = match.getMatchInfo();
        socket.emit('matchInfo', matchInfo);
    });

    /**
     * Handle player disconnection
     */
    socket.on('disconnect', (reason) => {
        console.log(`Socket ${socket.id} disconnected: ${reason}`);
        
        // Clean up active session
        activeSessions.delete(session.sessionId);
        
        // Note: We don't immediately remove the player from the match
        // to allow for reconnection. In a production system, you might
        // want to implement a grace period for reconnection.
    });

    /**
     * Handle player explicitly leaving the match
     */
    socket.on('leaveMatch', () => {
        console.log(`Player ${session.sessionId} leaving match`);
        
        // Remove player from match
        match.removePlayer(session.sessionId);
        
        // Clean up session
        activeSessions.delete(session.sessionId);
        sessionManager.invalidateSession(session.sessionId);
        
        socket.emit('matchLeft', { success: true });
    });

    /**
     * Legacy test call handler
     */
    socket.on('testCall', () => {
        console.log(`Test call from ${session.sessionId}, match state: ${match.state}`);
        match.testCall();
    });

    // Send session information to client
    socket.emit('session', session);
    
    console.log(`Session established: ${session.sessionId}`);
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`)
    console.log(`Open http://localhost:${PORT}`)
})